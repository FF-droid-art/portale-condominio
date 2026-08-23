import { describe, expect, test } from "vitest";
import { estraiFoglio, rilevaRigaIntestazione } from "./analizza-file";

describe("rilevaRigaIntestazione", () => {
  test("sceglie la riga con più celle valorizzate tra le prime righe", () => {
    const righe = [
      ["Export gestionale XYZ"], // riga-titolo, 1 cella piena
      ["Identificativo", "Piano", "Millesimi"], // intestazione vera, 3 celle piene
      ["Int. 1", "1", "500"],
    ];
    expect(rilevaRigaIntestazione(righe)).toBe(1);
  });

  test("ignora celle vuote/null/whitespace nel conteggio", () => {
    const righe = [
      ["A", "", null, "   "],
      ["Identificativo", "Piano", "Millesimi", "Note"],
    ];
    expect(rilevaRigaIntestazione(righe)).toBe(1);
  });

  test("guarda solo le prime 15 righe", () => {
    const primeVuote = Array.from({ length: 15 }, () => ["x"]);
    const intestazioneTardiva = ["Identificativo", "Piano", "Millesimi"];
    const righe = [...primeVuote, intestazioneTardiva];
    // La riga con più celle è oltre il limite delle prime 15: resta la prima.
    expect(rilevaRigaIntestazione(righe)).toBe(0);
  });

  test("foglio vuoto ricade sulla riga 0", () => {
    expect(rilevaRigaIntestazione([])).toBe(0);
  });
});

describe("estraiFoglio", () => {
  test("separa intestazioni e righe dati in base all'indice scelto", () => {
    const foglio = {
      nome: "Foglio1",
      righe: [
        ["Titolo export"],
        ["Identificativo", "Piano"],
        ["Int. 1", "1"],
        ["Int. 2", "2"],
      ],
    };
    const risultato = estraiFoglio(foglio, 1);
    expect(risultato.intestazioni).toEqual(["Identificativo", "Piano"]);
    expect(risultato.righe).toEqual([
      ["Int. 1", "1"],
      ["Int. 2", "2"],
    ]);
  });

  test("converte i valori di intestazione a stringa, con null/undefined a stringa vuota", () => {
    const foglio = { nome: "Foglio1", righe: [[null, undefined, 42]] };
    expect(estraiFoglio(foglio, 0).intestazioni).toEqual(["", "", "42"]);
  });
});
