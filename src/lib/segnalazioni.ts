/**
 * Segnalazioni di manutenzione (ticket).
 *
 * Il condòmino apre una segnalazione sulla propria unità o sulle parti comuni;
 * l'amministratore la prende in carico, eventualmente la assegna a un fornitore
 * e la chiude. Qui vive solo la logica pura: etichette, ordinamento e conteggi.
 *
 * Sull'ordinamento: un elenco di ticket serve a decidere che cosa guardare
 * PRIMA, quindi l'ordine non è cronologico ma per urgenza — aperte e in corso
 * davanti, dentro ciascun gruppo la priorità più alta, e a parità l'ultimo
 * movimento (una segnalazione appena commentata ha bisogno di risposta più di
 * una ferma da due settimane).
 */

import type {
  CategoriaSegnalazione,
  PrioritaSegnalazione,
  StatoSegnalazione,
} from "@/lib/types";

export const ETICHETTE_CATEGORIA_SEGNALAZIONE: Record<CategoriaSegnalazione, string> = {
  ascensore: "Ascensore",
  riscaldamento: "Riscaldamento",
  idraulico: "Idraulico",
  elettrico: "Elettrico",
  pulizie: "Pulizie",
  parti_comuni: "Parti comuni",
  infiltrazioni: "Infiltrazioni",
  altro: "Altro",
};

export const CATEGORIE_SEGNALAZIONE = Object.keys(
  ETICHETTE_CATEGORIA_SEGNALAZIONE
) as CategoriaSegnalazione[];

export const ETICHETTE_PRIORITA: Record<PrioritaSegnalazione, string> = {
  bassa: "Bassa",
  normale: "Normale",
  alta: "Alta",
};

export const PRIORITA_SEGNALAZIONE = Object.keys(
  ETICHETTE_PRIORITA
) as PrioritaSegnalazione[];

export const ETICHETTE_STATO_SEGNALAZIONE: Record<StatoSegnalazione, string> = {
  aperta: "Aperta",
  in_corso: "In corso",
  chiusa: "Chiusa",
};

export const STATI_SEGNALAZIONE = Object.keys(
  ETICHETTE_STATO_SEGNALAZIONE
) as StatoSegnalazione[];

/** Dimensione massima della foto allegata a una segnalazione. */
export const FOTO_MAX_BYTES = 4 * 1024 * 1024;

const PESO_PRIORITA: Record<PrioritaSegnalazione, number> = {
  alta: 0,
  normale: 1,
  bassa: 2,
};

const PESO_STATO: Record<StatoSegnalazione, number> = {
  aperta: 0,
  in_corso: 1,
  chiusa: 2,
};

export type SegnalazioneOrdinabile = {
  stato: StatoSegnalazione;
  priorita: PrioritaSegnalazione;
  aggiornata_il: string;
};

/** Ordine di lavorazione: prima quello che richiede attenzione. */
export function ordinaSegnalazioni<T extends SegnalazioneOrdinabile>(segnalazioni: T[]): T[] {
  return segnalazioni.slice().sort((a, b) => {
    const stato = (PESO_STATO[a.stato] ?? 9) - (PESO_STATO[b.stato] ?? 9);
    if (stato !== 0) return stato;
    const priorita = (PESO_PRIORITA[a.priorita] ?? 9) - (PESO_PRIORITA[b.priorita] ?? 9);
    if (priorita !== 0) return priorita;
    return b.aggiornata_il.localeCompare(a.aggiornata_il);
  });
}

export type ConteggiSegnalazioni = {
  aperte: number;
  inCorso: number;
  chiuse: number;
  /** Aperte o in corso con priorità alta: il numero che conta davvero. */
  urgenti: number;
  totale: number;
};

export function contaSegnalazioni(
  segnalazioni: { stato: StatoSegnalazione; priorita: PrioritaSegnalazione }[]
): ConteggiSegnalazioni {
  const conteggi: ConteggiSegnalazioni = {
    aperte: 0,
    inCorso: 0,
    chiuse: 0,
    urgenti: 0,
    totale: segnalazioni.length,
  };

  for (const s of segnalazioni) {
    if (s.stato === "aperta") conteggi.aperte += 1;
    else if (s.stato === "in_corso") conteggi.inCorso += 1;
    else if (s.stato === "chiusa") conteggi.chiuse += 1;

    if (s.stato !== "chiusa" && s.priorita === "alta") conteggi.urgenti += 1;
  }

  return conteggi;
}
