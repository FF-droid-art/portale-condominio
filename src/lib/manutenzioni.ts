/**
 * Scadenzario delle manutenzioni programmate.
 *
 * Una manutenzione programmata è la PROSSIMA scadenza di un contratto o di un
 * intervento ricorrente (verifica dell'ascensore, revisione della caldaia,
 * controllo degli estintori): non è uno storico, è la data da non mancare.
 * Quando l'amministratore la segna come eseguita, se la manutenzione è
 * periodica ne nasce automaticamente la successiva.
 *
 * Le date sono stringhe "aaaa-mm-gg" (colonne `date` di Postgres) e vengono
 * trattate come date di calendario, non come istanti: confrontarle passando
 * per `new Date(...)` con l'ora locale farebbe cambiare il risultato a seconda
 * del fuso di chi guarda, e "scade oggi" non è un concetto che dipende dal
 * fuso orario.
 */

import { oggiLocale } from "@/lib/fuso";
import type {
  CategoriaFornitore,
  Periodicita,
  StatoManutenzione,
} from "@/lib/types";

export const ETICHETTE_CATEGORIA_FORNITORE: Record<CategoriaFornitore, string> = {
  ascensore: "Ascensore",
  caldaia_riscaldamento: "Caldaia e riscaldamento",
  idraulico: "Idraulico",
  elettricista: "Elettricista",
  pulizie: "Pulizie",
  giardinaggio: "Giardinaggio",
  antincendio: "Antincendio",
  assicurazione: "Assicurazione",
  edile: "Edile",
  altro: "Altro",
};

export const CATEGORIE_FORNITORE = Object.keys(
  ETICHETTE_CATEGORIA_FORNITORE
) as CategoriaFornitore[];

export const ETICHETTE_PERIODICITA: Record<Periodicita, string> = {
  nessuna: "Una tantum",
  mensile: "Ogni mese",
  trimestrale: "Ogni 3 mesi",
  semestrale: "Ogni 6 mesi",
  annuale: "Ogni anno",
  biennale: "Ogni 2 anni",
};

export const PERIODICITA = Object.keys(ETICHETTE_PERIODICITA) as Periodicita[];

export const ETICHETTE_STATO_MANUTENZIONE: Record<StatoManutenzione, string> = {
  programmata: "Programmata",
  completata: "Completata",
  annullata: "Annullata",
};

/** Mesi da sommare per ricavare la scadenza successiva. */
const MESI_PERIODICITA: Record<Periodicita, number> = {
  nessuna: 0,
  mensile: 1,
  trimestrale: 3,
  semestrale: 6,
  annuale: 12,
  biennale: 24,
};

/** Giorni entro i quali una scadenza è considerata "in arrivo". */
export const GIORNI_PREAVVISO = 30;

const FORMATO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "aaaa-mm-gg" -> giorni assoluti, per confronti indipendenti dal fuso. */
function aGiorni(data: string): number | null {
  const m = FORMATO_DATA.exec(data.slice(0, 10));
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(ms) ? null : Math.floor(ms / 86_400_000);
}

/**
 * Data odierna nel formato "aaaa-mm-gg", secondo l'orologio del condominio e
 * non secondo il fuso del processo (vedi `@/lib/fuso`): su Vercel il server
 * lavora in UTC e a cavallo della mezzanotte direbbe il giorno sbagliato.
 */
export function oggiIso(adesso: Date = new Date()): string {
  return oggiLocale(adesso);
}

/**
 * Giorni che mancano alla scadenza: negativo se è già passata, 0 se è oggi.
 * `null` se la data non è interpretabile.
 */
export function giorniAllaScadenza(
  dataProssima: string,
  oggi: string = oggiIso()
): number | null {
  const scadenza = aGiorni(dataProssima);
  const riferimento = aGiorni(oggi);
  if (scadenza === null || riferimento === null) return null;
  return scadenza - riferimento;
}

export type UrgenzaScadenza = "scaduta" | "in_scadenza" | "futura";

/**
 * Urgenza di una scadenza rispetto a oggi. Una manutenzione già completata o
 * annullata non è mai urgente: la si legge nello storico, non nello scadenzario.
 */
export function urgenzaScadenza(
  manutenzione: { data_prossima: string; stato: StatoManutenzione },
  oggi: string = oggiIso(),
  giorniPreavviso: number = GIORNI_PREAVVISO
): UrgenzaScadenza {
  if (manutenzione.stato !== "programmata") return "futura";
  const giorni = giorniAllaScadenza(manutenzione.data_prossima, oggi);
  if (giorni === null) return "futura";
  if (giorni < 0) return "scaduta";
  if (giorni <= giorniPreavviso) return "in_scadenza";
  return "futura";
}

/**
 * Data della scadenza successiva a partire da quella appena eseguita.
 *
 * Somma i mesi della periodicità alla data indicata. Se il giorno del mese non
 * esiste nel mese di arrivo (31 gennaio + 1 mese), si ricade sull'ultimo giorno
 * di quel mese invece di scivolare al mese dopo, che è come le scadenze
 * contrattuali vengono lette nella pratica. Restituisce `null` per le
 * manutenzioni una tantum: non c'è una prossima volta.
 */
export function prossimaScadenza(
  dataRiferimento: string,
  periodicita: Periodicita
): string | null {
  const mesi = MESI_PERIODICITA[periodicita] ?? 0;
  if (mesi === 0) return null;

  const m = FORMATO_DATA.exec(dataRiferimento.slice(0, 10));
  if (!m) return null;

  const anno = Number(m[1]);
  const mese = Number(m[2]) - 1;
  const giorno = Number(m[3]);

  const totaleMesi = mese + mesi;
  const annoArrivo = anno + Math.floor(totaleMesi / 12);
  const meseArrivo = ((totaleMesi % 12) + 12) % 12;

  // Giorno 0 del mese successivo = ultimo giorno del mese di arrivo.
  const ultimoGiorno = new Date(Date.UTC(annoArrivo, meseArrivo + 1, 0)).getUTCDate();
  const giornoArrivo = Math.min(giorno, ultimoGiorno);

  return `${annoArrivo}-${String(meseArrivo + 1).padStart(2, "0")}-${String(
    giornoArrivo
  ).padStart(2, "0")}`;
}

export type RigaScadenzario<T> = {
  manutenzione: T;
  urgenza: UrgenzaScadenza;
  giorni: number | null;
};

/**
 * Ordina lo scadenzario nell'ordine in cui va guardato: prima le scadenze
 * ancora aperte (dalla più vecchia scaduta alla più lontana), poi quelle
 * chiuse. A parità di data, l'ordine alfabetico rende l'elenco stabile.
 */
export function ordinaScadenzario<
  T extends { data_prossima: string; stato: StatoManutenzione; titolo: string },
>(manutenzioni: T[], oggi: string = oggiIso()): RigaScadenzario<T>[] {
  return manutenzioni
    .map((manutenzione) => ({
      manutenzione,
      urgenza: urgenzaScadenza(manutenzione, oggi),
      giorni: giorniAllaScadenza(manutenzione.data_prossima, oggi),
    }))
    .sort((a, b) => {
      const aperta = (r: RigaScadenzario<T>) => (r.manutenzione.stato === "programmata" ? 0 : 1);
      return (
        aperta(a) - aperta(b) ||
        a.manutenzione.data_prossima.localeCompare(b.manutenzione.data_prossima) ||
        a.manutenzione.titolo.localeCompare(b.manutenzione.titolo, "it")
      );
    });
}
