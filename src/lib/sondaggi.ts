/**
 * Aggregazione dei risultati di un sondaggio.
 *
 * Un sondaggio è una consultazione informale, fuori assemblea: non delibera
 * nulla e non ha valore legale. Per coerenza con il voto assembleare, però, la
 * risposta è espressa PER UNITÀ (una unità = una risposta) e l'amministratore
 * può scegliere se leggere il risultato per teste o pesato per millesimi:
 * sono gli stessi due criteri dell'art. 1136 c.c., così il sondaggio dà
 * un'indicazione realistica di come andrebbe la votazione vera.
 */

/** Oltre questa soglia non è più una consultazione rapida ma un questionario. */
export const MAX_OPZIONI_SONDAGGIO = 8;

export type OpzioneSondaggio = { id: string; testo: string; ordine: number };

/** Conteggi aggregati per opzione, come restituiti dalla funzione SQL. */
export type ConteggioOpzione = { opzione_id: string; risposte: number; millesimi: number };

export type RisultatoOpzione = {
  id: string;
  testo: string;
  risposte: number;
  millesimi: number;
  /** Percentuale sul totale delle risposte (teste), 0 se nessuno ha risposto. */
  percentualeRisposte: number;
  /** Percentuale sui millesimi che hanno risposto, 0 se nessuno ha risposto. */
  percentualeMillesimi: number;
  /** Percentuale sui millesimi dell'intero edificio (quanto pesa davvero). */
  percentualeEdificio: number;
  /** L'opzione è (o pareggia) la più votata secondo il criterio scelto. */
  inTesta: boolean;
};

export type RisultatiSondaggio = {
  opzioni: RisultatoOpzione[];
  risposteTotali: number;
  millesimiTotaliRisposte: number;
  /** Quota di partecipazione sul totale delle unità, in percentuale. */
  partecipazioneUnita: number;
  /** Quota di partecipazione sui millesimi dell'edificio, in percentuale. */
  partecipazioneMillesimi: number;
};

function percentuale(parte: number, totale: number): number {
  if (totale <= 0) return 0;
  return (parte / totale) * 100;
}

export function aggregaRisultati(params: {
  opzioni: OpzioneSondaggio[];
  conteggi: ConteggioOpzione[];
  /** Unità che compongono il condominio. */
  unitaTotali: number;
  /** Millesimi complessivi dell'edificio. */
  millesimiTotali: number;
  /** Criterio con cui individuare l'opzione in testa. */
  ponderato: boolean;
}): RisultatiSondaggio {
  const { opzioni, conteggi, unitaTotali, millesimiTotali, ponderato } = params;

  const perOpzione = new Map(conteggi.map((c) => [c.opzione_id, c]));

  const risposteTotali = conteggi.reduce((somma, c) => somma + c.risposte, 0);
  const millesimiTotaliRisposte = conteggi.reduce((somma, c) => somma + c.millesimi, 0);

  const base = opzioni
    .slice()
    .sort((a, b) => a.ordine - b.ordine || a.testo.localeCompare(b.testo, "it"))
    .map((o) => {
      const c = perOpzione.get(o.id);
      const risposte = c?.risposte ?? 0;
      const millesimi = c?.millesimi ?? 0;
      return {
        id: o.id,
        testo: o.testo,
        risposte,
        millesimi,
        percentualeRisposte: percentuale(risposte, risposteTotali),
        percentualeMillesimi: percentuale(millesimi, millesimiTotaliRisposte),
        percentualeEdificio: percentuale(millesimi, millesimiTotali),
      };
    });

  const massimo = base.reduce(
    (max, o) => Math.max(max, ponderato ? o.millesimi : o.risposte),
    0
  );

  return {
    opzioni: base.map((o) => ({
      ...o,
      inTesta: massimo > 0 && (ponderato ? o.millesimi : o.risposte) === massimo,
    })),
    risposteTotali,
    millesimiTotaliRisposte,
    partecipazioneUnita: percentuale(risposteTotali, unitaTotali),
    partecipazioneMillesimi: percentuale(millesimiTotaliRisposte, millesimiTotali),
  };
}

/** Un sondaggio è ancora rispondibile solo se aperto e non scaduto. */
export function sondaggioAperto(
  sondaggio: { stato: string; scadenza: string | null },
  adesso: Date = new Date()
): boolean {
  if (sondaggio.stato !== "aperto") return false;
  if (!sondaggio.scadenza) return true;
  return new Date(sondaggio.scadenza).getTime() > adesso.getTime();
}

/** Motivo per cui un sondaggio non è più rispondibile, da mostrare in interfaccia. */
export function motivoChiusura(
  sondaggio: { stato: string; scadenza: string | null },
  adesso: Date = new Date()
): "chiuso_manualmente" | "scaduto" | null {
  if (sondaggio.stato !== "aperto") return "chiuso_manualmente";
  if (sondaggio.scadenza && new Date(sondaggio.scadenza).getTime() <= adesso.getTime()) {
    return "scaduto";
  }
  return null;
}
