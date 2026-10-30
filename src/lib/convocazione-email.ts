/**
 * Contenuto dell'email di convocazione assemblea (FEAT-04 in
 * docs/audit/03-feature-conformita.md).
 *
 * Prima di questo modulo l'email aveva un testo fisso — "È stata convocata
 * una nuova assemblea {tipo} per il {data}. Accedi al portale per i
 * dettagli." — senza luogo, link alla videoconferenza né ordine del giorno,
 * anche quando quei dati erano già stati inseriti. Qui sta la sola
 * composizione del contenuto (pura, senza invio): la scrive una volta sola
 * e la usano sia l'invio automatico alla creazione dell'assemblea
 * (`src/app/admin/assemblee/actions.ts`, dove luogo e punti non esistono
 * quasi mai ancora) sia l'invio esplicito con i dettagli completi
 * (`src/app/admin/assemblee/[id]/actions.ts`, dove di solito esistono).
 *
 * NOTA NON RISOLTA QUI (docs/audit/03-feature-conformita.md, FEAT-04): se
 * un'email di questo tipo soddisfi da sola l'onere di convocazione
 * dell'art. 66, comma 3, disp. att. c.c. — specialmente quando l'ordine del
 * giorno non è ancora stato aggiunto e il testo rimanda al portale — resta
 * una verifica legale non assunta in un senso o nell'altro da questo
 * modulo: qui si migliora solo il contenuto dell'email rispetto a prima,
 * indipendentemente da quella risposta.
 */

import { formatDataOra } from "@/lib/format";

export type PuntoOdgEmail = { numeroPunto: number; descrizione: string };

export type DatiConvocazione = {
  tipo: string;
  dataAssemblea: string;
  luogo?: string | null;
  linkVideoconferenza?: string | null;
  convocazione?: 1 | 2 | null;
  /** Solo i punti già inseriti al momento dell'invio: possono essere zero. */
  puntiOdg?: PuntoOdgEmail[];
};

function escapeHtml(testo: string): string {
  return testo
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** "Prima convocazione" / "Seconda convocazione", o "" se non ancora impostata. */
function etichettaConvocazione(convocazione?: 1 | 2 | null): string {
  if (convocazione === 1) return "prima convocazione";
  if (convocazione === 2) return "seconda convocazione";
  return "";
}

/**
 * Oggetto e corpo HTML dell'email. Il corpo elenca solo le informazioni
 * davvero disponibili: se luogo o punti mancano, la riga corrispondente non
 * compare invece di mostrare un segnaposto vuoto, e una nota finale rimanda
 * comunque al portale per i dettagli che arriveranno dopo.
 */
export function costruisciEmailConvocazione(dati: DatiConvocazione): {
  subject: string;
  html: string;
} {
  const etichettaTipo = dati.tipo === "straordinaria" ? "straordinaria" : "ordinaria";
  const convocazione = etichettaConvocazione(dati.convocazione);

  const subject = `Convocazione assemblea ${etichettaTipo}${convocazione ? ` — ${convocazione}` : ""}`;

  const righe: string[] = [
    `<p>È stata convocata un'assemblea <strong>${etichettaTipo}</strong>${
      convocazione ? ` in <strong>${convocazione}</strong>` : ""
    } per il <strong>${formatDataOra(dati.dataAssemblea)}</strong>.</p>`,
  ];

  if (dati.luogo?.trim()) {
    righe.push(`<p><strong>Luogo:</strong> ${escapeHtml(dati.luogo.trim())}</p>`);
  }

  if (dati.linkVideoconferenza?.trim()) {
    righe.push(
      `<p><strong>Collegamento online:</strong> <a href="${escapeHtml(dati.linkVideoconferenza.trim())}">${escapeHtml(dati.linkVideoconferenza.trim())}</a></p>`
    );
  }

  const punti = (dati.puntiOdg ?? []).slice().sort((a, b) => a.numeroPunto - b.numeroPunto);
  if (punti.length) {
    const voci = punti
      .map((p) => `<li>${p.numeroPunto}. ${escapeHtml(p.descrizione)}</li>`)
      .join("");
    righe.push(`<p><strong>Ordine del giorno:</strong></p><ol>${voci}</ol>`);
  } else {
    righe.push(
      "<p>L'ordine del giorno sarà disponibile sul portale non appena l'amministratore lo pubblicherà.</p>"
    );
  }

  righe.push("<p>Accedi al portale per i dettagli completi e, se previsto, per votare online.</p>");

  return { subject, html: righe.join("\n") };
}
