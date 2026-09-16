import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Blocco, Documento } from "./modello";

/**
 * Resa in PDF del modello di documento.
 *
 * Scelta della libreria: pdf-lib. È JavaScript puro (nessun binario nativo,
 * nessun Chromium headless), quindi funziona in una Server Action o in un
 * Route Handler su Vercel senza configurazione aggiuntiva, a differenza delle
 * soluzioni basate su Puppeteer. Si usano i font standard PDF (Helvetica), che
 * non vanno incorporati nel file: la codifica è WinAnsi e copre le lettere
 * accentate italiane.
 */

const A4 = { larghezza: 595.28, altezza: 841.89 };
const MARGINE = 56;
const LARGHEZZA_UTILE = A4.larghezza - MARGINE * 2;

const INCHIOSTRO = rgb(0.09, 0.12, 0.19);
const INCHIOSTRO_TENUE = rgb(0.42, 0.45, 0.52);

type Stile = {
  dimensione: number;
  grassetto: boolean;
  interlinea: number;
  spazioPrima: number;
  spazioDopo: number;
  tenue?: boolean;
};

const STILI: Record<Blocco["tipo"], Stile> = {
  titolo: { dimensione: 17, grassetto: true, interlinea: 21, spazioPrima: 6, spazioDopo: 6 },
  sottotitolo: { dimensione: 12, grassetto: true, interlinea: 16, spazioPrima: 8, spazioDopo: 3 },
  paragrafo: { dimensione: 10.5, grassetto: false, interlinea: 15, spazioPrima: 0, spazioDopo: 3 },
  campo: { dimensione: 10.5, grassetto: false, interlinea: 15, spazioPrima: 0, spazioDopo: 1 },
  elenco: { dimensione: 10.5, grassetto: false, interlinea: 15, spazioPrima: 0, spazioDopo: 3 },
  // Un corpo più piccolo e un'interlinea più stretta: una tabella di movimenti
  // ha molte righe, e comprimerla la rende più leggibile, non meno.
  tabella: { dimensione: 8.5, grassetto: false, interlinea: 11.5, spazioPrima: 4, spazioDopo: 4 },
  nota: {
    dimensione: 8.5,
    grassetto: false,
    interlinea: 12,
    spazioPrima: 10,
    spazioDopo: 0,
    tenue: true,
  },
  spazio: { dimensione: 0, grassetto: false, interlinea: 0, spazioPrima: 8, spazioDopo: 0 },
};

/**
 * I font standard del PDF usano la codifica WinAnsi (CP1252): le lettere
 * accentate italiane ci sono, e ci sono anche il simbolo dell'euro, la lineetta
 * lunga, le virgolette curve e i puntini di sospensione. Restano fuori pochi
 * segni (per esempio le frecce), sui quali pdf-lib solleverebbe un errore in
 * fase di scrittura: quelli vengono sostituiti con l'equivalente ASCII invece
 * di far fallire la generazione dell'intero documento.
 */
const SOSTITUZIONI: [RegExp, string][] = [
  [/\u2192/g, "->"],
  [/\u2190/g, "<-"],
  // Spazi unificatori e sottili: WinAnsi non li ha, e lo spazio normale va
  // benissimo (li produce `Intl` dentro gli importi e le date).
  [/[    ]/g, " "],
];

/**
 * CP1252 aggiunge a Latin-1 una manciata di segni tipografici (euro, lineette,
 * virgolette curve, bullet). Sono codepoint Unicode sparsi, quindi una rete di
 * sicurezza costruita sul solo intervallo Latin-1 li buttava via insieme al
 * resto: è esattamente così che "1.234,56 \u20ac" finiva stampato "1.234,56 ?".
 */
const EXTRA_CP1252 =
  "\u20ac\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152" +
  "\u017d\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a" +
  "\u0153\u017e\u0178";

const FUORI_CODIFICA = new RegExp(`[^\\n -\\u00ff${EXTRA_CP1252}]`, "g");

/** Esportata solo per il test: è il punto in cui si perdevano i simboli. */
export function perWinAnsi(testo: string): string {
  let out = testo;
  for (const [cerca, sostituisci] of SOSTITUZIONI) out = out.replace(cerca, sostituisci);
  // Ultima rete di sicurezza: quel che resta fuori dalla codifica diventa "?"
  // (l'a capo va preservato, lo usa spezzaRighe per i paragrafi multiriga).
  return out.replace(FUORI_CODIFICA, "?");
}

/** Manda a capo il testo rispettando la larghezza disponibile. */
function spezzaRighe(
  testo: string,
  font: PDFFont,
  dimensione: number,
  larghezza: number
): string[] {
  const righe: string[] = [];

  for (const paragrafo of testo.split("\n")) {
    if (!paragrafo.trim()) {
      righe.push("");
      continue;
    }
    let corrente = "";
    for (const parola of paragrafo.trim().split(/\s+/)) {
      const tentativo = corrente ? `${corrente} ${parola}` : parola;
      if (font.widthOfTextAtSize(tentativo, dimensione) <= larghezza || !corrente) {
        corrente = tentativo;
      } else {
        righe.push(corrente);
        corrente = parola;
      }
    }
    righe.push(corrente);
  }

  return righe;
}

