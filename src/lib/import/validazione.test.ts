import { describe, expect, test } from "vitest";
import { validaRigaCondominioUnita, validaRigaSpesa, validaRigaUnita } from "./validazione";
import type { RigaImportCondominioUnita, RigaImportSpesa, RigaImportUnita } from "./tipi";

function rigaCondominioUnita(
  overrides: Partial<RigaImportCondominioUnita>
): RigaImportCondominioUnita {
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

describe("validaRigaCondominioUnita", () => {
  test("riga completa senza persona è valida", () => {
    expect(validaRigaCondominioUnita(rigaCondominioUnita({}))).toBeNull();
  });

  test("richiede il nome del condominio", () => {
    expect(validaRigaCondominioUnita(rigaCondominioUnita({ nomeCondominio: "  " }))).not.toBeNull();
  });

  test("richiede l'indirizzo del condominio", () => {
    expect(
      validaRigaCondominioUnita(rigaCondominioUnita({ indirizzoCondominio: "" }))
    ).not.toBeNull();
  });

  test("richiede l'identificativo unità", () => {
    expect(validaRigaCondominioUnita(rigaCondominioUnita({ identificativo: "" }))).not.toBeNull();
  });

  test("millesimi mancanti (NaN) sono ammessi", () => {
    expect(
      validaRigaCondominioUnita(rigaCondominioUnita({ millesimiProprieta: NaN }))
    ).toBeNull();
  });

  test("millesimi negativi sono rifiutati", () => {
    expect(
      validaRigaCondominioUnita(rigaCondominioUnita({ millesimiProprieta: -1 }))
    ).not.toBeNull();
  });

  test("quota della persona fuori intervallo (1-100) è rifiutata", () => {
    expect(
      validaRigaCondominioUnita(rigaCondominioUnita({ nominativo: "Mario Rossi", quota: 150 }))
    ).not.toBeNull();
    expect(
      validaRigaCondominioUnita(rigaCondominioUnita({ nominativo: "Mario Rossi", quota: 0 }))
    ).not.toBeNull();
  });

  test("quota valida (1-100) con persona è accettata", () => {
    expect(
      validaRigaCondominioUnita(rigaCondominioUnita({ nominativo: "Mario Rossi", quota: 50 }))
    ).toBeNull();
  });

  test("senza persona la quota non viene controllata", () => {
    expect(
      validaRigaCondominioUnita(rigaCondominioUnita({ nominativo: null, quota: 999 }))
    ).toBeNull();
  });
});

describe("validaRigaUnita", () => {
  function rigaUnita(overrides: Partial<RigaImportUnita>): RigaImportUnita {
    return { identificativo: "Int. 1", piano: null, millesimi_proprieta: 100, ...overrides };
  }

  test("riga valida", () => {
    expect(validaRigaUnita(rigaUnita({}))).toBeNull();
  });

  test("richiede l'identificativo", () => {
    expect(validaRigaUnita(rigaUnita({ identificativo: "" }))).not.toBeNull();
  });

  test("richiede millesimi numerici", () => {
    expect(validaRigaUnita(rigaUnita({ millesimi_proprieta: NaN }))).not.toBeNull();
  });

  test("rifiuta millesimi negativi", () => {
    expect(validaRigaUnita(rigaUnita({ millesimi_proprieta: -5 }))).not.toBeNull();
  });
});

describe("validaRigaSpesa", () => {
  function rigaSpesa(overrides: Partial<RigaImportSpesa>): RigaImportSpesa {
    return {
      identificativoUnita: "Int. 1",
      descrizione: "Pulizie scale",
      categoria: "Manutenzione",
      dataSpesa: "2026-01-15",
      importoDovuto: 50,
      fornitore: null,
      statoPagamento: "da_pagare",
      dataScadenza: null,
      dataPagamento: null,
      ...overrides,
    };
  }

  test("riga valida", () => {
    expect(validaRigaSpesa(rigaSpesa({}))).toBeNull();
  });

  test("rifiuta una data spesa mal formattata", () => {
    expect(validaRigaSpesa(rigaSpesa({ dataSpesa: "15/01/2026" }))).not.toBeNull();
  });

  test("rifiuta uno stato pagamento non valido", () => {
    expect(
      validaRigaSpesa(rigaSpesa({ statoPagamento: "sconosciuto" as never }))
    ).not.toBeNull();
  });

  test("rifiuta un importo dovuto negativo", () => {
    expect(validaRigaSpesa(rigaSpesa({ importoDovuto: -10 }))).not.toBeNull();
  });

  test("accetta data scadenza e data pagamento assenti", () => {
    expect(
      validaRigaSpesa(rigaSpesa({ dataScadenza: null, dataPagamento: null }))
    ).toBeNull();
  });
});
