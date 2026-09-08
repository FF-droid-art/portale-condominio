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
 * I font standard del PDF usano la codifica WinAnsi: le lettere accentate
 * italiane ci sono, ma alcuni segni tipografici (frecce, spazi unificatori,
 * virgolette curve) no, e pdf-lib solleverebbe un errore in fase di scrittura.
 * Vengono sostituiti con l'equivalente ASCII invece di far fallire la
 * generazione dell'intero documento.
 */
const SOSTITUZIONI: [RegExp, string][] = [
  [/→/g, "->"],
  [/←/g, "<-"],
  [/…/g, "..."],
  [/[    ]/g, " "],
  [/[‘’]/g, "'"],
  [/[“”]/g, '"'],
  [/•/g, "-"],
];

function perWinAnsi(testo: string): string {
  let out = testo;
  for (const [cerca, sostituisci] of SOSTITUZIONI) out = out.replace(cerca, sostituisci);
  // Ultima rete di sicurezza: quel che resta fuori da Latin-1 diventa "?"
  // (l'a capo va preservato, lo usa spezzaRighe per i paragrafi multiriga).
  return out.replace(/[^\n -ÿ]/g, "?");
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

      default:
        scriviBloccoTesto(ctx, blocco.testo, stile);
    }

    ctx.y -= stile.spazioDopo;
  }

  return pdf.save();
}
