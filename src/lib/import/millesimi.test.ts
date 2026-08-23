import { describe, expect, test } from "vitest";
import { colonneMillesimi, nomeTabellaMillesimi } from "./millesimi";

describe("nomeTabellaMillesimi", () => {
  test("toglie il prefisso 'Millesimi' e capitalizza", () => {
    expect(nomeTabellaMillesimi("Millesimi proprietà generali")).toBe("Generali");
  });

  test("gestisce intestazioni senza 'proprietà'", () => {
    expect(nomeTabellaMillesimi("Millesimi ascensore")).toBe("Ascensore");
  });

  test("preserva il resto del nome, es. 'Scala A'", () => {
    expect(nomeTabellaMillesimi("Millesimi scala A")).toBe("Scala A");
  });

  test("intestazione vuota dopo la pulizia ricade su 'Generali'", () => {
    expect(nomeTabellaMillesimi("Millesimi")).toBe("Generali");
  });
});

describe("colonneMillesimi", () => {
  test("individua tutte le colonne che contengono 'millesim'", () => {
    const colonne = colonneMillesimi([
      "Identificativo",
      "Millesimi proprietà generali",
      "Millesimi ascensore",
      "Piano",
    ]);
    expect(colonne).toEqual([
      { indice: 1, nome: "Generali" },
      { indice: 2, nome: "Ascensore" },
    ]);
  });

  test("nessuna colonna millesimi restituisce array vuoto", () => {
    expect(colonneMillesimi(["Identificativo", "Piano"])).toEqual([]);
  });
});