type Contesto = {
  pdf: PDFDocument;
  normale: PDFFont;
  grassetto: PDFFont;
  pagina: PDFPage;
  y: number;
};

function nuovaPagina(ctx: Contesto) {
  ctx.pagina = ctx.pdf.addPage([A4.larghezza, A4.altezza]);
  ctx.y = A4.altezza - MARGINE;
}

/** Scrive una riga, aprendo una pagina nuova se non c'è più spazio. */
function scriviRiga(
  ctx: Contesto,
  riga: string,
  stile: Stile,
  x: number,
  font: PDFFont,
  avanza: boolean
) {
  if (avanza) {
    if (ctx.y - stile.interlinea < MARGINE) nuovaPagina(ctx);
    ctx.y -= stile.interlinea;
  }
  if (!riga) return;
  ctx.pagina.drawText(riga, {
    x,
    y: ctx.y,
    size: stile.dimensione,
    font,
    color: stile.tenue ? INCHIOSTRO_TENUE : INCHIOSTRO,
  });
}

function scriviBloccoTesto(ctx: Contesto, testo: string, stile: Stile, rientro = 0) {
  const font = stile.grassetto ? ctx.grassetto : ctx.normale;
  const righe = spezzaRighe(perWinAnsi(testo), font, stile.dimensione, LARGHEZZA_UTILE - rientro);
  for (const riga of righe) {
    scriviRiga(ctx, riga, stile, MARGINE + rientro, font, true);
  }
}

/* -------------------------------------------------------------------------
   Tabelle
   ------------------------------------------------------------------------- */

/** Aria fra una colonna e la successiva, così le celle non si toccano mai. */
const GRONDA_COLONNA = 10;

type Tabella = Extract<Blocco, { tipo: "tabella" }>;

/**
 * Larghezza di ogni colonna.
 *
 * Si parte dalla larghezza REALE del contenuto (misurata sul font, non stimata
 * sul numero di caratteri: "1.234,56 €" e "illlllllll" occupano spazi molto
 * diversi). Se la somma sfora il rigo, tutte le colonne si comprimono in
 * proporzione e le celle vanno a capo: meglio una tabella un po' fitta che una
 * che esce dal foglio.
 */
function larghezzeColonne(ctx: Contesto, blocco: Tabella, stile: Stile): number[] {
  const celleDi = (i: number) => [
    ...blocco.righe.map((r) => r[i] ?? ""),
    ...(blocco.totali ? [blocco.totali[i] ?? ""] : []),
  ];

  const naturali = blocco.colonne.map((colonna, i) => {
    let massima = ctx.grassetto.widthOfTextAtSize(
      perWinAnsi(colonna.intestazione),
      stile.dimensione
    );
    for (const cella of celleDi(i)) {
      massima = Math.max(
        massima,
        ctx.normale.widthOfTextAtSize(perWinAnsi(cella), stile.dimensione)
      );
    }
    return massima + GRONDA_COLONNA;
  });

  const totale = naturali.reduce((somma, larghezza) => somma + larghezza, 0);
  if (totale <= LARGHEZZA_UTILE || totale === 0) return naturali;
  return naturali.map((larghezza) => (larghezza / totale) * LARGHEZZA_UTILE);
}

/** Ascissa di partenza di ogni colonna, a partire dal margine sinistro. */
function ascisse(larghezze: number[]): number[] {
  const x: number[] = [];
  let corrente = MARGINE;
  for (const larghezza of larghezze) {
    x.push(corrente);
    corrente += larghezza;
  }
  return x;
}

/**
 * Scrive una riga di tabella. Torna l'altezza occupata; con `simula` si limita
 * a calcolarla, che serve per decidere se la riga entra ancora nella pagina
 * PRIMA di cominciare a scriverla (spezzarla a metà sarebbe illeggibile).
 */
function scriviRigaTabella(
  ctx: Contesto,
  celle: string[],
  blocco: Tabella,
  larghezze: number[],
  stile: Stile,
  font: PDFFont,
  simula = false
): number {
  const x = ascisse(larghezze);
  const righeCella = blocco.colonne.map((_, i) =>
    spezzaRighe(perWinAnsi(celle[i] ?? ""), font, stile.dimensione, larghezze[i] - GRONDA_COLONNA)
  );
  const numeroRighe = Math.max(1, ...righeCella.map((r) => r.length));
  const altezza = numeroRighe * stile.interlinea;
  if (simula) return altezza;

  for (let j = 0; j < numeroRighe; j += 1) {
    ctx.y -= stile.interlinea;
    for (let i = 0; i < blocco.colonne.length; i += 1) {
      const testo = righeCella[i][j];
      if (!testo) continue;
      const larghezzaTesto = font.widthOfTextAtSize(testo, stile.dimensione);
      const destra = blocco.colonne[i].allineamento === "destra";
      ctx.pagina.drawText(testo, {
        x: destra ? x[i] + larghezze[i] - GRONDA_COLONNA - larghezzaTesto : x[i],
        y: ctx.y,
        size: stile.dimensione,
        font,
        color: INCHIOSTRO,
      });
    }
  }

  return altezza;
}

