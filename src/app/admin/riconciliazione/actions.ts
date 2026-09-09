"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { richiedeAmministratore } from "@/lib/supabase/dal";
import { MAX_MOVIMENTI, parseEstrattoContoCsv } from "@/lib/riconciliazione";

export type StatoForm = { errore?: string } | undefined;

export type EsitoImportEstratto =
  | {
      ok: true;
      letti: number;
      importati: number;
      duplicati: number;
      errori: { riga: number; messaggio: string }[];
      colonne: { data: string | null; importo: string | null; descrizione: string | null };
    }
  | { errore: string };

function rivalida() {
  revalidatePath("/admin/riconciliazione");
  revalidatePath("/admin/spese");
  revalidatePath("/admin/solleciti");
}

/**
 * Importa un estratto conto CSV.
 *
 * Le righe vengono scritte subito con stato "da_abbinare": l'abbinamento è un
 * passo successivo e reversibile, mentre il movimento in sé è un fatto — è
 * successo, e va registrato. Reimportare lo stesso file (o il mese successivo
 * che si sovrappone di qualche giorno) non crea doppioni: ci pensa l'unicità
 * su (condominio_id, import_hash), e `ignoreDuplicates` fa sì che le righe già
 * presenti vengano saltate invece di far fallire l'intera importazione.
 *
 * Il testo del file arriva dal client, che l'ha soltanto letto: l'analisi vera
 * la fa il server, così le regole di lettura sono le stesse per tutti e non
 * dipendono dal browser di chi carica.
 */
export async function importaEstrattoConto(
  condominioId: string,
  testo: string
): Promise<EsitoImportEstratto> {
  if (!condominioId) return { errore: "Seleziona il condominio." };
  if (!testo.trim()) return { errore: "Il file è vuoto." };

  await richiedeAmministratore();

  const esito = parseEstrattoContoCsv(testo);

  if (!esito.movimenti.length) {
    return {
      errore:
        esito.errori[0]?.messaggio ??
        "Non ho riconosciuto nessun movimento in questo file. Controlla che ci sia la riga di intestazione con i nomi delle colonne.",
    };
  }
  if (esito.movimenti.length > MAX_MOVIMENTI) {
    return { errore: `Troppi movimenti (massimo ${MAX_MOVIMENTI}).` };
  }

  const supabase = await createClient();

  const { data: inseriti, error } = await supabase
    .from("movimenti_bancari")
    .upsert(
      esito.movimenti.map((m) => ({
        condominio_id: condominioId,
        data: m.data,
        importo: m.importo,
        descrizione: m.descrizione,
        riferimento: m.riferimento,
        import_hash: m.hash,
      })),
      { onConflict: "condominio_id,import_hash", ignoreDuplicates: true }
    )
    .select("id");

  if (error) return { errore: error.message };

  const importati = inseriti?.length ?? 0;

  rivalida();

  return {
    ok: true,
    letti: esito.movimenti.length,
    importati,
    duplicati: esito.movimenti.length - importati,
    errori: esito.errori,
    colonne: esito.colonne,
  };
}

/**
 * Conferma un abbinamento: la quota risulta pagata alla data del movimento.
 *
 * La data di pagamento è quella dell'operazione bancaria e non quella in cui
 * l'amministratore preme il pulsante: è la data che conta per stabilire se il
 * versamento era in ritardo, e quindi quella che deve finire nello storico.
 */
export async function confermaAbbinamento(
  movimentoId: string,
  ripartizioneId: string
): Promise<{ errore?: string }> {
  if (!movimentoId || !ripartizioneId) return { errore: "Abbinamento non valido." };

  await richiedeAmministratore();
  const supabase = await createClient();

  const { data: movimento } = await supabase
    .from("movimenti_bancari")
    .select("id, data, importo, stato")
    .eq("id", movimentoId)
    .single();

  if (!movimento) return { errore: "Movimento non trovato." };
  if (movimento.stato === "abbinato") return { errore: "Questo movimento è già abbinato." };
  if (movimento.importo <= 0) {
    return { errore: "Solo un accredito può saldare una quota." };
  }

  const { error: erroreRipartizione } = await supabase
    .from("ripartizioni")
    .update({ stato_pagamento: "pagato", data_pagamento: movimento.data })
    .eq("id", ripartizioneId);

  if (erroreRipartizione) return { errore: erroreRipartizione.message };

  const { error } = await supabase
    .from("movimenti_bancari")
    .update({ stato: "abbinato", ripartizione_id: ripartizioneId })
    .eq("id", movimentoId);

  if (error) return { errore: error.message };

  rivalida();
  return {};
}

/**
 * Sgancia un abbinamento sbagliato: la quota torna da pagare e il movimento
 * torna in coda. Nessuna cancellazione: l'errore si corregge, non si nasconde.
 */
export async function annullaAbbinamento(movimentoId: string): Promise<{ errore?: string }> {
  if (!movimentoId) return { errore: "Movimento non valido." };

  await richiedeAmministratore();
  const supabase = await createClient();

  const { data: movimento } = await supabase
    .from("movimenti_bancari")
    .select("ripartizione_id")
    .eq("id", movimentoId)
    .single();

  if (movimento?.ripartizione_id) {
    await supabase
      .from("ripartizioni")
      .update({ stato_pagamento: "da_pagare", data_pagamento: null })
      .eq("id", movimento.ripartizione_id);
  }

  const { error } = await supabase
    .from("movimenti_bancari")
    .update({ stato: "da_abbinare", ripartizione_id: null })
    .eq("id", movimentoId);

  if (error) return { errore: error.message };

  rivalida();
  return {};
}

/**
 * Mette da parte un movimento che non c'entra con le quote (spese, interessi,
 * giroconti). Resta nell'elenco degli ignorati, così non ricompare a ogni
 * importazione ma non sparisce nemmeno.
 */
export async function ignoraMovimento(movimentoId: string): Promise<{ errore?: string }> {
  if (!movimentoId) return { errore: "Movimento non valido." };

  await richiedeAmministratore();
  const supabase = await createClient();

  const { error } = await supabase
    .from("movimenti_bancari")
    .update({ stato: "ignorato", ripartizione_id: null })
    .eq("id", movimentoId);

  if (error) return { errore: error.message };

  rivalida();
  return {};
}

/** Riporta in coda un movimento messo da parte per sbaglio. */
export async function riprendiMovimento(movimentoId: string): Promise<{ errore?: string }> {
  if (!movimentoId) return { errore: "Movimento non valido." };

  await richiedeAmministratore();
  const supabase = await createClient();

  const { error } = await supabase
    .from("movimenti_bancari")
    .update({ stato: "da_abbinare" })
    .eq("id", movimentoId);

  if (error) return { errore: error.message };

  rivalida();
  return {};
}
