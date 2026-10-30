/**
 * Riconoscimento del tipo reale di un file caricato (COD-06).
 *
 * Prima di questo modulo gli upload del portale controllavano solo
 * `file.size`, e scrivevano nello storage il `file.type` dichiarato dal
 * browser: un valore che chi carica può scegliere liberamente. Un HTML o un
 * SVG con uno script dentro, spedito come `image/png`, veniva salvato con
 * quel content type e riservito tale e quale dallo storage.
 *
 * Qui sta la logica pura: dati i primi byte di un file, qual è il suo
 * formato vero. Le server action chiamano `verificaTipoFile` e usano il MIME
 * che torna da qui — non quello dichiarato dal client — sia per l'upload sia
 * per i metadati salvati a database.
 *
 * ## Perché i magic bytes a mano e non una libreria
 *
 * `file-type` (lo standard de facto) riconosce oltre cento formati che qui
 * non servono, è ESM-only e si porta dietro tre dipendenze transitive
 * (`strtok3`, `peek-readable`, `token-types`) pensate per lo streaming da
 * file system. Al portale servono sette firme: PDF, le immagini che una
 * fotocamera di telefono produce, e i due contenitori dei documenti
 * d'ufficio. Sono poche decine di righe di confronti su byte costanti,
 * testabili senza database e senza rete — e una dipendenza in meno da
 * aggiornare. È la stessa logica con cui il progetto ha già escluso `xlsx`
 * in favore di `exceljs` (vedi `src/lib/import/analizza-file.ts`).
 *
 * ## I due contenitori: zip e OLE2
 *
 * `.docx/.xlsx/.odt/.ods` sono archivi ZIP e `.doc/.xls` sono contenitori
 * OLE2: dall'intestazione si vede il contenitore, non quale documento ci sia
 * dentro. Per questi due casi il formato preciso si ricava dall'estensione
 * del nome, ma solo DOPO che i magic bytes hanno dimostrato che il
 * contenitore è quello giusto. Il valore dell'estensione resta quindi
 * limitato a scegliere fra tipi equivalenti e già ammessi: non può più far
 * passare un HTML, che è il rischio concreto di COD-06, perché un HTML non
 * è né uno ZIP né un OLE2.
 */

/** Formati di contenuto riconosciuti dalla firma dei primi byte. */
export type FamigliaFile =
  | "pdf"
  | "jpeg"
  | "png"
  | "gif"
  | "webp"
  | "heic"
  | "avif"
  | "zip"
  | "ole2";

export type TipoRilevato = {
  famiglia: FamigliaFile;
  /** MIME canonico: è questo che va nello storage, non quello del client. */
  mime: string;
  /** Estensione canonica, per costruire il percorso nello storage. */
  estensione: string;
  etichetta: string;
};

export type EsitoTipoFile =
  | { ok: true; famiglia: FamigliaFile; mime: string; estensione: string }
  | { ok: false; errore: string };

/**
 * Byte da leggere dalla testa del file. Le firme più lontane (il brand di un
 * HEIC, la sigla WEBP) stanno entro i primi 16; 256 lascia margine senza
 * costare nulla, dato che si legge una `slice` e non il file intero.
 */
export const LUNGHEZZA_TESTA_FILE = 256;

/**
 * Legge dal file solo i byte che servono al riconoscimento. Sta qui e non
 * nelle action perché è la metà inseparabile di `verificaTipoFile`: avere
 * due punti che decidono quanti byte leggere è il modo più semplice di
 * ritrovarsi con una firma tagliata a metà.
 */
export async function testaDiFile(file: Blob): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(0, LUNGHEZZA_TESTA_FILE).arrayBuffer());
}

export const FAMIGLIE_IMMAGINE: readonly FamigliaFile[] = [
  "jpeg",
  "png",
  "gif",
  "webp",
  "heic",
  "avif",
];

