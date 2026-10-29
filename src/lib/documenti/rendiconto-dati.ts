import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Documento } from "@/lib/documenti/modello";
import {
  costruisciRendiconto,
  type ManutenzioneRendiconto,
  type QuotaRendiconto,
  type SegnalazioneRendiconto,
  type UscitaRendiconto,
} from "@/lib/documenti/rendiconto";
import type { PrioritaSegnalazione, StatoSegnalazione } from "@/lib/types";

/**
 * Raccoglie i dati del rendiconto annuale di un condominio.
 *
 * DOVE STA E PERCHÉ. Sta in `src/lib/documenti/` accanto al modello che
 * alimenta, e non dentro la cartella di una route come gli altri `*-dati.ts`,
 * perché lo usano DUE aree: l'amministratore (`/admin/condomini/[id]/
 * rendiconto`) e il condòmino (`/area-riservata/condominio/[id]/rendiconto`).
 * Un modulo condiviso sotto `src/app/admin/**` lo renderebbe un dettaglio
 * dell'area amministratore che l'area condòmino importa di straforo.
 *
 * UN SOLO PERCORSO PER I DUE RUOLI. La funzione non sa e non chiede chi la
 * chiama: riceve un `condominioId` esplicito e lascia che siano la RLS e le
 * funzioni `security definer` a dire se quei dati sono accessibili. Non c'è
 * una variante "per l'amministratore" e una "per il condòmino" proprio perché
 * il rendiconto che l'art. 1130-bis c.c. dà diritto di estrarre è lo STESSO
 * documento: due raccolte dati separate sarebbero due documenti che col tempo
 * divergono.
 *
 * COSA PASSA DALLA RLS E COSA DALLE FUNZIONI. Condominio, spese e manutenzioni
 * sono già visibili per intero a chiunque appartenga allo stabile
 * (`condomini_select`, `spese_select`, `manutenzioni_select`): si leggono con
 * la sessione dell'utente, e chi non ha titolo semplicemente non trova il
 * condominio (404). Quote, segnalazioni e nominativo dell'amministratore no:
 * le policy di riga li limitano alla propria unità, e un rendiconto con una
 * sola unità non è il rendiconto. Per quelli si passa dalle funzioni
 * `condominio_rendiconto_quote` / `condominio_rendiconto_segnalazioni` /
 * `condominio_amministratore`, che verificano l'appartenenza al loro interno
 * (vedi il blocco di migrazione in `supabase/schema.sql`).
 *
 * Spese e quote si leggono TUTTE, non solo quelle dell'anno: il riepilogo
 * finanziario al 31 dicembre è una fotografia cumulata (cassa da sempre,
 * crediti di ogni annualità) e con i soli movimenti dell'anno non si potrebbe
 * calcolare. Segnalazioni e manutenzioni non entrano nei conti: sono i
 * "rapporti in corso e questioni pendenti" che l'art. 1130-bis chiede alla
 * nota sintetica esplicativa.
 */

/** Riga di `condominio_rendiconto_quote`. */
type QuotaRpc = {
  identificativo: string;
  data_scadenza: string | null;
  data_spesa: string | null;
  importo: number;
  stato_pagamento: string;
  data_pagamento: string | null;
};

/** Riga di `condominio_rendiconto_segnalazioni`. */
type SegnalazioneRpc = { stato: StatoSegnalazione; priorita: PrioritaSegnalazione };

/** Riga di `condominio_amministratore`. */
type AmministratoreRpc = { nome: string; cognome: string; email: string };

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

  // Prima barriera: se la RLS non restituisce il condominio, chi chiede non ha
  // titolo per nessuna delle query che seguono. Si esce qui, senza nemmeno
  // provare a chiamare le funzioni.
  if (!condominio) return null;

  const [
    { data: speseData },
    { data: manutenzioniData },
    { data: quoteData, error: quoteErrore },
    { data: segnalazioniData, error: segnalazioniErrore },
    { data: amministratoreData },
  ] = await Promise.all([
    supabase
      .from("spese")
      .select("descrizione, categoria, data_spesa, importo_totale, fornitore")
      .eq("condominio_id", condominioId),
    supabase
      .from("manutenzioni_programmate")
      .select("titolo, data_prossima, stato")
      .eq("condominio_id", condominioId),
    supabase.rpc("condominio_rendiconto_quote", { p_condominio_id: condominioId }),
    supabase.rpc("condominio_rendiconto_segnalazioni", { p_condominio_id: condominioId }),
    supabase.rpc("condominio_amministratore", { p_condominio_id: condominioId }).maybeSingle(),
  ]);

  // Se una delle funzioni fallisce NON si prosegue: un rendiconto senza quote
  // o senza segnalazioni è indistinguibile, una volta stampato, da un
  // condominio che davvero non ne ha. Meglio un errore che un documento
  // ufficiale sbagliato in silenzio.
  if (quoteErrore || segnalazioniErrore) {
    console.error("Raccolta dati del rendiconto fallita", {
      condominioId,
      anno,
      quoteErrore,
      segnalazioniErrore,
    });
    throw new Error("Impossibile leggere i dati del rendiconto.");
  }

  const uscite: UscitaRendiconto[] = (speseData ?? []).map((s) => ({
    dataSpesa: s.data_spesa as string,
    categoria: s.categoria as string,
    descrizione: s.descrizione as string,
    fornitore: (s.fornitore as string | null) ?? null,
    importo: s.importo_totale as number,
  }));

  // Anno di competenza: la scadenza se c'è, altrimenti la data della spesa.
  // È la stessa regola dello stato patrimoniale, così le due stampe non
  // possono raccontare storie diverse sulla stessa unità. La regola vive qui e
  // non nella funzione SQL apposta: un posto solo in cui cambiarla.
  const quote: QuotaRendiconto[] = ((quoteData ?? []) as QuotaRpc[]).map((r) => ({
    unita: r.identificativo || "Unità non indicata",
    dataCompetenza: r.data_scadenza ?? r.data_spesa ?? "",
    importo: r.importo,
    statoPagamento: r.stato_pagamento,
    dataPagamento: r.data_pagamento,
  }));

  const segnalazioni: SegnalazioneRendiconto[] = ((segnalazioniData ?? []) as SegnalazioneRpc[]).map(
    (s) => ({ stato: s.stato, priorita: s.priorita })
  );

  const manutenzioni: ManutenzioneRendiconto[] = (manutenzioniData ?? []).map((m) => ({
    titolo: m.titolo as string,
    dataProssima: m.data_prossima as string,
    stato: m.stato as string,
  }));

  // L'amministratore in testa al documento è quello DEL CONDOMINIO, non chi
  // sta scaricando: il condòmino che estrae copia del rendiconto deve leggerci
  // il nome di chi lo ha redatto, non il proprio.
  const amministratore = amministratoreData as AmministratoreRpc | null;

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
    amministratore: amministratore
      ? {
          nome: amministratore.nome,
          cognome: amministratore.cognome,
          email: amministratore.email,
        }
      : null,
    generatoIl: new Date().toISOString(),
  });
}
