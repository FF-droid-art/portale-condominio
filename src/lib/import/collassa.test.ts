import { describe, expect, test } from "vitest";
import { collassaUnita, preparaRighePersone } from "./collassa";
import type { RigaImportCondominioUnita } from "./tipi";

function riga(overrides: Partial<RigaImportCondominioUnita>): RigaImportCondominioUnita {
  return {
    nomeCondominio: "Condominio Rossi",
    indirizzoCondominio: "Via Roma 1",
    codiceFiscaleCondominio: null,
    identificativo: "Int. 1",
    piano: null,
    millesimiProprieta: NaN,
    nominativo: null,
    email: null,
    qualifica: null,
    quota: NaN,
    ...overrides,
  };
}

describe("preparaRighePersone", () => {
  test("deriva il nome condominio dall'indirizzo se assente", () => {
    const [r] = preparaRighePersone([riga({ nomeCondominio: "" })]);
    expect(r.nomeCondominio).toBe("Via Roma 1");
  });

  test("scarta le righe senza identificativo né indirizzo (righe di coda/totale)", () => {
    const righe = preparaRighePersone([
      riga({}),
      riga({ identificativo: "", indirizzoCondominio: "" }),
    ]);
    expect(righe).toHaveLength(1);
  });

  test("mantiene una riga per occupante (non collassa)", () => {
    const righe = preparaRighePersone([
      riga({ nominativo: "Mario Rossi" }),
      riga({ nominativo: "Anna Bianchi" }),
    ]);
    expect(righe).toHaveLength(2);
  });
});

describe("collassaUnita", () => {
  test("fonde più righe della stessa unità in una sola", () => {
    const righe = collassaUnita([
      riga({ nominativo: "Mario Rossi" }),
      riga({ nominativo: "Anna Bianchi" }),
    ]);
    expect(righe).toHaveLength(1);
  });

  test("tiene il millesimo valido più alto tra le righe (ignora NaN)", () => {
    const [r] = collassaUnita([
      riga({ millesimiProprieta: NaN }),
      riga({ millesimiProprieta: 123.456 }),
    ]);
    expect(r.millesimiProprieta).toBe(123.456);
  });

  test("resta NaN se nessuna riga ha un millesimo valido", () => {
    const [r] = collassaUnita([riga({}), riga({})]);
    expect(Number.isNaN(r.millesimiProprieta)).toBe(true);
  });

  test("unità diverse restano righe separate", () => {
    const righe = collassaUnita([
      riga({ identificativo: "Int. 1" }),
      riga({ identificativo: "Int. 2" }),
    ]);
    expect(righe).toHaveLength(2);
  });

  test("riempie piano e codice fiscale mancanti da un'altra riga della stessa unità", () => {
    const [r] = collassaUnita([
      riga({ piano: null, codiceFiscaleCondominio: null }),
      riga({ piano: "2", codiceFiscaleCondominio: "ABC123" }),
    ]);
    expect(r.piano).toBe("2");
    expect(r.codiceFiscaleCondominio).toBe("ABC123");
  });
});
