"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { richiedeAmministratore } from "@/lib/supabase/dal";
import { messaggioErrore } from "@/lib/errori";
import { validaRigaSpesa } from "@/lib/import/validazione";
import type { ErroreRiga, RigaImportSpesa } from "@/lib/import/tipi";

export type EsitoImportSpese =
  | { ok: true; speseCreate: number; ripartizioniCreate: number }
  | { ok: false; erroreGenerale: string; erroriRiga?: undefined }
  | { ok: false; erroriRiga: ErroreRiga[]; erroreGenerale?: undefined };

const MAX_RIGHE_IMPORT = 5000;

export async function elencaIdentificativiUnita(condominioId: string): Promise<string[]> {
  if (!condominioId) return [];
  await richiedeAmministratore();
  const supabase = await createClient();
  const { data } = await supabase
    .from("unita")
    .select("identificativo")
    .eq("condominio_id", condominioId);
  return (data ?? []).map((u) => u.identificativo as string);
}

export async function importaSpeseStoriche(
  condominioId: string,
  righe: RigaImportSpesa[],
  nomeFile: string
): Promise<EsitoImportSpese> {
  if (!condominioId) return { ok: false, erroreGenerale: "Seleziona un condominio." };
  if (!righe.length) return { ok: false, erroreGenerale: "Nessuna riga da importare." };
  if (righe.length > MAX_RIGHE_IMPORT) {
    return { ok: false, erroreGenerale: `Troppe righe (massimo ${MAX_RIGHE_IMPORT}).` };
  }

  const erroriRiga = righe
    .map((r, indice) => ({ indice, messaggio: validaRigaSpesa(r) }))
    .filter((e): e is ErroreRiga => e.messaggio !== null);
  if (erroriRiga.length) return { ok: false, erroriRiga };

  // Un'unità ripetuta due volte nello stesso gruppo-spesa violerebbe
  // unique(spesa_id, unita_id) dentro la funzione RPC: la intercettiamo
  // prima con un messaggio comprensibile.
  const gruppi = new Map<string, Set<string>>();
  for (const r of righe) {
    const chiave = `${r.descrizione}|${r.categoria}|${r.dataSpesa}|${r.fornitore ?? ""}`;
    const visti = gruppi.get(chiave) ?? new Set<string>();
    if (visti.has(r.identificativoUnita)) {
      return {
        ok: false,
        erroreGenerale: `Unità "${r.identificativoUnita}" ripetuta più volte per la spesa "${r.descrizione}" del ${r.dataSpesa}.`,
      };
    }
    visti.add(r.identificativoUnita);
    gruppi.set(chiave, visti);
  }

  // COD-04: `auth.getUser()` controllava la sessione ma non il ruolo, e un
  // non-amministratore si fermava solo alla RLS (o al `raise exception` della
  // funzione di import) con un errore di database per messaggio. Qui il
  // controllo è esplicito e, se non passa, porta al login o alla propria area.
  const amministratore = await richiedeAmministratore();
  const supabase = await createClient();

  const { data: batch, error: erroreBatch } = await supabase
    .from("import_batches")
    .insert({
      condominio_id: condominioId,
      tipo: "spese",
      nome_file: nomeFile,
      creato_da: amministratore.id,
    })
    .select("id")
    .single();
  if (erroreBatch || !batch) {
    return {
      ok: false,
      erroreGenerale: erroreBatch
        ? messaggioErrore(erroreBatch, "admin/importa/importaSpeseStoriche")
        : "Impossibile registrare l'importazione: riprova.",
    };
  }

  const { data, error } = await supabase.rpc("importa_spese_storiche", {
    p_condominio_id: condominioId,
    p_batch_id: batch.id,
    p_righe: righe,
  });

  if (error) {
    await supabase.from("import_batches").delete().eq("id", batch.id);
    return {
      ok: false, erroreGenerale: messaggioErrore(error, "admin/importa/importaSpeseStoriche"),
    };
  }

  const risultato = data?.[0] as
    | { spese_create: number; ripartizioni_create: number }
    | undefined;

  await supabase
    .from("import_batches")
    .update({ righe_importate: righe.length })
    .eq("id", batch.id);

  revalidatePath("/admin/spese");
  revalidatePath("/admin/importa");

  return {
    ok: true,
    speseCreate: risultato?.spese_create ?? 0,
    ripartizioniCreate: risultato?.ripartizioni_create ?? 0,
  };
}
