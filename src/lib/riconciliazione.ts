/**
 * Riconciliazione bancaria: import dell'estratto conto in CSV e abbinamento
 * automatico degli accrediti alle quote ancora aperte.
 *
 * PERCHÉ UN CSV E NON LA BANCA. Il collegamento diretto al conto (open banking
 * / PSD2) richiede un aggregatore bancario a pagamento. Qui si parte da quello
 * che ogni home banking sa già fare: esportare i movimenti in CSV. Il file lo
 * scarica l'amministratore e lo carica nel portale.
 *
 * FORMATI ACCETTATI. Non esiste un CSV bancario standard, quindi il lettore è
 * volutamente tollerante e riconosce le forme più diffuse in Italia:
 *  - separatore `;` o `,` (rilevato da papaparse);
 *  - intestazioni in italiano o inglese, con o senza accenti e maiuscole:
 *    data / data valuta / data contabile / data operazione / date;
 *    importo / ammontare / amount, oppure la coppia dare+avere
 *    (entrate/uscite, accrediti/addebiti);
 *    descrizione / causale / operazione / description;
 *    riferimento / cro / trn / numero (facoltativo);
 *  - date scritte gg/mm/aaaa, gg-mm-aaaa, gg.mm.aaaa o aaaa-mm-gg;
 *  - importi scritti all'italiana ("1.234,56"), all'inglese ("1234.56"), con
 *    il segno davanti o dietro ("1.234,56-") e con eventuale simbolo di valuta.
 * Il segno è normalizzato così: positivo = accredito (soldi entrati).
 *
 * COSA NON FA. L'abbinamento automatico è deliberatamente prudente: propone
 * solo quando c'è UNA sola quota compatibile, e non tocca mai il database da
 * solo. Se le candidate sono due, la coppia finisce tra le ambigue e decide
 * l'amministratore. Meglio dieci righe da guardare a mano che un pagamento
 * attribuito all'unità sbagliata.
 */

import Papa from "papaparse";

export type MovimentoGrezzo = {
  /** Data del movimento come "aaaa-mm-gg". */
  data: string;
  /** Positivo = accredito, negativo = addebito. */
  importo: number;
  descrizione: string;
  riferimento: string | null;
  /** Chiave di deduplica: reimportare lo stesso file non crea doppioni. */
  hash: string;
};

export type ErroreRigaCsv = {
  /** Numero di riga nel file, intestazione compresa: è quello che si vede in Excel. */
  riga: number;
  messaggio: string;
};

export type EsitoLettura = {
  movimenti: MovimentoGrezzo[];
  errori: ErroreRigaCsv[];
  /** Colonne riconosciute, da mostrare all'utente per fargli verificare la lettura. */
  colonne: { data: string | null; importo: string | null; descrizione: string | null };
};

/* -------------------------------------------------------------------------
   Riconoscimento delle colonne
   ------------------------------------------------------------------------- */

/**
 * Riduce un'intestazione a lettere e numeri: "Data valuta " -> "datavaluta".
 *
 * La normalizzazione NFD stacca gli accenti dalle lettere e il filtro
 * successivo li porta via insieme a tutto il resto, come già in
 * `segmentoNomeFile`: "Descrizione operazione" e "descrizione_operazione"
 * diventano così la stessa cosa.
 */
function chiave(testo: string): string {
  return testo
    .normalize("NFD")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const NOMI_DATA = [
  "datavaluta",
  "datacontabile",
  "dataoperazione",
  "dataregistrazione",
  "data",
  "date",
  "valuta",
];
const NOMI_IMPORTO = ["importo", "importoeur", "ammontare", "amount", "importooperazione"];
const NOMI_DARE = ["dare", "uscite", "uscita", "addebiti", "addebito", "debit"];
const NOMI_AVERE = ["avere", "entrate", "entrata", "accrediti", "accredito", "credit"];
const NOMI_DESCRIZIONE = [
  "descrizioneoperazione",
  "descrizione",
  "causale",
  "causaleabi",
  "operazione",
  "dettagli",
  "description",
  "note",
];
const NOMI_RIFERIMENTO = ["riferimento", "cro", "trn", "crotrn", "numero", "idoperazione"];

/**
 * Sceglie la colonna che meglio corrisponde a uno dei nomi attesi.
 *
 * I nomi sono in ordine di specificità decrescente ("data valuta" prima di
 * "data"): un estratto conto con entrambe le colonne deve usare quella giusta,
 * non la prima che capita.
 */
function trovaColonna(intestazioni: string[], attesi: string[]): string | null {
  const chiavi = intestazioni.map((h) => ({ originale: h, chiave: chiave(h) }));
  for (const atteso of attesi) {
    const esatta = chiavi.find((c) => c.chiave === atteso);
    if (esatta) return esatta.originale;
  }
  for (const atteso of attesi) {
    const parziale = chiavi.find((c) => c.chiave.includes(atteso));
    if (parziale) return parziale.originale;
  }
  return null;
}

/* -------------------------------------------------------------------------
   Lettura dei valori
   ------------------------------------------------------------------------- */

const FORMATO_ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})/;
const FORMATO_ITA = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/;

