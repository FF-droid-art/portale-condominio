/**
 * Calendario condominiale: una sola vista per tutto ciò che ha una data.
 *
 * Non c'è nulla da creare qui dentro — assemblee, manutenzioni, prenotazioni e
 * scadenze si gestiscono ciascuna nella propria sezione. Questo modulo si
 * limita a mettere gli eventi sulla stessa riga del tempo, che è l'unica cosa
 * che le quattro sezioni non possono fare da sole.
 *
 * DATE. Tutto viene ridotto a un giorno "aaaa-mm-gg" letto dalla stringa, mai
 * ricostruito con `new Date(...).getDate()`: gli istanti salvati dal portale
 * sono orologi da parete (vedi `@/lib/prenotazioni`) e su un server in UTC il
 * fuso sposterebbe di un giorno tutto ciò che sta vicino alla mezzanotte.
 * L'unico "adesso" ammesso arriva da `@/lib/fuso`.
 */

import { oggiLocale } from "@/lib/fuso";
import { giornoDi, oraDi } from "@/lib/prenotazioni";

export type TipoEventoCalendario =
  | "assemblea"
  | "manutenzione"
  | "prenotazione"
  | "scadenza_pagamento";

export type EventoCalendario = {
  /** Giorno dell'evento, "aaaa-mm-gg". */
  data: string;
  /** Ora "hh:mm" quando l'evento ne ha una; le scadenze no. */
  ora: string | null;
  tipo: TipoEventoCalendario;
  titolo: string;
  sottotitolo: string | null;
  href: string | null;
};

export const ETICHETTE_TIPO_EVENTO: Record<TipoEventoCalendario, string> = {
  assemblea: "Assemblea",
  manutenzione: "Manutenzione",
  prenotazione: "Prenotazione",
  scadenza_pagamento: "Scadenza di pagamento",
};

/* -------------------------------------------------------------------------
   Sorgenti
   ------------------------------------------------------------------------- */

export type AssembleaCalendario = {
  id: string;
  /** `assemblee.data_assemblea`. */
  dataOra: string;
  tipo: string;
  stato: string;
  condominio: string | null;
};

export type ManutenzioneCalendario = {
  id: string;
  /** `manutenzioni_programmate.data_prossima`. */
  dataProssima: string;
  titolo: string;
  stato: string;
  condominio: string | null;
  fornitore: string | null;
};

export type PrenotazioneCalendario = {
  id: string;
  /** `prenotazioni_spazi.inizio` / `.fine`. */
  inizio: string;
  fine: string;
  stato: string;
  spazio: string | null;
  unita: string | null;
};

export type ScadenzaCalendario = {
  id: string;
  /** `ripartizioni.data_scadenza`. */
  dataScadenza: string | null;
  statoPagamento: string;
  importo: number;
  descrizione: string;
  unita: string | null;
};

export type SorgentiCalendario = {
  assemblee?: AssembleaCalendario[];
  manutenzioni?: ManutenzioneCalendario[];
  prenotazioni?: PrenotazioneCalendario[];
  ripartizioni?: ScadenzaCalendario[];
  /** Oggi, per marcare cosa è passato; non filtra nulla. */
  oggi?: string;
  /** Prefisso dei collegamenti: "/admin" o "/area-riservata". */
  area?: "admin" | "condomino";
};

const FORMATO_GIORNO = /^\d{4}-\d{2}-\d{2}$/;

function giornoValido(valore: string | null | undefined): string | null {
  if (!valore) return null;
  const giorno = giornoDi(valore);
  return FORMATO_GIORNO.test(giorno) ? giorno : null;
}

/**
 * Fonde le quattro sorgenti in un unico elenco ordinato nel tempo.
 *
 * Che cosa entra:
 *  - le assemblee, tutte: anche quelle già concluse fanno parte della storia
 *    del condominio e servono a capire "quando ci siamo visti l'ultima volta";
 *  - le manutenzioni ancora programmate (le completate e le annullate no: sono
 *    archivio, non calendario);
 *  - le prenotazioni confermate (le annullate no: la fascia è tornata libera);
 *  - le scadenze delle quote non ancora saldate.
 */
