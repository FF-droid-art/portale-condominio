/**
 * Prenotazione degli spazi comuni (sala condominiale, posti auto ospiti…).
 *
 * ORARI E FUSI. Una prenotazione è un orologio da parete: "sabato dalle 18:00
 * alle 20:00" deve restare quello per chiunque la legga, e non deve cambiare se
 * il server sta in un fuso diverso da chi prenota. Per questo la fascia viene
 * scritta e riletta sempre come orario locale del condominio: l'applicazione
 * compone la stringa "aaaa-mm-ggThh:mm:00" e la rilegge tagliandola allo stesso
 * modo, senza mai passare per `new Date(...).getHours()`, che risponderebbe in
 * base al fuso del processo. Il database continua a vedere due istanti
 * ordinabili e confrontabili, che è tutto ciò che gli serve per accorgersi
 * delle sovrapposizioni.
 *
 * Il controllo di sovrapposizione vero e proprio è duplicato apposta: qui, per
 * dare un messaggio comprensibile prima di scrivere, e in un trigger sul
 * database, che è l'unico punto in cui il vincolo vale anche per una chiamata
 * diretta all'API.
 */

export type SpazioPrenotabile = {
  nome: string;
  posti: number;
  ora_apertura: string;
  ora_chiusura: string;
  durata_massima_ore: number | null;
  attivo: boolean;
};

export type Fascia = { inizio: string; fine: string };

const FORMATO_ORA = /^(\d{2}):(\d{2})/;

/** "18:30" (o "18:30:00") -> minuti dalla mezzanotte. */
export function minutiDaOra(ora: string): number | null {
  const m = FORMATO_ORA.exec(ora);
  if (!m) return null;
  const ore = Number(m[1]);
  const minuti = Number(m[2]);
  if (ore > 23 || minuti > 59) return null;
  return ore * 60 + minuti;
}

/** Giorno ("aaaa-mm-gg") di un istante salvato con la convenzione qui sopra. */
export function giornoDi(istante: string): string {
  return istante.slice(0, 10);
}

/** Ora ("hh:mm") di un istante salvato con la convenzione qui sopra. */
export function oraDi(istante: string): string {
  return istante.slice(11, 16);
}

/** Compone l'istante da salvare a partire da giorno e ora locali. */
export function componiIstante(giorno: string, ora: string): string {
  return `${giorno}T${ora.slice(0, 5)}:00`;
}

/** "18:00 – 20:00", da mostrare accanto alla data. */
export function formattaFascia(prenotazione: Fascia): string {
  return `${oraDi(prenotazione.inizio)} – ${oraDi(prenotazione.fine)}`;
}

/**
 * Riduce un istante alla forma "aaaa-mm-ggThh:mm".
 *
 * Il database restituisce "2026-09-10T18:00:00+00:00" mentre l'applicazione
 * compone "2026-09-10T18:00:00": confrontare le due forme come stringhe
 * darebbe risultati sbagliati proprio sui bordi (stessa ora, lunghezza
 * diversa), che è esattamente il caso in cui si decide se due prenotazioni si
 * toccano o si sovrappongono.
 */
export function normalizzaIstante(istante: string): string {
  return istante.slice(0, 16);
}

/** Due fasce si sovrappongono se una inizia prima che l'altra sia finita. */
export function sovrapposte(a: Fascia, b: Fascia): boolean {
  return (
    normalizzaIstante(a.inizio) < normalizzaIstante(b.fine) &&
    normalizzaIstante(b.inizio) < normalizzaIstante(a.fine)
  );
}

/** Quante prenotazioni già confermate occupano la fascia richiesta. */
export function postiOccupati(
  esistenti: (Fascia & { stato?: string; id?: string })[],
  richiesta: Fascia,
  escludiId?: string
): number {
  return esistenti.filter(
    (p) =>
      (p.stato ?? "confermata") === "confermata" &&
      (!escludiId || p.id !== escludiId) &&
      sovrapposte(p, richiesta)
  ).length;
}

export type EsitoValidazione = { ok: true; inizio: string; fine: string } | { errore: string };

/** Durata minima sensata: sotto ai 15 minuti è quasi sempre un errore di battitura. */
export const DURATA_MINIMA_MINUTI = 15;

/**
 * Verifica una richiesta di prenotazione contro le regole dello spazio e
 * contro le prenotazioni già presenti, e restituisce la fascia pronta da
 * salvare. Un solo punto di verità, così l'interfaccia dell'amministratore e
 * quella del condòmino non possono divergere.
 */
export function validaPrenotazione(params: {
  spazio: SpazioPrenotabile;
  giorno: string;
  oraInizio: string;
  oraFine: string;
  esistenti: (Fascia & { stato?: string; id?: string })[];
  /** Istante corrente come "aaaa-mm-ggThh:mm", nella stessa convenzione locale. */
  adesso: string;
  /** Prenotazione in modifica, da non contare tra le occupanti. */
  escludiId?: string;
}): EsitoValidazione {
  const { spazio, giorno, esistenti, adesso, escludiId } = params;

  if (!spazio.attivo) {
    return { errore: `Lo spazio "${spazio.nome}" non è al momento prenotabile.` };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(giorno)) {
    return { errore: "Scegli il giorno della prenotazione." };
  }

  const inizioMin = minutiDaOra(params.oraInizio);
  const fineMin = minutiDaOra(params.oraFine);
  if (inizioMin === null || fineMin === null) {
    return { errore: "Indica l'ora di inizio e quella di fine." };
  }
  if (fineMin - inizioMin < DURATA_MINIMA_MINUTI) {
    return { errore: "L'ora di fine deve essere almeno un quarto d'ora dopo quella di inizio." };
  }

  const apertura = minutiDaOra(spazio.ora_apertura) ?? 0;
  const chiusura = minutiDaOra(spazio.ora_chiusura) ?? 24 * 60;
  if (inizioMin < apertura || fineMin > chiusura) {
    return {
      errore: `"${spazio.nome}" è prenotabile dalle ${spazio.ora_apertura.slice(
        0,
        5
      )} alle ${spazio.ora_chiusura.slice(0, 5)}.`,
    };
  }

  if (spazio.durata_massima_ore && fineMin - inizioMin > spazio.durata_massima_ore * 60) {
    return {
      errore: `La prenotazione non può superare ${spazio.durata_massima_ore} ${
        spazio.durata_massima_ore === 1 ? "ora" : "ore"
      }.`,
    };
  }

  const inizio = componiIstante(giorno, params.oraInizio);
  const fine = componiIstante(giorno, params.oraFine);

  if (normalizzaIstante(inizio) < normalizzaIstante(adesso)) {
    return { errore: "Non si può prenotare una fascia oraria già passata." };
  }

  const occupati = postiOccupati(esistenti, { inizio, fine }, escludiId);
  if (occupati >= spazio.posti) {
    return {
      errore:
        spazio.posti === 1
          ? "Lo spazio è già prenotato in questa fascia oraria."
          : `Tutti i ${spazio.posti} posti sono già prenotati in questa fascia oraria.`,
    };
  }

  return { ok: true, inizio, fine };
}

/**
 * Posti ancora liberi nella fascia indicata: serve a mostrare la disponibilità
 * accanto allo spazio senza ripetere il conteggio in ogni pagina.
 */
export function postiLiberi(
  spazio: { posti: number },
  esistenti: (Fascia & { stato?: string })[],
  richiesta: Fascia
): number {
  return Math.max(spazio.posti - postiOccupati(esistenti, richiesta), 0);
}
