import { describe, expect, test } from "vitest";
import { adessoLocale, oggiLocale, oraLocale } from "./fuso";

/**
 * Gli istanti sono espressi in UTC apposta: il senso di queste funzioni è
 * proprio che il risultato NON dipenda dal fuso della macchina che esegue i
 * test, ma solo da quello del condominio.
 */
describe("orologio del condominio", () => {
  test("in inverno l'Italia è un'ora avanti rispetto a UTC", () => {
    const istante = new Date("2026-01-15T23:30:00Z");
    expect(oggiLocale(istante)).toBe("2026-01-16");
    expect(oraLocale(istante)).toBe("00:30");
  });

  test("in estate l'ora legale sposta di due ore", () => {
    const istante = new Date("2026-07-15T22:30:00Z");
    expect(oggiLocale(istante)).toBe("2026-07-16");
    expect(oraLocale(istante)).toBe("00:30");
  });

  test("adessoLocale è confrontabile con le fasce salvate", () => {
    const istante = new Date("2026-07-15T16:00:00Z");
    expect(adessoLocale(istante)).toBe("2026-07-15T18:00");
    // Una fascia che inizia dopo è ancora prenotabile, una passata no.
    expect("2026-07-15T18:00" < "2026-07-15T20:00").toBe(true);
    expect(adessoLocale(istante) < "2026-07-15T17:00").toBe(false);
  });

  test("l'ora è sempre a due cifre, senza AM/PM", () => {
    expect(oraLocale(new Date("2026-01-15T08:05:00Z"))).toBe("09:05");
  });
});
