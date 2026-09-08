import { describe, expect, test } from "vitest";
import { aggregaRisultati, motivoChiusura, sondaggioAperto } from "./sondaggi";

const OPZIONI = [
  { id: "b", testo: "No", ordine: 2 },
  { id: "a", testo: "Sì", ordine: 1 },
  { id: "c", testo: "Astenuto", ordine: 3 },
];

describe("aggregaRisultati", () => {
  test("ordina per 'ordine' e riempie di zeri le opzioni senza risposte", () => {
    const r = aggregaRisultati({
      opzioni: OPZIONI,
      conteggi: [{ opzione_id: "a", risposte: 2, millesimi: 300 }],
      unitaTotali: 10,
      millesimiTotali: 1000,
      ponderato: false,
    });
    expect(r.opzioni.map((o) => o.testo)).toEqual(["Sì", "No", "Astenuto"]);
    expect(r.opzioni[1]).toMatchObject({ risposte: 0, millesimi: 0, percentualeRisposte: 0 });
  });

  test("percentuali per teste e per millesimi con basi diverse", () => {
    const r = aggregaRisultati({
      opzioni: OPZIONI,
      conteggi: [
        { opzione_id: "a", risposte: 3, millesimi: 200 },
        { opzione_id: "b", risposte: 1, millesimi: 400 },
      ],
      unitaTotali: 8,
      millesimiTotali: 1000,
      ponderato: false,
    });
    expect(r.risposteTotali).toBe(4);
    expect(r.millesimiTotaliRisposte).toBe(600);

    const si = r.opzioni[0];
    expect(si.percentualeRisposte).toBe(75);
    expect(si.percentualeMillesimi).toBeCloseTo(33.333, 3);
    expect(si.percentualeEdificio).toBe(20);

    expect(r.partecipazioneUnita).toBe(50);
    expect(r.partecipazioneMillesimi).toBe(60);
  });

  test("non ponderato: in testa chi ha più risposte", () => {
    const r = aggregaRisultati({
      opzioni: OPZIONI,
      conteggi: [
        { opzione_id: "a", risposte: 3, millesimi: 100 },
        { opzione_id: "b", risposte: 1, millesimi: 500 },
      ],
      unitaTotali: 8,
      millesimiTotali: 1000,
      ponderato: false,
    });
    expect(r.opzioni.find((o) => o.inTesta)?.testo).toBe("Sì");
  });

  test("ponderato: in testa chi ha più millesimi, anche con meno risposte", () => {
    const r = aggregaRisultati({
      opzioni: OPZIONI,
      conteggi: [
        { opzione_id: "a", risposte: 3, millesimi: 100 },
        { opzione_id: "b", risposte: 1, millesimi: 500 },
      ],
      unitaTotali: 8,
      millesimiTotali: 1000,
      ponderato: true,
    });
    expect(r.opzioni.find((o) => o.inTesta)?.testo).toBe("No");
  });

  test("il pareggio mette in testa entrambe le opzioni", () => {
    const r = aggregaRisultati({
      opzioni: OPZIONI,
      conteggi: [
        { opzione_id: "a", risposte: 2, millesimi: 100 },
        { opzione_id: "b", risposte: 2, millesimi: 500 },
      ],
      unitaTotali: 8,
      millesimiTotali: 1000,
      ponderato: false,
    });
    expect(r.opzioni.filter((o) => o.inTesta)).toHaveLength(2);
  });

  test("nessuna risposta: nessuna opzione in testa e nessuna divisione per zero", () => {
    const r = aggregaRisultati({
      opzioni: OPZIONI,
      conteggi: [],
      unitaTotali: 0,
      millesimiTotali: 0,
      ponderato: true,
    });
    expect(r.opzioni.every((o) => !o.inTesta)).toBe(true);
    expect(r.partecipazioneUnita).toBe(0);
    expect(r.partecipazioneMillesimi).toBe(0);
    expect(r.opzioni[0].percentualeRisposte).toBe(0);
  });
});

describe("sondaggioAperto / motivoChiusura", () => {
  const adesso = new Date("2026-09-08T12:00:00.000Z");

  test("aperto senza scadenza", () => {
    const s = { stato: "aperto", scadenza: null };
    expect(sondaggioAperto(s, adesso)).toBe(true);
    expect(motivoChiusura(s, adesso)).toBeNull();
  });

  test("aperto con scadenza futura", () => {
    const s = { stato: "aperto", scadenza: "2026-09-10T00:00:00.000Z" };
    expect(sondaggioAperto(s, adesso)).toBe(true);
  });

  test("scaduto", () => {
    const s = { stato: "aperto", scadenza: "2026-09-07T00:00:00.000Z" };
    expect(sondaggioAperto(s, adesso)).toBe(false);
    expect(motivoChiusura(s, adesso)).toBe("scaduto");
  });

  test("chiuso a mano prevale sulla scadenza futura", () => {
    const s = { stato: "chiuso", scadenza: "2026-09-10T00:00:00.000Z" };
    expect(sondaggioAperto(s, adesso)).toBe(false);
    expect(motivoChiusura(s, adesso)).toBe("chiuso_manualmente");
  });
});
