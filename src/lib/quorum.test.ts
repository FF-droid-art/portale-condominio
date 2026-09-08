import { describe, expect, test } from "vitest";
import {
  calcolaQuorumCostitutivo,
  calcolaQuorumDeliberativo,
  etichettaMaggioranza,
  normalizzaConvocazione,
} from "./quorum";

// Condominio di riferimento: 12 unità, 1000 millesimi.
const EDIFICIO = { unitaTotali: 12, millesimiTotali: 1000 };

describe("quorum costitutivo — prima convocazione (art. 1136 c. 1)", () => {
  test("servono più della metà dei partecipanti e i 2/3 del valore", () => {
    const esito = calcolaQuorumCostitutivo({
      ...EDIFICIO,
      unitaIntervenute: 7,
      millesimiIntervenuti: 666.667,
      convocazione: 1,
    });
    expect(esito.teste.richiesto).toBe(7); // floor(12/2)+1
    expect(esito.millesimi.richiesto).toBeCloseTo(666.667, 3);
    expect(esito.raggiunto).toBe(true);
  });

  test("metà esatta dei partecipanti non basta: serve la maggioranza", () => {
    const esito = calcolaQuorumCostitutivo({
      ...EDIFICIO,
      unitaIntervenute: 6,
      millesimiIntervenuti: 900,
      convocazione: 1,
    });
    expect(esito.teste.raggiunto).toBe(false);
    expect(esito.millesimi.raggiunto).toBe(true);
    expect(esito.raggiunto).toBe(false);
  });

  test("millesimi insufficienti bocciano il quorum anche con tutte le teste", () => {
    const esito = calcolaQuorumCostitutivo({
      ...EDIFICIO,
      unitaIntervenute: 12,
      millesimiIntervenuti: 600,
      convocazione: 1,
    });
    expect(esito.teste.raggiunto).toBe(true);
    expect(esito.millesimi.raggiunto).toBe(false);
    expect(esito.raggiunto).toBe(false);
  });
});

describe("quorum costitutivo — seconda convocazione (art. 1136 c. 3)", () => {
  test("basta un terzo dei partecipanti e un terzo del valore", () => {
    const esito = calcolaQuorumCostitutivo({
      ...EDIFICIO,
      unitaIntervenute: 4,
      millesimiIntervenuti: 333.334,
      convocazione: 2,
    });
    expect(esito.teste.richiesto).toBe(4); // ceil(12/3)
    expect(esito.raggiunto).toBe(true);
  });

  test("il terzo va raggiunto, non superato: 4 su 12 è sufficiente, 3 no", () => {
    const sotto = calcolaQuorumCostitutivo({
      ...EDIFICIO,
      unitaIntervenute: 3,
      millesimiIntervenuti: 400,
      convocazione: 2,
    });
    expect(sotto.raggiunto).toBe(false);
  });

  test("il numero di teste richiesto si arrotonda per eccesso (13 unità → 5)", () => {
    const esito = calcolaQuorumCostitutivo({
      unitaTotali: 13,
      millesimiTotali: 1000,
      unitaIntervenute: 5,
      millesimiIntervenuti: 400,
      convocazione: 2,
    });
    expect(esito.teste.richiesto).toBe(5);
    expect(esito.raggiunto).toBe(true);
  });
});

describe("quorum costitutivo — casi limite", () => {
  test("condominio senza unità non raggiunge mai il quorum", () => {
    const esito = calcolaQuorumCostitutivo({
      unitaTotali: 0,
      millesimiTotali: 0,
      unitaIntervenute: 0,
      millesimiIntervenuti: 0,
      convocazione: 1,
    });
    expect(esito.raggiunto).toBe(false);
  });

  test("i millesimi sono frazioni del totale reale, non del valore fisso 1000", () => {
    const esito = calcolaQuorumCostitutivo({
      unitaTotali: 3,
      millesimiTotali: 900,
      unitaIntervenute: 2,
      millesimiIntervenuti: 600,
      convocazione: 1,
    });
    expect(esito.millesimi.richiesto).toBeCloseTo(600, 6);
    expect(esito.raggiunto).toBe(true);
  });
});

