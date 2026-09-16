import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getUtenteCorrente } from "@/lib/supabase/dal";
import type { Documento } from "@/lib/documenti/modello";
import {
  costruisciRendiconto,
  type ManutenzioneRendiconto,
  type QuotaRendiconto,
  type SegnalazioneRendiconto,
  type UscitaRendiconto,
} from "@/lib/documenti/rendiconto";
import type { PrioritaSegnalazione, StatoSegnalazione } from "@/lib/types";

type RipartizioneAnno = {
  importo_dovuto: number;
  stato_pagamento: string;
  data_scadenza: string | null;
  data_pagamento: string | null;
  unita: { identificativo: string } | null;
  spesa: { data_spesa: string } | null;
};

/**
 * Raccoglie i dati del rendiconto annuale di un condominio.
 *
 * Come per lo stato patrimoniale, le query passano dal client con la sessione
 * dell'utente: la RLS è l'unico controllo di accesso, e un amministratore che
 * non gestisce il condominio semplicemente non lo trova (404).
 *
 * Le ripartizioni si prendono per unità e non per spesa perché è la strada che
 * la RLS conosce meglio, e perché le unità del condominio sono comunque già
 * necessarie: sono le righe della tabella per unità del prospetto.
 *
 * Spese e ripartizioni si leggono TUTTE, non solo quelle dell'anno: il
 * riepilogo finanziario al 31 dicembre è una fotografia cumulata (cassa da
 * sempre, crediti di ogni annualità) e con i soli movimenti dell'anno non si
 * potrebbe calcolare. Segnalazioni e manutenzioni non entrano nei conti: sono
 * i "rapporti in corso e questioni pendenti" che l'art. 1130-bis chiede alla
 * nota sintetica esplicativa.
 */
export async function costruisciDocumentoRendiconto(
  condominioId: string,
  anno: number
): Promise<Documento | null> {
  const supabase = await createClient();

  const { data: condominio } = await supabase
    .from("condomini")
    .select("nome, indirizzo, codice_fiscale")
    .eq("id", condominioId)
    .single();

  if (!condominio) return null;

  const { data: unitaData } = await supabase
    .from("unita")
    .select("id")
    .eq("condominio_id", condominioId);
  const unitaIds = (unitaData ?? []).map((u) => u.id as string);

  const [
    { data: speseData },
    { data: ripartizioniData },
    { data: segnalazioniData },
    { data: manutenzioniData },
  ] = await Promise.all([
    supabase
      .from("spese")
      .select("descrizione, categoria, data_spesa, importo_totale, fornitore")
      .eq("condominio_id", condominioId),
    unitaIds.length
      ? supabase
          .from("ripartizioni")
          .select(
            "importo_dovuto, stato_pagamento, data_scadenza, data_pagamento, unita:unita_id(identificativo), spesa:spesa_id(data_spesa)"
          )
          .in("unita_id", unitaIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("segnalazioni")
      .select("titolo, stato, priorita")
      .eq("condominio_id", condominioId),
    supabase
      .from("manutenzioni_programmate")
      .select("titolo, data_prossima, stato")
      .eq("condominio_id", condominioId),
  ]);

  const uscite: UscitaRendiconto[] = (speseData ?? []).map((s) => ({
    dataSpesa: s.data_spesa as string,
    categoria: s.categoria as string,
    descrizione: s.descrizione as string,
    fornitore: (s.fornitore as string | null) ?? null,
    importo: s.importo_totale as number,
  }));

  // Anno di competenza: la scadenza se c'è, altrimenti la data della spesa.
  // È la stessa regola dello stato patrimoniale, così le due stampe non
  // possono raccontare storie diverse sulla stessa unità.
  const quote: QuotaRendiconto[] = ((ripartizioniData ?? []) as unknown as RipartizioneAnno[]).map(
    (r) => ({
      unita: r.unita?.identificativo ?? "Unità non indicata",
      dataCompetenza: r.data_scadenza ?? r.spesa?.data_spesa ?? "",
      importo: r.importo_dovuto,
      statoPagamento: r.stato_pagamento,
      dataPagamento: r.data_pagamento,
    })
  );

  const segnalazioni: SegnalazioneRendiconto[] = (segnalazioniData ?? []).map((s) => ({
    titolo: s.titolo as string,
    stato: s.stato as StatoSegnalazione,
    priorita: s.priorita as PrioritaSegnalazione,
  }));

  const manutenzioni: ManutenzioneRendiconto[] = (manutenzioniData ?? []).map((m) => ({
    titolo: m.titolo as string,
    dataProssima: m.data_prossima as string,
    stato: m.stato as string,
  }));

  // Chi scarica il rendiconto è l'amministratore di quel condominio: la RLS non
  // lascerebbe passare nessun altro. Il suo nome finisce in testa al documento,
  // non solo nella riga di firma.
  const utente = await getUtenteCorrente();

  return costruisciRendiconto({
    condominio: {
      nome: condominio.nome,
      indirizzo: condominio.indirizzo,
      codiceFiscale: condominio.codice_fiscale,
    },
    anno,
    uscite,
    quote,
    segnalazioni,
    manutenzioni,
    amministratore: utente
      ? { nome: utente.nome, cognome: utente.cognome, email: utente.email }
      : null,
    generatoIl: new Date().toISOString(),
  });
}