/** Allegati di una spesa o verbale caricato a mano: scansione o foto. */
export const FAMIGLIE_PDF_E_IMMAGINI: readonly FamigliaFile[] = ["pdf", ...FAMIGLIE_IMMAGINE];

/**
 * Archivio documentale del condominio: oltre a PDF e immagini accetta i
 * documenti d'ufficio, perché regolamenti e bilanci storici arrivano spesso
 * in .doc/.xls (è anche quello che dichiara il campo file del modulo).
 */
export const FAMIGLIE_ARCHIVIO: readonly FamigliaFile[] = [
  ...FAMIGLIE_PDF_E_IMMAGINI,
  "zip",
  "ole2",
];

const ETICHETTE: Record<FamigliaFile, string> = {
  pdf: "PDF",
  jpeg: "JPEG",
  png: "PNG",
  gif: "GIF",
  webp: "WebP",
  heic: "HEIC",
  avif: "AVIF",
  zip: "documento Office o OpenDocument",
  ole2: "documento Word o Excel in formato classico",
};

const MIME_IMMEDIATO: Partial<Record<FamigliaFile, { mime: string; estensione: string }>> = {
  pdf: { mime: "application/pdf", estensione: "pdf" },
  jpeg: { mime: "image/jpeg", estensione: "jpg" },
  png: { mime: "image/png", estensione: "png" },
  gif: { mime: "image/gif", estensione: "gif" },
  webp: { mime: "image/webp", estensione: "webp" },
  heic: { mime: "image/heic", estensione: "heic" },
  avif: { mime: "image/avif", estensione: "avif" },
};

/** Documenti dentro un contenitore ZIP (OOXML e OpenDocument). */
const UFFICIO_ZIP: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
};

/** Documenti dentro un contenitore OLE2 (Office 97-2003). */
const UFFICIO_OLE2: Record<string, string> = {
  doc: "application/msword",
  xls: "application/vnd.ms-excel",
  ppt: "application/vnd.ms-powerpoint",
};

/** Brand ISO-BMFF considerati immagini (HEIC/HEIF da iPhone, AVIF da Android). */
const BRAND_HEIC = ["heic", "heix", "heim", "heis", "hevc", "hevx", "heif", "mif1", "msf1"];

function iniziaCon(testa: Uint8Array, byte: number[], offset = 0): boolean {
  if (testa.length < offset + byte.length) return false;
  return byte.every((b, i) => testa[offset + i] === b);
}

/** Legge `lunghezza` byte come testo ASCII, per le firme fatte di sigle. */
function sigla(testa: Uint8Array, offset: number, lunghezza: number): string {
  if (testa.length < offset + lunghezza) return "";
  let s = "";
  for (let i = 0; i < lunghezza; i++) s += String.fromCharCode(testa[offset + i]);
  return s;
}

/**
 * Formato vero del file, dai soli primi byte. `null` se la firma non
 * corrisponde a nessuno dei formati gestiti: è il caso di un HTML, di un
 * SVG, di un eseguibile o di un file di testo — tutti rifiutati.
 *
 * La firma del PDF è cercata all'offset 0 e non "nei primi 1024 byte" come
 * fanno alcuni lettori tolleranti: accettare un `%PDF` più in là vorrebbe
 * dire accettare anche un file che per un browser comincia come qualcosa
 * d'altro, che è precisamente il caso da escludere.
 */
export function riconosciTipoFile(testa: Uint8Array): TipoRilevato | null {
  const famiglia = riconosciFamiglia(testa);
  if (!famiglia) return null;
  const immediato = MIME_IMMEDIATO[famiglia];
  return {
    famiglia,
    // Per i contenitori il MIME preciso lo decide `verificaTipoFile`
    // guardando l'estensione: qui resta quello del contenitore.
    mime: immediato?.mime ?? (famiglia === "zip" ? "application/zip" : "application/x-ole-storage"),
    estensione: immediato?.estensione ?? (famiglia === "zip" ? "zip" : "bin"),
    etichetta: ETICHETTE[famiglia],
  };
}

