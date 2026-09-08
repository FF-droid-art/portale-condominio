/**
 * Calcolo dei quorum dell'assemblea di condominio (art. 1136 c.c.).
 *
 * Le soglie NON sono inventate: sono quelle del codice civile, verificate sul
 * testo dell'articolo. Riassunto di quanto implementato qui sotto:
 *
 *  - Quorum COSTITUTIVO (art. 1136 c. 1 e 3)
 *      1ª convocazione: intervenuti che rappresentino i 2/3 del valore
 *        dell'edificio E la maggioranza dei partecipanti al condominio.
 *      2ª convocazione: almeno 1/3 del valore dell'edificio E 1/3 dei
 *        partecipanti al condominio.
 *
 *  - Quorum DELIBERATIVO
 *      "semplice" (art. 1136 c. 2 e 3)
 *        1ª: maggioranza degli intervenuti + almeno 1/2 del valore.
 *        2ª: maggioranza degli intervenuti + almeno 1/3 del valore.
 *      "qualificata_intervenuti" (art. 1136 c. 4): le delibere su nomina/revoca
 *        dell'amministratore, liti attive e passive che esorbitano dalle sue
 *        attribuzioni, ricostruzione dell'edificio o riparazioni straordinarie
 *        di notevole entità (e i casi degli artt. 1117-quater, 1120 c. 2,
 *        1122-ter, 1135 c. 3) vanno SEMPRE approvate con la maggioranza del
 *        secondo comma: maggioranza degli intervenuti + almeno 1/2 del valore,
 *        anche in seconda convocazione.
 *      "innovazioni" (art. 1136 c. 5): maggioranza degli intervenuti + almeno
 *        i 2/3 del valore dell'edificio, in entrambe le convocazioni.
 *      "unanimita": tutti i partecipanti al condominio e l'intero valore
 *        dell'edificio (es. atti che incidono sui diritti individuali).
 *
 * Il risultato resta un ausilio all'amministratore: il codice civile prevede
 * casi particolari (regolamento contrattuale, condominio parziale, unità
 * escluse da una tabella specifica) che questo calcolo non conosce. Di qui il
 * disclaimer mostrato in interfaccia, vedi DISCLAIMER_QUORUM.
 */

export const DISCLAIMER_QUORUM =
  "Quorum calcolato in automatico sui dati inseriti nel portale (millesimi, presenze, deleghe, voti). " +
  "Serve come ausilio, non sostituisce la verifica dell'amministratore: per le delibere più delicate " +
  "conferma sempre le maggioranze con un legale.";

export type Convocazione = 1 | 2;

export type TipoMaggioranza =
  | "semplice"
  | "qualificata_intervenuti"
  | "innovazioni"
  | "unanimita";

export const TIPI_MAGGIORANZA: TipoMaggioranza[] = [
  "semplice",
  "qualificata_intervenuti",
  "innovazioni",
  "unanimita",
];

export function isTipoMaggioranza(valore: string): valore is TipoMaggioranza {
  return (TIPI_MAGGIORANZA as string[]).includes(valore);
}

/** Confronto tra numeri decimali: i millesimi arrivano da somme di numeric(6,3). */
const EPS = 1e-6;

/** Una delle due componenti (teste o millesimi) di un quorum. */
export type ComponenteQuorum = {
  /** Valore raggiunto. */
  valore: number;
  /** Valore minimo necessario. */
  richiesto: number;
  /** Totale su cui è calcolata la frazione (partecipanti, intervenuti, millesimi dell'edificio). */
  base: number;
  raggiunto: boolean;
};

export type EsitoQuorum = {
  raggiunto: boolean;
  teste: ComponenteQuorum;
  millesimi: ComponenteQuorum;
};

/**
 * Soglia sulle teste: quando la legge chiede la "maggioranza" serve superare
 * strettamente la frazione, quindi il minimo intero è floor(base·f)+1; quando
 * chiede "almeno un terzo" basta raggiungerla, quindi ceil(base·f).
 */
function testeRichieste(base: number, frazione: number, stretta: boolean): number {
  if (base <= 0) return 0;
  return stretta ? Math.floor(base * frazione) + 1 : Math.ceil(base * frazione);
}

function componente(
  valore: number,
  richiesto: number,
  base: number
): ComponenteQuorum {
  return { valore, richiesto, base, raggiunto: base > 0 && valore + EPS >= richiesto };
}

/* -------------------------------------------------------------------------
   Quorum costitutivo
   ------------------------------------------------------------------------- */

const SOGLIE_COSTITUTIVE: Record<
  Convocazione,
  { frazioneTeste: number; testeStrette: boolean; frazioneMillesimi: number; riferimento: string }
> = {
  1: {
    frazioneTeste: 1 / 2,
    testeStrette: true,
    frazioneMillesimi: 2 / 3,
    riferimento: "art. 1136 c. 1 c.c.",
  },
  2: {
    frazioneTeste: 1 / 3,
    testeStrette: false,
    frazioneMillesimi: 1 / 3,
    riferimento: "art. 1136 c. 3 c.c.",
  },
};

export type DatiCostitutivo = {
  /** Unità che compongono il condominio. */
  unitaTotali: number;
  /** Millesimi complessivi dell'edificio. */
  millesimiTotali: number;
  /** Unità intervenute (presenti di persona, da remoto o rappresentate per delega). */
  unitaIntervenute: number;
  /** Millesimi rappresentati dalle unità intervenute. */
  millesimiIntervenuti: number;
  convocazione: Convocazione;
};