function filetto(ctx: Contesto, larghezza: number, scarto: number) {
  ctx.pagina.drawLine({
    start: { x: MARGINE, y: ctx.y - scarto },
    end: { x: MARGINE + larghezza, y: ctx.y - scarto },
    thickness: 0.5,
    color: INCHIOSTRO_TENUE,
  });
}

function scriviTabella(ctx: Contesto, blocco: Tabella, stile: Stile) {
  if (!blocco.colonne.length) return;

  const larghezze = larghezzeColonne(ctx, blocco, stile);
  const larghezzaTotale = larghezze.reduce((somma, l) => somma + l, 0);
  const intestazioni = blocco.colonne.map((c) => c.intestazione);

  // L'intestazione si ripete su ogni pagina: senza, le pagine successive di un
  // registro lungo sarebbero colonne di numeri senza nome.
  const scriviIntestazione = () => {
    scriviRigaTabella(ctx, intestazioni, blocco, larghezze, stile, ctx.grassetto);
    filetto(ctx, larghezzaTotale, 3);
    ctx.y -= 4;
  };

  const conSpazio = (celle: string[], font: PDFFont) => {
    const altezza = scriviRigaTabella(ctx, celle, blocco, larghezze, stile, font, true);
    if (ctx.y - altezza < MARGINE) {
      nuovaPagina(ctx);
      scriviIntestazione();
    }
    scriviRigaTabella(ctx, celle, blocco, larghezze, stile, font);
  };

  const altezzaIntestazione = scriviRigaTabella(
    ctx,
    intestazioni,
    blocco,
    larghezze,
    stile,
    ctx.grassetto,
    true
  );
  // L'intestazione da sola in fondo alla pagina non serve a nessuno: se non
  // c'è spazio almeno per lei e per una riga, si va subito a capo pagina.
  if (ctx.y - altezzaIntestazione - stile.interlinea * 2 < MARGINE) nuovaPagina(ctx);
  scriviIntestazione();

  for (const riga of blocco.righe) conSpazio(riga, ctx.normale);

  if (blocco.totali) {
    filetto(ctx, larghezzaTotale, 3);
    ctx.y -= 3;
    conSpazio(blocco.totali, ctx.grassetto);
  }
}

/** Genera il PDF del documento e restituisce i byte del file. */
export async function generaPdf(documento: Documento): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(perWinAnsi(documento.titolo));
  pdf.setProducer("Portale Condominio");
  pdf.setCreationDate(new Date());

  const ctx: Contesto = {
    pdf,
    normale: await pdf.embedFont(StandardFonts.Helvetica),
    grassetto: await pdf.embedFont(StandardFonts.HelveticaBold),
    pagina: pdf.addPage([A4.larghezza, A4.altezza]),
    y: A4.altezza - MARGINE,
  };

  for (const blocco of documento.blocchi) {
    const stile = STILI[blocco.tipo];
    ctx.y -= stile.spazioPrima;

    switch (blocco.tipo) {
      case "spazio":
        break;

      case "campo": {
        // Etichetta in grassetto e valore in tondo sulla stessa riga: la
        // larghezza dell'etichetta si misura sul font reale, non si stima.
        const etichetta = `${perWinAnsi(blocco.etichetta)}: `;
        const rientro = ctx.grassetto.widthOfTextAtSize(etichetta, stile.dimensione);
        const valore = spezzaRighe(
          perWinAnsi(blocco.valore),
          ctx.normale,
          stile.dimensione,
          LARGHEZZA_UTILE - rientro
        );

        scriviRiga(ctx, etichetta, stile, MARGINE, ctx.grassetto, true);
        scriviRiga(ctx, valore[0] ?? "", stile, MARGINE + rientro, ctx.normale, false);
        for (const riga of valore.slice(1)) {
          scriviRiga(ctx, riga, stile, MARGINE + rientro, ctx.normale, true);
        }
        break;
      }

      case "elenco":
        for (const voce of blocco.voci) scriviBloccoTesto(ctx, voce, stile, 14);
        break;

      case "tabella":
        scriviTabella(ctx, blocco, stile);
        break;

      default:
        scriviBloccoTesto(ctx, blocco.testo, stile);
    }

    ctx.y -= stile.spazioDopo;
  }

  return pdf.save();
}