function riconosciFamiglia(testa: Uint8Array): FamigliaFile | null {
  if (iniziaCon(testa, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf"; // "%PDF-"
  if (iniziaCon(testa, [0xff, 0xd8, 0xff])) return "jpeg";
  if (iniziaCon(testa, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";

  const inizio = sigla(testa, 0, 6);
  if (inizio === "GIF87a" || inizio === "GIF89a") return "gif";
  if (sigla(testa, 0, 4) === "RIFF" && sigla(testa, 8, 4) === "WEBP") return "webp";

  if (sigla(testa, 4, 4) === "ftyp") {
    const brand = sigla(testa, 8, 4).toLowerCase();
    if (brand === "avif" || brand === "avis") return "avif";
    if (BRAND_HEIC.includes(brand)) return "heic";
  }

  // ZIP: archivio normale, archivio vuoto, archivio multi-volume.
  if (
    iniziaCon(testa, [0x50, 0x4b, 0x03, 0x04]) ||
    iniziaCon(testa, [0x50, 0x4b, 0x05, 0x06]) ||
    iniziaCon(testa, [0x50, 0x4b, 0x07, 0x08])
  ) {
    return "zip";
  }

  if (iniziaCon(testa, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "ole2";

  return null;
}

/** Estensione del nome file, minuscola e senza punto ("" se non c'è). */
export function estensioneDa(nomeFile: string): string {
  const punto = nomeFile.lastIndexOf(".");
  if (punto <= 0 || punto === nomeFile.length - 1) return "";
  return nomeFile.slice(punto + 1).toLowerCase();
}

/** "PDF, JPEG, PNG o documenti Office": l'elenco dei formati ammessi. */
export function descriviFamiglie(famiglie: readonly FamigliaFile[]): string {
  const etichette: string[] = [];
  for (const f of famiglie) {
    const etichetta =
      f === "zip" || f === "ole2" ? "documenti Office (doc, docx, xls, xlsx, odt, ods)" : ETICHETTE[f];
    if (!etichette.includes(etichetta)) etichette.push(etichetta);
  }
  if (etichette.length <= 1) return etichette[0] ?? "nessun formato";
  return `${etichette.slice(0, -1).join(", ")} o ${etichette.at(-1)}`;
}

/**
 * Controllo completo da chiamare nelle server action di upload: riconosce il
 * formato vero, verifica che sia fra quelli ammessi e restituisce il MIME e
 * l'estensione canonici da usare al posto di quelli dichiarati dal client.
 */
export function verificaTipoFile(
  testa: Uint8Array,
  nomeFile: string,
  famiglieConsentite: readonly FamigliaFile[]
): EsitoTipoFile {
  const ammessi = descriviFamiglie(famiglieConsentite);
  const tipo = riconosciTipoFile(testa);

  if (!tipo) {
    return {
      ok: false,
      errore: `Il contenuto di questo file non corrisponde a nessun formato ammesso (${ammessi}). Caricalo nel formato originale, senza rinominarlo.`,
    };
  }

  if (!famiglieConsentite.includes(tipo.famiglia)) {
    return {
      ok: false,
      errore: `Questo file è ${tipo.etichetta}: qui sono ammessi solo ${ammessi}.`,
    };
  }

  if (tipo.famiglia === "zip" || tipo.famiglia === "ole2") {
    const tabella = tipo.famiglia === "zip" ? UFFICIO_ZIP : UFFICIO_OLE2;
    const estensione = estensioneDa(nomeFile);
    const mime = tabella[estensione];
    if (!mime) {
      return {
        ok: false,
        errore: `Il contenuto di questo file non corrisponde all'estensione del nome: sono ammessi ${ammessi}.`,
      };
    }
    return { ok: true, famiglia: tipo.famiglia, mime, estensione };
  }

  return { ok: true, famiglia: tipo.famiglia, mime: tipo.mime, estensione: tipo.estensione };
}
