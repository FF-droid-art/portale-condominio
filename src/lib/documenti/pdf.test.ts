import { describe, expect, test } from "vitest";
import { generaPdf, perWinAnsi } from "./pdf";
import type { Blocco, Documento } from "./modello";

/**
 * La resa in PDF non si verifica leggendo i pixel: si verifica che non sollevi
 * eccezioni e che produca un file valido. I casi qui sotto sono quelli in cui
 * `pdf-lib` fallirebbe davvero — caratteri fuori dalla codifica WinAnsi dei
 * font standard, e tabelle che non entrano nel foglio o nella pagina.
 */

function documento(blocchi: Blocco[]): Documento {
  return { titolo: "Prova", nomeFile: "prova", blocchi };
}

async function generaOk(blocchi: Blocco[]): Promise<Uint8Array> {
  const byte = await generaPdf(documento(blocchi));
  // "%PDF" in ASCII: se il file non comincia così, non è un PDF.
  expect([...byte.slice(0, 4)]).toEqual([37, 80, 68, 70]);
  return byte;
}

describe("perWinAnsi", () => {
  test("tiene i segni che la codifica WinAnsi ha davvero", () => {
    // Regressione: la vecchia rete di sicurezza ammetteva solo Latin-1, e ogni
    // importo finiva stampato "1.234,56 ?" invece che con il simbolo dell'euro.
    expect(perWinAnsi("1.234,56 €")).toBe("1.234,56 €");
    expect(perWinAnsi("Interno 1 — dovuto")).toBe("Interno 1 — dovuto");
    expect(perWinAnsi("«così» e “virgolette” e … e •")).toBe("«così» e “virgolette” e … e •");
  });

  test("sostituisce ciò che WinAnsi non ha, invece di far fallire il documento", () => {
    expect(perWinAnsi("a → b")).toBe("a -> b");
    expect(perWinAnsi("a ← b")).toBe("a <- b");
    // Lo spazio unificatore che Intl infila negli importi diventa uno normale.
    expect(perWinAnsi("12 €")).toBe("12 €");
    // Fuori codifica: meglio un punto interrogativo che un'eccezione.
    expect(perWinAnsi("日本")).toBe("??");
  });
});

describe("generaPdf", () => {
  test("rende i blocchi di testo senza inciampare sui segni fuori da WinAnsi", async () => {
    await generaOk([
      { tipo: "titolo", testo: "Rendiconto → 2026 … “virgolette”" },
      { tipo: "sottotitolo", testo: "Sezione" },
      { tipo: "paragrafo", testo: "Riga uno\nRiga due" },
      { tipo: "campo", etichetta: "Totale", valore: "1.234,56 €" },
      { tipo: "elenco", voci: ["• prima voce", "seconda voce"] },
      { tipo: "nota", testo: "Nota in coda." },
      { tipo: "spazio" },
    ]);
  });

  test("rende una tabella con totali e colonne allineate a destra", async () => {
    await generaOk([
      {
        tipo: "tabella",
        colonne: [
          { intestazione: "Categoria" },
          { intestazione: "Importo", allineamento: "destra" },
        ],
        righe: [
          ["ascensore", "1.200,00 €"],
          ["pulizie", "500,00 €"],
        ],
        totali: ["Totale", "1.700,00 €"],
      },
    ]);
  });

  test("una tabella lunga va a capo pagina senza perdere l'intestazione", async () => {
    const righe = Array.from({ length: 200 }, (_, i) => [
      `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
      `Movimento numero ${i}`,
      `Interno ${i}`,
      "120,00 €",
    ]);

    const byte = await generaOk([
      {
        tipo: "tabella",
        colonne: [
          { intestazione: "Data" },
          { intestazione: "Movimento" },
          { intestazione: "Riferimento" },
          { intestazione: "Importo", allineamento: "destra" },
        ],
        righe,
        totali: ["Totali", "", "", "24.000,00 €"],
      },
    ]);

    // 200 righe non stanno in una pagina sola: il PDF deve averne più d'una.
    expect(byte.byteLength).toBeGreaterThan(5000);
  });

  test("una tabella più larga del foglio si comprime invece di uscire dal margine", async () => {
    await generaOk([
      {
        tipo: "tabella",
        colonne: Array.from({ length: 8 }, (_, i) => ({ intestazione: `Colonna molto lunga ${i}` })),
        righe: [
          Array.from({ length: 8 }, () => "Contenuto piuttosto lungo che non entrerebbe mai"),
        ],
      },
    ]);
  });

  test("una tabella senza colonne non fa esplodere il documento", async () => {
    await generaOk([{ tipo: "tabella", colonne: [], righe: [] }]);
  });
});
