import { describe, expect, test } from "vitest";
import { contaSegnalazioni, ordinaSegnalazioni } from "./segnalazioni";
import type { PrioritaSegnalazione, StatoSegnalazione } from "@/lib/types";

function s(
  id: string,
  stato: StatoSegnalazione,
  priorita: PrioritaSegnalazione,
  aggiornata_il: string
) {
  return { id, stato, priorita, aggiornata_il };
}

describe("ordinaSegnalazioni", () => {
  test("le aperte vengono prima delle in corso, le chiuse per ultime", () => {
    const righe = ordinaSegnalazioni([
      s("chiusa", "chiusa", "alta", "2026-09-08T10:00:00Z"),
      s("in-corso", "in_corso", "alta", "2026-09-08T10:00:00Z"),
      s("aperta", "aperta", "bassa", "2026-01-01T10:00:00Z"),
    ]);
    expect(righe.map((r) => r.id)).toEqual(["aperta", "in-corso", "chiusa"]);
  });

  test("a parità di stato conta la priorità", () => {
    const righe = ordinaSegnalazioni([
      s("bassa", "aperta", "bassa", "2026-09-08T12:00:00Z"),
      s("alta", "aperta", "alta", "2026-09-01T12:00:00Z"),
      s("normale", "aperta", "normale", "2026-09-05T12:00:00Z"),
    ]);
    expect(righe.map((r) => r.id)).toEqual(["alta", "normale", "bassa"]);
  });

  test("a parità di stato e priorità vince l'ultimo movimento", () => {
    const righe = ordinaSegnalazioni([
      s("vecchia", "aperta", "normale", "2026-08-01T12:00:00Z"),
      s("recente", "aperta", "normale", "2026-09-08T12:00:00Z"),
    ]);
    expect(righe.map((r) => r.id)).toEqual(["recente", "vecchia"]);
  });

  test("non modifica l'array ricevuto", () => {
    const originale = [
      s("a", "chiusa", "bassa", "2026-01-01T00:00:00Z"),
      s("b", "aperta", "alta", "2026-01-01T00:00:00Z"),
    ];
    ordinaSegnalazioni(originale);
    expect(originale.map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("contaSegnalazioni", () => {
  test("conta per stato e isola le urgenti ancora aperte", () => {
    const conteggi = contaSegnalazioni([
      { stato: "aperta", priorita: "alta" },
      { stato: "aperta", priorita: "normale" },
      { stato: "in_corso", priorita: "alta" },
      { stato: "chiusa", priorita: "alta" },
    ]);

    expect(conteggi).toEqual({
      aperte: 2,
      inCorso: 1,
      chiuse: 1,
      urgenti: 2,
      totale: 4,
    });
  });

  test("un elenco vuoto dà tutti zero", () => {
    expect(contaSegnalazioni([])).toEqual({
      aperte: 0,
      inCorso: 0,
      chiuse: 0,
      urgenti: 0,
      totale: 0,
    });
  });
});
