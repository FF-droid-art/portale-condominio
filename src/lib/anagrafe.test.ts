import { describe, expect, test } from "vitest";
import {
  codiceFiscaleValido,
  datiAnagrafeMancanti,
  formatDatiCatastali,
  normalizzaCodiceFiscale,
  normalizzaDatiCatastali,
} from "./anagrafe";

describe("normalizzaCodiceFiscale", () => {
  test("maiuscolo e senza spazi o punteggiatura", () => {
    expect(normalizzaCodiceFiscale(" rssmra80a01h501u ")).toBe("RSSMRA80A01H501U");
    expect(normalizzaCodiceFiscale("RSS MRA 80A01 H501U")).toBe("RSSMRA80A01H501U");
  });

  test("vuoto o assente diventa null (il campo resta facoltativo)", () => {
    expect(normalizzaCodiceFiscale("")).toBeNull();
    expect(normalizzaCodiceFiscale("   ")).toBeNull();
    expect(normalizzaCodiceFiscale(null)).toBeNull();
    expect(normalizzaCodiceFiscale(undefined)).toBeNull();
  });
});

describe("codiceFiscaleValido", () => {
  test("accetta il codice di una persona fisica", () => {
    expect(codiceFiscaleValido("RSSMRA80A01H501U")).toBe(true);
  });

  test("accetta un omocodice (cifre sostituite da lettere)", () => {
    expect(codiceFiscaleValido("RSSMRA80A01H50MU")).toBe(true);
  });

  test("accetta le 11 cifre di una società o di un ente", () => {
    expect(codiceFiscaleValido("12345678901")).toBe(true);
  });

  test("rifiuta lunghezze impossibili", () => {
    expect(codiceFiscaleValido("RSSMRA80A01H501")).toBe(false);
    expect(codiceFiscaleValido("1234567890")).toBe(false);
    expect(codiceFiscaleValido("123456789012")).toBe(false);
  });

  test("rifiuta un mese che non esiste nella codifica", () => {
    // 'F' non è una delle lettere-mese ammesse (A..E, H, L, M, P, R, S, T).
    expect(codiceFiscaleValido("RSSMRA80F01H501U")).toBe(false);
  });

  test("rifiuta cifre dove servono lettere", () => {
    expect(codiceFiscaleValido("RSSMR180A01H501U")).toBe(false);
  });
});

describe("normalizzaDatiCatastali", () => {
  test("ripulisce gli spazi e porta la categoria in maiuscolo", () => {
    expect(
      normalizzaDatiCatastali({
        foglio: " 12 ",
        particella: "345",
        subalterno: "007",
        categoria: " a/2 ",
      })
    ).toEqual({ foglio: "12", particella: "345", subalterno: "007", categoria: "A/2" });
  });

  test("gli zeri iniziali del subalterno non si perdono", () => {
    expect(normalizzaDatiCatastali({ subalterno: "007" }).subalterno).toBe("007");
  });

  test("i campi non compilati diventano null", () => {
    expect(normalizzaDatiCatastali({})).toEqual({
      foglio: null,
      particella: null,
      subalterno: null,
      categoria: null,
    });
    expect(normalizzaDatiCatastali({ foglio: "  ", categoria: null }).foglio).toBeNull();
  });
});

describe("formatDatiCatastali", () => {
  test("forma abbreviata completa", () => {
    expect(
      formatDatiCatastali({
        foglio: "12",
        particella: "345",
        subalterno: "7",
        categoria: "A/2",
      })
    ).toBe("Fg. 12 · Part. 345 · Sub. 7 · A/2");
  });

  test("mostra solo i dati raccolti", () => {
    expect(formatDatiCatastali({ foglio: "12", particella: null })).toBe("Fg. 12");
  });

  test("null quando non c'è ancora nessun dato", () => {
    expect(formatDatiCatastali({})).toBeNull();
    expect(
      formatDatiCatastali({ foglio: null, particella: null, subalterno: null, categoria: null })
    ).toBeNull();
  });
});

describe("datiAnagrafeMancanti", () => {
  test("elenca i dati di legge non ancora raccolti", () => {
    expect(datiAnagrafeMancanti({})).toEqual(["codice fiscale", "residenza o domicilio"]);
    expect(datiAnagrafeMancanti({ codice_fiscale: "RSSMRA80A01H501U" })).toEqual([
      "residenza o domicilio",
    ]);
  });

  test("una stringa di soli spazi conta come dato mancante", () => {
    expect(datiAnagrafeMancanti({ codice_fiscale: "  ", residenza_domicilio: " " })).toEqual([
      "codice fiscale",
      "residenza o domicilio",
    ]);
  });

  test("nessun dato mancante quando il registro è completo", () => {
    expect(
      datiAnagrafeMancanti({
        codice_fiscale: "RSSMRA80A01H501U",
        residenza_domicilio: "Via Roma 1, 00100 Roma (RM)",
      })
    ).toEqual([]);
  });
});