export function calcolaQuorumCostitutivo(dati: DatiCostitutivo): EsitoQuorum & {
  riferimento: string;
} {
  const soglia = SOGLIE_COSTITUTIVE[dati.convocazione];

  const teste = componente(
    dati.unitaIntervenute,
    testeRichieste(dati.unitaTotali, soglia.frazioneTeste, soglia.testeStrette),
    dati.unitaTotali
  );
  const millesimi = componente(
    dati.millesimiIntervenuti,
    dati.millesimiTotali * soglia.frazioneMillesimi,
    dati.millesimiTotali
  );

  return {
    raggiunto: teste.raggiunto && millesimi.raggiunto,
    teste,
    millesimi,
    riferimento: soglia.riferimento,
  };
}

/* -------------------------------------------------------------------------
   Quorum deliberativo
   ------------------------------------------------------------------------- */

type RegolaDeliberativa = {
  etichetta: string;
  descrizione: string;
  /** Base su cui si misura la maggioranza per teste. */
  baseTeste: "intervenuti" | "partecipanti";
  frazioneTeste: number;
  testeStrette: boolean;
  /** Frazione del valore dell'edificio richiesta, per convocazione. */
  frazioneMillesimi: Record<Convocazione, number>;
  riferimento: Record<Convocazione, string>;
};

export const REGOLE_DELIBERATIVE: Record<TipoMaggioranza, RegolaDeliberativa> = {
  semplice: {
    etichetta: "Maggioranza semplice",
    descrizione:
      "Maggioranza degli intervenuti e almeno metà del valore dell'edificio (un terzo in seconda convocazione).",
    baseTeste: "intervenuti",
    frazioneTeste: 1 / 2,
    testeStrette: true,
    frazioneMillesimi: { 1: 1 / 2, 2: 1 / 3 },
    riferimento: { 1: "art. 1136 c. 2 c.c.", 2: "art. 1136 c. 3 c.c." },
  },
  qualificata_intervenuti: {
    etichetta: "Maggioranza qualificata degli intervenuti",
    descrizione:
      "Nomina e revoca dell'amministratore, liti, ricostruzione o riparazioni straordinarie di notevole entità: sempre maggioranza degli intervenuti e almeno metà del valore dell'edificio, anche in seconda convocazione.",
    baseTeste: "intervenuti",
    frazioneTeste: 1 / 2,
    testeStrette: true,
    frazioneMillesimi: { 1: 1 / 2, 2: 1 / 2 },
    riferimento: { 1: "art. 1136 c. 2 e 4 c.c.", 2: "art. 1136 c. 4 c.c." },
  },
  innovazioni: {
    etichetta: "Innovazioni",
    descrizione:
      "Maggioranza degli intervenuti e almeno due terzi del valore dell'edificio, in entrambe le convocazioni.",
    baseTeste: "intervenuti",
    frazioneTeste: 1 / 2,
    testeStrette: true,
    frazioneMillesimi: { 1: 2 / 3, 2: 2 / 3 },
    riferimento: { 1: "art. 1136 c. 5 c.c.", 2: "art. 1136 c. 5 c.c." },
  },
  unanimita: {
    etichetta: "Unanimità",
    descrizione:
      "Consenso di tutti i partecipanti al condominio e dell'intero valore dell'edificio.",
    baseTeste: "partecipanti",
    frazioneTeste: 1,
    testeStrette: false,
    frazioneMillesimi: { 1: 1, 2: 1 },
    riferimento: { 1: "unanimità", 2: "unanimità" },
  },
};

export function etichettaMaggioranza(tipo: string): string {
  return isTipoMaggioranza(tipo) ? REGOLE_DELIBERATIVE[tipo].etichetta : tipo;
}

export type DatiDeliberativo = {
  tipoMaggioranza: string;
  convocazione: Convocazione;
  unitaTotali: number;
  millesimiTotali: number;
  unitaIntervenute: number;
  /** Numero di unità che hanno votato "favorevole". */
  favorevoliUnita: number;
  /** Millesimi favorevoli. */
  favorevoliMillesimi: number;
};

export function calcolaQuorumDeliberativo(dati: DatiDeliberativo): EsitoQuorum & {
  etichetta: string;
  riferimento: string;
} {
  const tipo: TipoMaggioranza = isTipoMaggioranza(dati.tipoMaggioranza)
    ? dati.tipoMaggioranza
    : "semplice";
  const regola = REGOLE_DELIBERATIVE[tipo];

  const baseTeste =
    regola.baseTeste === "intervenuti" ? dati.unitaIntervenute : dati.unitaTotali;

  const teste = componente(
    dati.favorevoliUnita,
    testeRichieste(baseTeste, regola.frazioneTeste, regola.testeStrette),
    baseTeste
  );
  const millesimi = componente(
    dati.favorevoliMillesimi,
    dati.millesimiTotali * regola.frazioneMillesimi[dati.convocazione],
    dati.millesimiTotali
  );

  return {
    raggiunto: teste.raggiunto && millesimi.raggiunto,
    teste,
    millesimi,
    etichetta: regola.etichetta,
    riferimento: regola.riferimento[dati.convocazione],
  };
}

/** Normalizza il valore letto dal database (smallint) in una convocazione valida. */
export function normalizzaConvocazione(valore: unknown): Convocazione {
  return Number(valore) === 2 ? 2 : 1;
}