export function raccogliEventi(sorgenti: SorgentiCalendario): EventoCalendario[] {
  const area = sorgenti.area ?? "admin";
  const radice = area === "admin" ? "/admin" : "/area-riservata";
  const eventi: EventoCalendario[] = [];

  for (const a of sorgenti.assemblee ?? []) {
    const data = giornoValido(a.dataOra);
    if (!data) continue;
    eventi.push({
      data,
      ora: oraDi(a.dataOra) || null,
      tipo: "assemblea",
      titolo: `Assemblea ${a.tipo}`,
      sottotitolo: a.condominio,
      href: `${radice}/assemblee/${a.id}`,
    });
  }

  for (const m of sorgenti.manutenzioni ?? []) {
    if (m.stato !== "programmata") continue;
    const data = giornoValido(m.dataProssima);
    if (!data) continue;
    eventi.push({
      data,
      ora: null,
      tipo: "manutenzione",
      titolo: m.titolo,
      sottotitolo: [m.condominio, m.fornitore].filter(Boolean).join(" · ") || null,
      // Lo scadenzario è solo dell'amministratore: al condòmino la voce resta
      // visibile ma non porta da nessuna parte.
      href: area === "admin" ? "/admin/manutenzioni" : null,
    });
  }

  for (const p of sorgenti.prenotazioni ?? []) {
    if (p.stato !== "confermata") continue;
    const data = giornoValido(p.inizio);
    if (!data) continue;
    const fascia = [oraDi(p.inizio), oraDi(p.fine)].filter(Boolean).join(" – ");
    eventi.push({
      data,
      ora: oraDi(p.inizio) || null,
      tipo: "prenotazione",
      titolo: p.spazio ?? "Spazio comune",
      sottotitolo: [fascia, p.unita].filter(Boolean).join(" · ") || null,
      href: `${radice}/spazi`,
    });
  }

  for (const r of sorgenti.ripartizioni ?? []) {
    if (r.statoPagamento === "pagato") continue;
    const data = giornoValido(r.dataScadenza);
    if (!data) continue;
    eventi.push({
      data,
      ora: null,
      tipo: "scadenza_pagamento",
      titolo: r.descrizione,
      sottotitolo: r.unita,
      href: area === "admin" ? "/admin/spese" : "/area-riservata",
    });
  }

  return ordina(eventi);
}

/**
 * Ordine di lettura: per giorno; dentro il giorno, prima ciò che vale per
 * l'intera giornata (scadenze e manutenzioni, che non hanno un'ora) e poi gli
 * appuntamenti veri in ordine di orario. È la convenzione di qualunque
 * calendario, e legge bene: "oggi scade la rata" sta sopra, "alle 18:30
 * assemblea" sta al suo posto nella giornata.
 */
function ordina(eventi: EventoCalendario[]): EventoCalendario[] {
  const peso: Record<TipoEventoCalendario, number> = {
    scadenza_pagamento: 0,
    manutenzione: 1,
    assemblea: 2,
    prenotazione: 3,
  };
  return eventi.slice().sort(
    (a, b) =>
      a.data.localeCompare(b.data) ||
      Number(Boolean(a.ora)) - Number(Boolean(b.ora)) ||
      (a.ora ?? "").localeCompare(b.ora ?? "") ||
      peso[a.tipo] - peso[b.tipo] ||
      a.titolo.localeCompare(b.titolo, "it")
  );
}

/* -------------------------------------------------------------------------
   Raggruppamenti per la resa
   ------------------------------------------------------------------------- */

/** Eventi indicizzati per giorno: è quel che serve alla griglia del mese. */
export function raggruppaPerGiorno(eventi: EventoCalendario[]): Map<string, EventoCalendario[]> {
  const mappa = new Map<string, EventoCalendario[]>();
  for (const evento of eventi) {
    const elenco = mappa.get(evento.data) ?? [];
    elenco.push(evento);
    mappa.set(evento.data, elenco);
  }
  return mappa;
}

export type GruppoMese = { mese: string; eventi: EventoCalendario[] };

