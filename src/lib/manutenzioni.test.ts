import { describe, expect, test } from "vitest";
import {
  giorniAllaScadenza,
  oggiIso,
  ordinaScadenzario,
  prossimaScadenza,
  urgenzaScadenza,
} from "./manutenzioni";

describe("giorniAllaScadenza", () => {
  test("conta i giorni che mancano, negativi se è passata", () => {
    expect(giorniAllaScadenza("2026-09-15", "2026-09-08")).toBe(7);
    expect(giorniAllaScadenza("2026-09-08", "2026-09-08")).toBe(0);
    expect(giorniAllaScadenza("2026-09-01", "2026-09-08")).toBe(-7);
  });

  test("attraversa i mesi e gli anni", () => {
    expect(giorniAllaScadenza("2027-01-01", "2026-12-31")).toBe(1);
    expect(giorniAllaScadenza("2026-03-01", "2026-02-28")).toBe(1); // 2026 non bisestile
  });

  test("una data non interpretabile non fa esplodere il calcolo", () => {
    expect(giorniAllaScadenza("", "2026-09-08")).toBeNull();
    expect(giorniAllaScadenza("domani", "2026-09-08")).toBeNull();
  });

  test("accetta anche un timestamp completo, di cui usa la sola data", () => {
    expect(giorniAllaScadenza("2026-09-15T23:30:00.000Z", "2026-09-08")).toBe(7);
  });
});

describe("oggiIso", () => {
  test("usa l'orologio del condominio, non quello del processo", () => {
    // 31 dicembre alle 23:30 UTC: in Italia è già il primo dell'anno, ed è
    // quello che deve leggere chi guarda lo scadenzario.
    expect(oggiIso(new Date("2025-12-31T23:30:00Z"))).toBe("2026-01-01");
  });
});

describe("urgenzaScadenza", () => {
  const oggi = "2026-09-08";

  test("distingue scaduta, in scadenza e futura", () => {
    expect(urgenzaScadenza({ data_prossima: "2026-09-07", stato: "programmata" }, oggi)).toBe(
      "scaduta"
    );
    expect(urgenzaScadenza({ data_prossima: "2026-09-08", stato: "programmata" }, oggi)).toBe(
      "in_scadenza"
    );
    expect(urgenzaScadenza({ data_prossima: "2026-10-08", stato: "programmata" }, oggi)).toBe(
      "in_scadenza"
    );
    expect(urgenzaScadenza({ data_prossima: "2026-10-09", stato: "programmata" }, oggi)).toBe(
      "futura"
    );
  });

  test("una manutenzione completata o annullata non è mai urgente", () => {
    expect(urgenzaScadenza({ data_prossima: "2020-01-01", stato: "completata" }, oggi)).toBe(
      "futura"
    );
    expect(urgenzaScadenza({ data_prossima: "2020-01-01", stato: "annullata" }, oggi)).toBe(
      "futura"
    );
  });

  test("il preavviso è configurabile", () => {
    expect(
      urgenzaScadenza({ data_prossima: "2026-09-20", stato: "programmata" }, oggi, 7)
    ).toBe("futura");
    expect(
      urgenzaScadenza({ data_prossima: "2026-09-13", stato: "programmata" }, oggi, 7)
    ).toBe("in_scadenza");
  });
});

describe("prossimaScadenza", () => {
  test("somma i mesi della periodicità", () => {
    expect(prossimaScadenza("2026-09-08", "mensile")).toBe("2026-10-08");
    expect(prossimaScadenza("2026-09-08", "trimestrale")).toBe("2026-12-08");
    expect(prossimaScadenza("2026-09-08", "semestrale")).toBe("2027-03-08");
    expect(prossimaScadenza("2026-09-08", "annuale")).toBe("2027-09-08");
    expect(prossimaScadenza("2026-09-08", "biennale")).toBe("2028-09-08");
  });

  test("una manutenzione una tantum non ha una prossima scadenza", () => {
    expect(prossimaScadenza("2026-09-08", "nessuna")).toBeNull();
  });

  test("un giorno inesistente nel mese di arrivo ricade sull'ultimo giorno", () => {
    expect(prossimaScadenza("2026-01-31", "mensile")).toBe("2026-02-28");
    expect(prossimaScadenza("2026-08-31", "mensile")).toBe("2026-09-30");
    // 2028 è bisestile: il 29 febbraio esiste
    expect(prossimaScadenza("2028-01-31", "mensile")).toBe("2028-02-29");
  });

  test("una data non interpretabile restituisce null invece di una data sbagliata", () => {
    expect(prossimaScadenza("31/01/2026", "annuale")).toBeNull();
  });
});

describe("ordinaScadenzario", () => {
  const oggi = "2026-09-08";

  test("prima le scadenze aperte in ordine di data, poi le chiuse", () => {
    const righe = ordinaScadenzario(
      [
        { titolo: "Estintori", data_prossima: "2026-12-01", stato: "programmata" as const },
        { titolo: "Caldaia", data_prossima: "2026-08-01", stato: "programmata" as const },
        { titolo: "Ascensore", data_prossima: "2026-01-01", stato: "completata" as const },
        { titolo: "Tetto", data_prossima: "2026-09-20", stato: "programmata" as const },
      ],
      oggi
    );

    expect(righe.map((r) => r.manutenzione.titolo)).toEqual([
      "Caldaia",
      "Tetto",
      "Estintori",
      "Ascensore",
    ]);
    expect(righe[0].urgenza).toBe("scaduta");
    expect(righe[1].urgenza).toBe("in_scadenza");
    expect(righe[2].urgenza).toBe("futura");
  });

  test("a parità di data l'ordine è alfabetico, quindi stabile", () => {
    const righe = ordinaScadenzario(
      [
        { titolo: "Zanzariere", data_prossima: "2026-10-01", stato: "programmata" as const },
        { titolo: "Antenna", data_prossima: "2026-10-01", stato: "programmata" as const },
      ],
      oggi
    );
    expect(righe.map((r) => r.manutenzione.titolo)).toEqual(["Antenna", "Zanzariere"]);
  });
});
