import { describe, expect, test } from "vitest";
import { normalizzaQualifica } from "./qualifica";

describe("normalizzaQualifica", () => {
  test("riconosce un proprietario", () => {
    expect(normalizzaQualifica("Proprietario")).toEqual({
      tipoSoggetto: "proprietario",
      attivo: true,
    });
  });

  test("riconosce un ex proprietario come storico", () => {
    expect(normalizzaQualifica("Ex proprietario")).toEqual({
      tipoSoggetto: "proprietario",
      attivo: false,
    });
  });

  test("è case-insensitive e ignora gli accenti", () => {
    expect(normalizzaQualifica("USUFRUTTUÀRIO")).toEqual({
      tipoSoggetto: "usufruttuario",
      attivo: true,
    });
  });

  test("con ruoli combinati prende quello che compare per primo", () => {
    expect(normalizzaQualifica("Conduttore, Proprietario")).toEqual({
      tipoSoggetto: "conduttore",
      attivo: true,
    });
  });

  test("'nudo proprietario' non viene scavalcato da 'proprietario'", () => {
    expect(normalizzaQualifica("Nudo proprietario")).toEqual({
      tipoSoggetto: "nudo_proprietario",
      attivo: true,
    });
  });

  test("qualifica assente o non riconosciuta ricade su proprietario attivo", () => {
    expect(normalizzaQualifica(null)).toEqual({
      tipoSoggetto: "proprietario",
      attivo: true,
    });
    expect(normalizzaQualifica("boh")).toEqual({
      tipoSoggetto: "proprietario",
      attivo: true,
    });
  });

  test("'ex' deve essere una parola intera, non un prefisso qualsiasi", () => {
    // "extracomunitario" non deve attivare la regola "ex ...".
    expect(normalizzaQualifica("Extraproprietario")).toEqual({
      tipoSoggetto: "proprietario",
      attivo: true,
    });
  });
});