/** Eventi divisi per mese "aaaa-mm", in ordine cronologico. */
export function raggruppaPerMese(eventi: EventoCalendario[]): GruppoMese[] {
  const mappa = new Map<string, EventoCalendario[]>();
  for (const evento of eventi) {
    const mese = evento.data.slice(0, 7);
    const elenco = mappa.get(mese) ?? [];
    elenco.push(evento);
    mappa.set(mese, elenco);
  }
  return [...mappa.entries()]
    .map(([mese, elenco]) => ({ mese, eventi: elenco }))
    .sort((a, b) => a.mese.localeCompare(b.mese));
}

/** I primi eventi da oggi in avanti, per l'elenco sotto il calendario. */
export function prossimiEventi(
  eventi: EventoCalendario[],
  oggi: string = oggiLocale(),
  limite = 10
): EventoCalendario[] {
  return eventi.filter((e) => e.data >= oggi).slice(0, limite);
}

/* -------------------------------------------------------------------------
   Griglia del mese
   ------------------------------------------------------------------------- */

const FORMATO_MESE = /^(\d{4})-(\d{2})$/;

/** Mese "aaaa-mm" di una data, o il mese corrente se la data non si legge. */
export function meseDi(data: string = oggiLocale()): string {
  return FORMATO_MESE.test(data.slice(0, 7)) ? data.slice(0, 7) : oggiLocale().slice(0, 7);
}

/** Mese precedente o successivo, restando nel formato "aaaa-mm". */
export function spostaMese(mese: string, delta: number): string {
  const m = FORMATO_MESE.exec(mese);
  if (!m) return meseDi();
  const totale = Number(m[1]) * 12 + (Number(m[2]) - 1) + delta;
  const anno = Math.floor(totale / 12);
  const indice = ((totale % 12) + 12) % 12;
  return `${anno}-${String(indice + 1).padStart(2, "0")}`;
}

export type GiornoGriglia = {
  data: string;
  /** Falso per i giorni di riempimento del mese precedente o successivo. */
  nelMese: boolean;
};

/**
 * Le settimane del mese, dal lunedì alla domenica.
 *
 * La griglia comincia sempre da un lunedì e finisce sempre di domenica, quindi
 * i bordi contengono qualche giorno dei mesi vicini: senza di essi le colonne
 * non resterebbero allineate ai nomi dei giorni. Le date sono composte in UTC
 * e stampate a mano, così la griglia è identica ovunque giri il codice.
 */
export function grigliaMese(mese: string): GiornoGriglia[][] {
  const m = FORMATO_MESE.exec(mese) ?? FORMATO_MESE.exec(meseDi());
  const anno = Number(m![1]);
  const indiceMese = Number(m![2]) - 1;

  const primo = new Date(Date.UTC(anno, indiceMese, 1));
  // getUTCDay(): 0 = domenica. Con la settimana che inizia di lunedì lo
  // scostamento della domenica è 6, non 0.
  const scostamento = (primo.getUTCDay() + 6) % 7;
  const inizio = new Date(Date.UTC(anno, indiceMese, 1 - scostamento));

  const settimane: GiornoGriglia[][] = [];
  const cursore = new Date(inizio);

  // Sei settimane coprono qualunque mese; l'ultima si scarta se è tutta fuori.
  for (let s = 0; s < 6; s++) {
    const settimana: GiornoGriglia[] = [];
    for (let g = 0; g < 7; g++) {
      settimana.push({
        data: cursore.toISOString().slice(0, 10),
        nelMese: cursore.getUTCMonth() === indiceMese && cursore.getUTCFullYear() === anno,
      });
      cursore.setUTCDate(cursore.getUTCDate() + 1);
    }
    if (settimane.length >= 4 && settimana.every((giorno) => !giorno.nelMese)) break;
    settimane.push(settimana);
  }

  return settimane;
}

const NOMI_MESE = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

/** "2026-09" -> "settembre 2026". */
export function nomeMese(mese: string): string {
  const m = FORMATO_MESE.exec(mese);
  if (!m) return mese;
  return `${NOMI_MESE[Number(m[2]) - 1] ?? mese} ${m[1]}`;
}

export const NOMI_GIORNI_SETTIMANA = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];
