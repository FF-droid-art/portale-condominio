/**
 * Posizione debitoria di una unità e livello del sollecito da mandare.
 *
 * COME SI CONTA IL RITARDO. Una quota è scaduta quando ha una data di scadenza
 * già passata e non risulta pagata. Il giorno stesso della scadenza NON è
 * ritardo: si è in ritardo dal giorno dopo. Le quote senza data di scadenza non
 * possono essere in ritardo — non c'è un termine da confrontare — a meno che
 * l'amministratore le abbia già segnate a mano come "in ritardo": in quel caso
 * entrano nel totale ma non spostano il conteggio dei giorni, perché non si sa
 * da quando.
 *
 * I LIVELLI. Tre gradini, scelti sulla prassi corrente degli studi:
 *   1 — primo sollecito bonario, dal giorno dopo la scadenza: nella maggior
 *       parte dei casi è una dimenticanza e basta ricordarlo;
 *   2 — sollecito formale, dopo 30 giorni: il ritardo non è più una svista;
 *   3 — diffida ad adempiere, dopo 60 giorni: l'ultimo passo prima del decreto
 *       ingiuntivo, che l'amministratore è tenuto a chiedere entro sei mesi
 *       dalla chiusura dell'esercizio (art. 1129 c.c., comma 9).
 * Il livello è un SUGGERIMENTO: l'amministratore può sempre scegliere di
 * mandarne uno più tenue, perché conosce la persona e la situazione.
 *
 * Le date sono stringhe "aaaa-mm-gg" trattate come date di calendario, come in
 * `@/lib/manutenzioni`: passare da `new Date(...)` farebbe dipendere dal fuso
 * del processo il numero di giorni di ritardo.
 */

import { oggiLocale } from "@/lib/fuso";

export type LivelloSollecito = 1 | 2 | 3;

/** Giorni di ritardo a partire dai quali scatta ciascun livello. */
export const SOGLIE_LIVELLO: Record<LivelloSollecito, number> = {
  1: 1,
  2: 30,
  3: 60,
};

export const ETICHETTE_LIVELLO: Record<LivelloSollecito, string> = {
  1: "Primo sollecito",
  2: "Sollecito",
  3: "Diffida",
};

export const DESCRIZIONI_LIVELLO: Record<LivelloSollecito, string> = {
  1: "Promemoria cortese: di solito è una dimenticanza.",
  2: "Richiamo formale, con l'indicazione delle rate arretrate.",
  3: "Ultimo avviso prima delle azioni di recupero.",
};

export const LIVELLI_SOLLECITO = [1, 2, 3] as const;

export function isLivelloSollecito(valore: number): valore is LivelloSollecito {
  return valore === 1 || valore === 2 || valore === 3;
}

const FORMATO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "aaaa-mm-gg" -> giorni assoluti, per confronti indipendenti dal fuso. */
function aGiorni(data: string): number | null {
  const m = FORMATO_DATA.exec(data.slice(0, 10));
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(ms) ? null : Math.floor(ms / 86_400_000);
}

/** Livello suggerito per un ritardo di tanti giorni; `null` se non c'è ritardo. */
export function livelloSuggerito(giorniRitardo: number): LivelloSollecito | null {
  if (giorniRitardo >= SOGLIE_LIVELLO[3]) return 3;
  if (giorniRitardo >= SOGLIE_LIVELLO[2]) return 2;
  if (giorniRitardo >= SOGLIE_LIVELLO[1]) return 1;
  return null;
}

/** Quel che serve di una ripartizione per capire se è arretrata. */
export type RataDovuta = {
  importo_dovuto: number;
  stato_pagamento: string;
  data_scadenza: string | null;
  data_pagamento: string | null;
};

export type RataScaduta<T> = {
  rata: T;
  /** Giorni trascorsi dalla scadenza; 0 se la scadenza non è nota. */
  giorniRitardo: number;
};

export type PosizioneMorosita<T> = {
  totaleScaduto: number;
  rateScadute: number;
  giorniRitardoMax: number;
  livello: LivelloSollecito | null;
  /** Le sole rate arretrate, dalla più vecchia alla più recente. */
  partite: RataScaduta<T>[];
};

/**
 * Calcola la posizione arretrata di una unità a una certa data.
 *
 * Le rate già pagate escono di scena qualunque sia la data di pagamento: qui
 * interessa quanto manca oggi, non la puntualità storica.
 */
export function calcolaPosizione<T extends RataDovuta>(
  rate: T[],
  oggi: string = oggiLocale()
): PosizioneMorosita<T> {
  const riferimento = aGiorni(oggi);
  const partite: RataScaduta<T>[] = [];
  let totaleScaduto = 0;
  let giorniRitardoMax = 0;

  for (const rata of rate) {
    if (rata.stato_pagamento === "pagato") continue;

    const scadenza = rata.data_scadenza ? aGiorni(rata.data_scadenza) : null;
    const giorniRitardo =
      scadenza !== null && riferimento !== null ? riferimento - scadenza : 0;

    // Senza scadenza passata non c'è arretrato, salvo la marcatura manuale
    // "in ritardo" fatta dall'amministratore (vedi il commento in testa).
    const arretrata = giorniRitardo > 0 || (scadenza === null && rata.stato_pagamento === "in_ritardo");
    if (!arretrata) continue;

    totaleScaduto += rata.importo_dovuto;
    giorniRitardoMax = Math.max(giorniRitardoMax, Math.max(giorniRitardo, 0));
    partite.push({ rata, giorniRitardo: Math.max(giorniRitardo, 0) });
  }

  partite.sort((a, b) => b.giorniRitardo - a.giorniRitardo);

  return {
    totaleScaduto,
    rateScadute: partite.length,
    giorniRitardoMax,
    livello: livelloSuggerito(giorniRitardoMax),
    partite,
  };
}

export type PosizioneUnita<T> = {
  unitaId: string;
  posizione: PosizioneMorosita<T>;
};

/**
 * Raggruppa un elenco piatto di ripartizioni per unità e ne calcola la
 * posizione, scartando le unità in regola.
 *
 * L'ordine è quello in cui l'amministratore vuole guardarle: prima i ritardi
 * più lunghi, e a parità di giorni gli importi più alti.
 */
export function posizioniPerUnita<T extends RataDovuta & { unita_id: string }>(
  rate: T[],
  oggi: string = oggiLocale()
): PosizioneUnita<T>[] {
  const perUnita = new Map<string, T[]>();
  for (const rata of rate) {
    const elenco = perUnita.get(rata.unita_id) ?? [];
    elenco.push(rata);
    perUnita.set(rata.unita_id, elenco);
  }

  return [...perUnita.entries()]
    .map(([unitaId, elenco]) => ({ unitaId, posizione: calcolaPosizione(elenco, oggi) }))
    .filter((p) => p.posizione.rateScadute > 0)
    .sort(
      (a, b) =>
        b.posizione.giorniRitardoMax - a.posizione.giorniRitardoMax ||
        b.posizione.totaleScaduto - a.posizione.totaleScaduto ||
        a.unitaId.localeCompare(b.unitaId)
    );
}