/** Normalizza una data in "aaaa-mm-gg"; `null` se non è interpretabile. */
export function leggiData(valore: string): string | null {
  const testo = valore.trim();
  if (!testo) return null;

  const iso = FORMATO_ISO.exec(testo);
  if (iso) return componiData(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const ita = FORMATO_ITA.exec(testo);
  if (ita) {
    // Un anno a due cifre di un estratto conto è sempre di questo secolo:
    // i conti correnti non esportano movimenti del 1926.
    const anno = Number(ita[3]);
    return componiData(anno < 100 ? 2000 + anno : anno, Number(ita[2]), Number(ita[1]));
  }
  return null;
}

function componiData(anno: number, mese: number, giorno: number): string | null {
  if (mese < 1 || mese > 12 || giorno < 1 || giorno > 31) return null;
  const d = new Date(Date.UTC(anno, mese - 1, giorno));
  if (d.getUTCMonth() !== mese - 1 || d.getUTCDate() !== giorno) return null;
  return `${anno}-${String(mese).padStart(2, "0")}-${String(giorno).padStart(2, "0")}`;
}

/**
 * Normalizza un importo scritto in una qualsiasi delle forme che si trovano
 * negli estratti conto; `null` se non è un numero.
 *
 * Il punto è capire quale separatore è quello decimale: se ci sono entrambi,
 * decimale è l'ultimo che compare; se ce n'è uno solo, è decimale quando
 * separa esattamente due cifre finali (1.234 sono milleduecentotrentaquattro
 * euro, 1.23 è un euro e ventitré).
 */
export function leggiImporto(valore: string): number | null {
  let testo = valore.trim().replace(/[€$£\s ]/g, "");
  if (!testo) return null;

  // Segno posposto ("1.234,56-") o importo tra parentesi ("(1.234,56)").
  let negativo = false;
  if (testo.endsWith("-")) {
    negativo = true;
    testo = testo.slice(0, -1);
  }
  if (testo.startsWith("(") && testo.endsWith(")")) {
    negativo = true;
    testo = testo.slice(1, -1);
  }
  if (testo.startsWith("-")) {
    negativo = true;
    testo = testo.slice(1);
  } else if (testo.startsWith("+")) {
    testo = testo.slice(1);
  }
  if (!/^[\d.,]+$/.test(testo)) return null;

  const ultimaVirgola = testo.lastIndexOf(",");
  const ultimoPunto = testo.lastIndexOf(".");
  let normalizzato: string;

  if (ultimaVirgola >= 0 && ultimoPunto >= 0) {
    const decimale = ultimaVirgola > ultimoPunto ? "," : ".";
    const migliaia = decimale === "," ? "." : ",";
    normalizzato = testo.split(migliaia).join("").replace(decimale, ".");
  } else if (ultimaVirgola >= 0 || ultimoPunto >= 0) {
    const posizione = Math.max(ultimaVirgola, ultimoPunto);
    const decimali = testo.length - posizione - 1;
    normalizzato =
      decimali === 3 && posizione > 0
        ? testo.slice(0, posizione) + testo.slice(posizione + 1) // separatore di migliaia
        : testo.slice(0, posizione) + "." + testo.slice(posizione + 1);
  } else {
    normalizzato = testo;
  }

  const numero = Number(normalizzato);
  if (!Number.isFinite(numero)) return null;
  return negativo ? -numero : numero;
}

/**
 * Impronta di un movimento, per non reimportare due volte la stessa riga.
 *
 * L'indice di ripetizione serve ai casi legittimi in cui la stessa riga compare
 * davvero due volte nell'estratto (due bonifici identici lo stesso giorno):
 * senza di esso il secondo verrebbe scambiato per un doppione e scartato.
 */
export function impronta(
  m: { data: string; importo: number; descrizione: string; riferimento: string | null },
  ripetizione = 0
): string {
  const testo = [
    m.data,
    m.importo.toFixed(2),
    chiave(m.descrizione).slice(0, 80),
    m.riferimento ? chiave(m.riferimento) : "",
    ripetizione ? `#${ripetizione}` : "",
  ].join("|");

  // FNV-1a a 32 bit: deterministica, sincrona e senza dipendenze. Non serve
  // resistenza crittografica, serve che la stessa riga dia sempre la stessa
  // chiave; la stringa di partenza resta nel valore per ridurre le collisioni.
  let h = 0x811c9dc5;
  for (let i = 0; i < testo.length; i++) {
    h ^= testo.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${m.data}-${h.toString(16).padStart(8, "0")}`;
}

/** Numero massimo di righe accettate in un colpo solo. */
export const MAX_MOVIMENTI = 5000;

export function parseEstrattoContoCsv(testo: string): EsitoLettura {
  const vuoto: EsitoLettura = {
    movimenti: [],
    errori: [],
    colonne: { data: null, importo: null, descrizione: null },
  };

  if (!testo.trim()) {
    return { ...vuoto, errori: [{ riga: 0, messaggio: "Il file è vuoto." }] };
  }

  const risultato = Papa.parse<Record<string, string>>(testo.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const intestazioni = (risultato.meta.fields ?? []).filter(Boolean);
  if (!intestazioni.length) {
    return {
      ...vuoto,
      errori: [
        {
          riga: 1,
          messaggio: "Non ho trovato la riga di intestazione con i nomi delle colonne.",
        },
      ],
    };
  }

  const colData = trovaColonna(intestazioni, NOMI_DATA);
  const colImporto = trovaColonna(intestazioni, NOMI_IMPORTO);
  const colDare = trovaColonna(intestazioni, NOMI_DARE);
  const colAvere = trovaColonna(intestazioni, NOMI_AVERE);
  const colDescrizione = trovaColonna(intestazioni, NOMI_DESCRIZIONE);
  const colRiferimento = trovaColonna(intestazioni, NOMI_RIFERIMENTO);

  const colonne = {
    data: colData,
    importo: colImporto ?? (colAvere || colDare ? `${colDare ?? "—"} / ${colAvere ?? "—"}` : null),
    descrizione: colDescrizione,
  };

  const errori: ErroreRigaCsv[] = [];
  if (!colData) {
    errori.push({ riga: 1, messaggio: "Manca una colonna con la data del movimento." });
  }
  if (!colImporto && !colDare && !colAvere) {
    errori.push({
      riga: 1,
      messaggio: "Manca una colonna con l'importo (o la coppia dare/avere).",
    });
  }
  if (errori.length) return { ...vuoto, colonne, errori };

  const righe = risultato.data;
  if (righe.length > MAX_MOVIMENTI) {
    return {
      ...vuoto,
      colonne,
      errori: [
        {
          riga: 1,
          messaggio: `Il file contiene ${righe.length} righe: il massimo è ${MAX_MOVIMENTI}. Esporta un periodo più breve.`,
        },
      ],
    };
  }

  const movimenti: MovimentoGrezzo[] = [];
  const ripetizioni = new Map<string, number>();

  righe.forEach((riga, i) => {
    const numeroRiga = i + 2; // +1 per l'intestazione, +1 perché si conta da uno
    const data = leggiData(String(riga[colData!] ?? ""));
    if (!data) {
      errori.push({ riga: numeroRiga, messaggio: "Data mancante o non riconosciuta." });
      return;
    }

    const importo = leggiImportoRiga(riga, colImporto, colDare, colAvere);
    if (importo === null) {
      errori.push({ riga: numeroRiga, messaggio: "Importo mancante o non riconosciuto." });
      return;
    }
    // Una riga a zero non è un movimento: di solito è un totale o un separatore.
    if (importo === 0) return;

    const descrizione = String(riga[colDescrizione ?? ""] ?? "").trim();
    const riferimento = colRiferimento ? String(riga[colRiferimento] ?? "").trim() || null : null;

    const base = { data, importo, descrizione, riferimento };
    const chiaveBase = impronta(base);
    const ripetizione = ripetizioni.get(chiaveBase) ?? 0;
    ripetizioni.set(chiaveBase, ripetizione + 1);

    movimenti.push({ ...base, hash: impronta(base, ripetizione) });
  });

  movimenti.sort((a, b) => a.data.localeCompare(b.data) || a.hash.localeCompare(b.hash));

  return { movimenti, errori, colonne };
}

function leggiImportoRiga(
  riga: Record<string, string>,
  colImporto: string | null,
  colDare: string | null,
  colAvere: string | null
): number | null {
  if (colImporto) {
    const valore = leggiImporto(String(riga[colImporto] ?? ""));
    if (valore !== null) return valore;
  }
  // Colonne separate: l'avere è quel che entra, il dare quel che esce. Il
  // segno nella colonna dare viene ignorato, perché alcune banche lo scrivono
  // e altre no: conta la colonna in cui il numero si trova.
  const avere = colAvere ? leggiImporto(String(riga[colAvere] ?? "")) : null;
  if (avere !== null && avere !== 0) return Math.abs(avere);
  const dare = colDare ? leggiImporto(String(riga[colDare] ?? "")) : null;
  if (dare !== null && dare !== 0) return -Math.abs(dare);
  if (avere === 0 || dare === 0) return 0;
  return null;
}

/* -------------------------------------------------------------------------
   Abbinamento
   ------------------------------------------------------------------------- */

export type RipartizioneAperta = {
  id: string;
  unitaId: string;
  identificativo: string;
  /** Nominativi dei soggetti collegati all'unità: chi firma il bonifico. */
  nominativi: string[];
  importoDovuto: number;
  dataScadenza: string | null;
  codiceAvviso: string | null;
};

export type Confidenza = "alta" | "media";

export type Abbinamento = {
  movimento: MovimentoGrezzo;
  ripartizione: RipartizioneAperta;
  confidenza: Confidenza;
};

export type Ambiguo = {
  movimento: MovimentoGrezzo;
  candidate: RipartizioneAperta[];
};

export type EsitoAbbinamento = {
  /** Proposte sicure: un solo candidato, da confermare con un clic. */
  abbinamenti: Abbinamento[];
  /** Più candidate compatibili: sceglie l'amministratore. */
  ambigui: Ambiguo[];
  /** Accrediti che non corrispondono a nessuna quota aperta. */
  senzaRiscontro: MovimentoGrezzo[];
  /** Addebiti: uscite dal conto, non pagamenti di quote. */
  addebiti: MovimentoGrezzo[];
  /** Quote rimaste scoperte dopo l'abbinamento. */
  ripartizioniNonCoperte: RipartizioneAperta[];
};

/**
 * Giorni di anticipo tollerati rispetto alla scadenza.
 *
 * Un bonifico arriva spesso prima del termine (chi paga alla ricezione
 * dell'avviso), quasi mai molto prima: la finestra tiene dentro i pagamenti
 * anticipati senza far collidere la rata di giugno con quella di dicembre.
 */
export const GIORNI_ANTICIPO = 45;

function aGiorni(data: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(data);
  if (!m) return null;
  return Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000);
}

/** Confronto in centesimi: evita le sorprese dei decimali in virgola mobile. */
function stessoImporto(a: number, b: number): boolean {
  return Math.round(a * 100) === Math.round(b * 100);
}

/**
 * Testo confrontabile: senza accenti, senza punteggiatura, tutto minuscolo, e
 * racchiuso tra spazi.
 *
 * Gli spazi ai bordi servono a cercare parole intere con un semplice
 * `includes(" rossi ")`: senza di essi "rossi" si accenderebbe anche dentro
 * "rossini".
 */
function normalizza(testo: string): string {
  return ` ${testo
    .normalize("NFD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

/** Tutte le parole del testo normalizzato, comprese quelle di una cifra sola. */
function parole(testo: string): string[] {
  return normalizza(testo)
    .split(" ")
    .filter(Boolean);
}

/**
 * Le parole di almeno tre lettere. Serve per i nominativi, dove "di", "de" e
 * "la" non identificano nessuno; NON per gli identificativi delle unità, in
 * cui il pezzo che distingue è quasi sempre il numero.
 */
function paroleSignificative(testo: string): string[] {
  return parole(testo).filter((p) => p.length >= 3);
}

function citaCodiceAvviso(testo: string, codice: string | null): boolean {
  if (!codice) return false;
  const c = chiave(codice);
  return c.length >= 4 && chiave(testo).includes(c);
}

/**
 * L'unità o un nominativo compaiono nella causale?
 *
 * Per l'unità servono TUTTE le sue parole, numero compreso e come parole
 * intere: "interno 3" non deve accendersi su "interno 30", che è l'errore più
 * facile da fare e il più difficile da accorgersene dopo. Un identificativo di
 * un solo carattere ("3") non basta da solo: troppo poco per attribuire un
 * bonifico.
 *
 * Per i nominativi basta invece un pezzo, perché nella causale di un bonifico
 * l'ordinante compare come "ROSSI ADA" o "ADA ROSSI" indifferentemente.
 */
function citaUnitaOSoggetto(testo: string, ripartizione: RipartizioneAperta): boolean {
  const causale = normalizza(testo);

  const pezziUnita = parole(ripartizione.identificativo);
  const lunghezzaUtile = pezziUnita.join("").length;
  if (
    pezziUnita.length > 0 &&
    lunghezzaUtile >= 2 &&
    pezziUnita.every((p) => causale.includes(` ${p} `))
  ) {
    return true;
  }

  return ripartizione.nominativi.some((nominativo) => {
    const pezzi = paroleSignificative(nominativo);
    return pezzi.length > 0 && pezzi.some((p) => causale.includes(` ${p} `));
  });
}

function dataCompatibile(movimento: MovimentoGrezzo, ripartizione: RipartizioneAperta): boolean {
  if (!ripartizione.dataScadenza) return true;
  const giorniMovimento = aGiorni(movimento.data);
  const giorniScadenza = aGiorni(ripartizione.dataScadenza);
  if (giorniMovimento === null || giorniScadenza === null) return true;
  return giorniMovimento >= giorniScadenza - GIORNI_ANTICIPO;
}

/**
 * Propone gli abbinamenti tra accrediti e quote aperte.
 *
 * Le condizioni sono tutte necessarie: importo identico al centesimo, causale
 * che cita il codice avviso oppure l'unità/il nominativo, e data non troppo
 * anteriore alla scadenza. Una quota già proposta per un altro movimento non
 * viene proposta due volte: entrambi i movimenti diventano ambigui, perché non
 * c'è modo di sapere quale dei due bonifici salda quale rata.
 */
export function abbinaMovimenti(
  movimenti: MovimentoGrezzo[],
  ripartizioni: RipartizioneAperta[]
): EsitoAbbinamento {
  const addebiti = movimenti.filter((m) => m.importo < 0);
  const accrediti = movimenti.filter((m) => m.importo > 0);

  const causaleDi = (m: MovimentoGrezzo) => `${m.descrizione} ${m.riferimento ?? ""}`;

  const candidature = accrediti.map((movimento) => {
    const causale = causaleDi(movimento);
    const candidate = ripartizioni.filter(
      (r) =>
        stessoImporto(movimento.importo, r.importoDovuto) &&
        dataCompatibile(movimento, r) &&
        (citaCodiceAvviso(causale, r.codiceAvviso) || citaUnitaOSoggetto(causale, r))
    );
    return { movimento, candidate };
  });

  // Una quota contesa da due movimenti non è attribuibile con certezza a
  // nessuno dei due: entrambi vanno guardati a mano.
  const contese = new Set<string>();
  const conteggio = new Map<string, number>();
  for (const { candidate } of candidature) {
    if (candidate.length !== 1) continue;
    const id = candidate[0].id;
    const n = (conteggio.get(id) ?? 0) + 1;
    conteggio.set(id, n);
    if (n > 1) contese.add(id);
  }

  const abbinamenti: Abbinamento[] = [];
  const ambigui: Ambiguo[] = [];
  const senzaRiscontro: MovimentoGrezzo[] = [];

  for (const { movimento, candidate } of candidature) {
    if (!candidate.length) {
      senzaRiscontro.push(movimento);
      continue;
    }
    if (candidate.length > 1 || contese.has(candidate[0].id)) {
      ambigui.push({ movimento, candidate });
      continue;
    }
    const ripartizione = candidate[0];
    abbinamenti.push({
      movimento,
      ripartizione,
      confidenza: citaCodiceAvviso(causaleDi(movimento), ripartizione.codiceAvviso)
        ? "alta"
        : "media",
    });
  }

  const coperte = new Set(abbinamenti.map((a) => a.ripartizione.id));

  return {
    abbinamenti,
    ambigui,
    senzaRiscontro,
    addebiti,
    ripartizioniNonCoperte: ripartizioni.filter((r) => !coperte.has(r.id)),
  };
}