describe("quorum deliberativo — maggioranza semplice", () => {
  test("prima convocazione: maggioranza degli intervenuti + 500 millesimi", () => {
    const esito = calcolaQuorumDeliberativo({
      tipoMaggioranza: "semplice",
      convocazione: 1,
      ...EDIFICIO,
      unitaIntervenute: 8,
      favorevoliUnita: 5,
      favorevoliMillesimi: 500,
    });
    expect(esito.teste.richiesto).toBe(5); // floor(8/2)+1
    expect(esito.millesimi.richiesto).toBe(500);
    expect(esito.raggiunto).toBe(true);
  });

  test("prima convocazione: 490 millesimi non bastano", () => {
    const esito = calcolaQuorumDeliberativo({
      tipoMaggioranza: "semplice",
      convocazione: 1,
      ...EDIFICIO,
      unitaIntervenute: 8,
      favorevoliUnita: 6,
      favorevoliMillesimi: 490,
    });
    expect(esito.millesimi.raggiunto).toBe(false);
    expect(esito.raggiunto).toBe(false);
  });

  test("seconda convocazione: scende a un terzo del valore", () => {
    const esito = calcolaQuorumDeliberativo({
      tipoMaggioranza: "semplice",
      convocazione: 2,
      ...EDIFICIO,
      unitaIntervenute: 8,
      favorevoliUnita: 5,
      favorevoliMillesimi: 340,
    });
    expect(esito.millesimi.richiesto).toBeCloseTo(1000 / 3, 6);
    expect(esito.raggiunto).toBe(true);
  });

  test("metà esatta degli intervenuti non è maggioranza", () => {
    const esito = calcolaQuorumDeliberativo({
      tipoMaggioranza: "semplice",
      convocazione: 2,
      ...EDIFICIO,
      unitaIntervenute: 8,
      favorevoliUnita: 4,
      favorevoliMillesimi: 900,
    });
    expect(esito.teste.raggiunto).toBe(false);
    expect(esito.raggiunto).toBe(false);
  });
});

describe("quorum deliberativo — maggioranze speciali", () => {
  test("qualificata degli intervenuti: 500 millesimi anche in seconda convocazione", () => {
    const esito = calcolaQuorumDeliberativo({
      tipoMaggioranza: "qualificata_intervenuti",
      convocazione: 2,
      ...EDIFICIO,
      unitaIntervenute: 8,
      favorevoliUnita: 5,
      favorevoliMillesimi: 340,
    });
    expect(esito.millesimi.richiesto).toBe(500);
    expect(esito.raggiunto).toBe(false);
  });

  test("innovazioni: servono i 2/3 del valore in entrambe le convocazioni", () => {
    for (const convocazione of [1, 2] as const) {
      const esito = calcolaQuorumDeliberativo({
        tipoMaggioranza: "innovazioni",
        convocazione,
        ...EDIFICIO,
        unitaIntervenute: 10,
        favorevoliUnita: 8,
        favorevoliMillesimi: 700,
      });
      expect(esito.millesimi.richiesto).toBeCloseTo(2000 / 3, 6);
      expect(esito.raggiunto).toBe(true);
    }
  });

  test("unanimità: si misura su tutti i partecipanti, non sui soli intervenuti", () => {
    const esito = calcolaQuorumDeliberativo({
      tipoMaggioranza: "unanimita",
      convocazione: 1,
      ...EDIFICIO,
      unitaIntervenute: 8,
      favorevoliUnita: 8,
      favorevoliMillesimi: 1000,
    });
    expect(esito.teste.base).toBe(12);
    expect(esito.teste.richiesto).toBe(12);
    expect(esito.raggiunto).toBe(false);
  });

  test("un tipo di maggioranza sconosciuto ricade sulla semplice", () => {
    const esito = calcolaQuorumDeliberativo({
      tipoMaggioranza: "inventata",
      convocazione: 1,
      ...EDIFICIO,
      unitaIntervenute: 8,
      favorevoliUnita: 5,
      favorevoliMillesimi: 500,
    });
    expect(esito.etichetta).toBe("Maggioranza semplice");
    expect(esito.raggiunto).toBe(true);
  });

  test("nessun intervenuto: nessuna delibera è valida", () => {
    const esito = calcolaQuorumDeliberativo({
      tipoMaggioranza: "semplice",
      convocazione: 1,
      ...EDIFICIO,
      unitaIntervenute: 0,
      favorevoliUnita: 0,
      favorevoliMillesimi: 0,
    });
    expect(esito.raggiunto).toBe(false);
  });
});

describe("utility", () => {
  test("etichettaMaggioranza restituisce il valore grezzo se sconosciuto", () => {
    expect(etichettaMaggioranza("semplice")).toBe("Maggioranza semplice");
    expect(etichettaMaggioranza("chissa_cosa")).toBe("chissa_cosa");
  });

  test("normalizzaConvocazione accetta solo 1 o 2", () => {
    expect(normalizzaConvocazione(2)).toBe(2);
    expect(normalizzaConvocazione("2")).toBe(2);
    expect(normalizzaConvocazione(null)).toBe(1);
    expect(normalizzaConvocazione(7)).toBe(1);
  });
});
