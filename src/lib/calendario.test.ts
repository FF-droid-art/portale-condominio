import { describe, expect, test } from "vitest";
import {
  grigliaMese,
  meseDi,
  nomeMese,
  prossimiEventi,
  raccogliEventi,
  raggruppaPerGiorno,
  raggruppaPerMese,
  spostaMese,
  type EventoCalendario,
} from "./calendario";

const SORGENTI = {
  assemblee: [
    {
      id: "a1",
      dataOra: "2026-09-10T18:30:00+00:00",
      tipo: "ordinaria",
      stato: "convocata",
      condominio: "Il Glicine",
    },
    {
      id: "a2",
      dataOra: "2026-03-02T21:00:00+00:00",
      tipo: "straordinaria",
      stato: "conclusa",
      condominio: "Il Glicine",
    },
  ],
  manutenzioni: [
    {
      id: "m1",
      dataProssima: "2026-09-10",
      titolo: "Verifica ascensore",
      stato: "programmata",
      condominio: "Il Glicine",
      fornitore: "Ascensori Bologna",
    },
    {
      id: "m2",
      dataProssima: "2026-09-15",
      titolo: "Revisione caldaia",
      stato: "completata",
      condominio: "Il Glicine",
      fornitore: null,
    },
  ],
  prenotazioni: [
    {
      id: "p1",
      inizio: "2026-09-12T18:00:00+00:00",
      fine: "2026-09-12T20:00:00+00:00",
      stato: "confermata",
      spazio: "Sala condominiale",
      unita: "Interno 3",
    },
    {
      id: "p2",
      inizio: "2026-09-13T18:00:00+00:00",
      fine: "2026-09-13T20:00:00+00:00",
      stato: "annullata",
      spazio: "Sala condominiale",
      unita: "Interno 3",
    },
  ],
  ripartizioni: [
    {
      id: "r1",
      dataScadenza: "2026-09-30",
      statoPagamento: "da_pagare",
      importo: 240,
      descrizione: "Rata ordinaria",
      unita: "Interno 3",
    },
    {
      id: "r2",
      dataScadenza: "2026-09-30",
      statoPagamento: "pagato",
      importo: 240,
      descrizione: "Rata ordinaria",
      unita: "Interno 1",
    },
    {
      id: "r3",
      dataScadenza: null,
      statoPagamento: "da_pagare",
      importo: 100,
      descrizione: "Conguaglio",
      unita: "Interno 5",
    },
  ],
};

describe("raccogliEventi", () => {
  test("mette insieme le quattro sorgenti in ordine di tempo", () => {
    const eventi = raccogliEventi(SORGENTI);
    expect(eventi.map((e) => `${e.data} ${e.tipo}`)).toEqual([
      "2026-03-02 assemblea",
      // Nello stesso giorno la manutenzione (tutto il giorno) precede
      // l'assemblea, che ha un orario.
      "2026-09-10 manutenzione",
      "2026-09-10 assemblea",
      "2026-09-12 prenotazione",
      "2026-09-30 scadenza_pagamento",
    ]);
  });

  test("lascia fuori manutenzioni chiuse, prenotazioni annullate e quote saldate", () => {
    const eventi = raccogliEventi(SORGENTI);
    expect(eventi.map((e) => e.titolo)).not.toContain("Revisione caldaia");
    expect(eventi.filter((e) => e.tipo === "prenotazione")).toHaveLength(1);
    expect(eventi.filter((e) => e.tipo === "scadenza_pagamento")).toHaveLength(1);
  });

  test("una quota senza data di scadenza non finisce sul calendario", () => {
    const eventi = raccogliEventi({ ripartizioni: SORGENTI.ripartizioni });
    expect(eventi.map((e) => e.titolo)).not.toContain("Conguaglio");
  });

  test("il giorno si legge dalla stringa, non dal fuso del processo", () => {
    // Le 00:30 di un istante salvato come orologio da parete restano quel
    // giorno, anche se il server gira in un altro fuso.
    const eventi = raccogliEventi({
      assemblee: [
        {
          id: "a",
          dataOra: "2026-09-10T00:30:00+00:00",
          tipo: "ordinaria",
          stato: "convocata",
          condominio: null,
        },
      ],
    });
    expect(eventi[0].data).toBe("2026-09-10");
    expect(eventi[0].ora).toBe("00:30");
  });

  test("le scadenze e le manutenzioni non hanno un'ora", () => {
    const eventi = raccogliEventi(SORGENTI);
    expect(eventi.find((e) => e.tipo === "manutenzione")?.ora).toBeNull();
    expect(eventi.find((e) => e.tipo === "scadenza_pagamento")?.ora).toBeNull();
  });

  test("la prenotazione porta con sé la fascia oraria e l'unità", () => {
    const evento = raccogliEventi(SORGENTI).find((e) => e.tipo === "prenotazione");
    expect(evento?.titolo).toBe("Sala condominiale");
    expect(evento?.sottotitolo).toBe("18:00 – 20:00 · Interno 3");
  });

  test("i collegamenti seguono l'area di chi guarda", () => {
    const admin = raccogliEventi({ assemblee: SORGENTI.assemblee, area: "admin" });
    const condomino = raccogliEventi({ assemblee: SORGENTI.assemblee, area: "condomino" });
    expect(admin[0].href).toBe("/admin/assemblee/a2");
    expect(condomino[0].href).toBe("/area-riservata/assemblee/a2");
  });

  test("lo scadenzario delle manutenzioni non è raggiungibile dal condòmino", () => {
    const condomino = raccogliEventi({ manutenzioni: SORGENTI.manutenzioni, area: "condomino" });
    expect(condomino[0].href).toBeNull();
    expect(condomino[0].titolo).toBe("Verifica ascensore");
  });

  test("senza sorgenti non produce eventi", () => {
    expect(raccogliEventi({})).toEqual([]);
  });

  test("una data illeggibile viene scartata invece di far cadere la pagina", () => {
    const eventi = raccogliEventi({
      manutenzioni: [
        {
          id: "m",
          dataProssima: "prossimamente",
          titolo: "Boh",
          stato: "programmata",
          condominio: null,
          fornitore: null,
        },
      ],
    });
    expect(eventi).toEqual([]);
  });

  test("nello stesso giorno quel che dura tutto il giorno sta sopra all'appuntamento", () => {
    const eventi = raccogliEventi(SORGENTI).filter((e) => e.data === "2026-09-10");
    expect(eventi.map((e) => e.tipo)).toEqual(["manutenzione", "assemblea"]);
  });
});

describe("raggruppamenti", () => {
  const eventi = raccogliEventi(SORGENTI);

  test("raggruppaPerGiorno indicizza per data", () => {
    const perGiorno = raggruppaPerGiorno(eventi);
    expect(perGiorno.get("2026-09-10")).toHaveLength(2);
    expect(perGiorno.get("2026-01-01")).toBeUndefined();
  });

  test("raggruppaPerMese ordina i mesi", () => {
    expect(raggruppaPerMese(eventi).map((g) => g.mese)).toEqual(["2026-03", "2026-09"]);
  });

  test("prossimiEventi taglia il passato e rispetta il limite", () => {
    expect(prossimiEventi(eventi, "2026-09-11").map((e) => e.tipo)).toEqual([
      "prenotazione",
      "scadenza_pagamento",
    ]);
    expect(prossimiEventi(eventi, "2026-01-01", 2)).toHaveLength(2);
  });

  test("prossimiEventi tiene dentro quello che capita oggi", () => {
    expect(prossimiEventi(eventi, "2026-09-10")).toHaveLength(4);
  });

  test("un elenco vuoto non rompe nessun raggruppamento", () => {
    const vuoti: EventoCalendario[] = [];
    expect(raggruppaPerMese(vuoti)).toEqual([]);
    expect(raggruppaPerGiorno(vuoti).size).toBe(0);
    expect(prossimiEventi(vuoti, "2026-09-10")).toEqual([]);
  });
});

describe("griglia del mese", () => {
  test("comincia di lunedì e finisce di domenica", () => {
    // 1 settembre 2026 è un martedì: la griglia parte da lunedì 31 agosto.
    const settimane = grigliaMese("2026-09");
    expect(settimane[0][0].data).toBe("2026-08-31");
    expect(settimane[0][0].nelMese).toBe(false);
    expect(settimane[0][1].data).toBe("2026-09-01");
    expect(settimane[0][1].nelMese).toBe(true);
    expect(settimane.every((s) => s.length === 7)).toBe(true);
  });

  test("contiene tutti i giorni del mese una volta sola", () => {
    const giorni = grigliaMese("2026-02")
      .flat()
      .filter((g) => g.nelMese)
      .map((g) => g.data);
    expect(giorni).toHaveLength(28);
    expect(new Set(giorni).size).toBe(28);
    expect(giorni[0]).toBe("2026-02-01");
    expect(giorni[27]).toBe("2026-02-28");
  });

  test("regge un mese che inizia di lunedì senza settimane vuote", () => {
    // 1 giugno 2026 è un lunedì.
    const settimane = grigliaMese("2026-06");
    expect(settimane[0][0].data).toBe("2026-06-01");
    expect(settimane.every((s) => s.some((g) => g.nelMese))).toBe(true);
  });

  test("regge l'anno bisestile", () => {
    const giorni = grigliaMese("2028-02")
      .flat()
      .filter((g) => g.nelMese);
    expect(giorni).toHaveLength(29);
  });

  test("un mese scritto male ricade sul mese corrente invece di rompersi", () => {
    expect(grigliaMese("boh").length).toBeGreaterThan(3);
  });
});

describe("navigazione tra i mesi", () => {
  test("spostaMese scavalca l'anno in entrambe le direzioni", () => {
    expect(spostaMese("2026-09", 1)).toBe("2026-10");
    expect(spostaMese("2026-12", 1)).toBe("2027-01");
    expect(spostaMese("2026-01", -1)).toBe("2025-12");
    expect(spostaMese("2026-09", -12)).toBe("2025-09");
  });

  test("meseDi taglia una data al mese", () => {
    expect(meseDi("2026-09-10")).toBe("2026-09");
  });

  test("nomeMese scrive il mese in italiano", () => {
    expect(nomeMese("2026-09")).toBe("settembre 2026");
    expect(nomeMese("2026-01")).toBe("gennaio 2026");
    expect(nomeMese("boh")).toBe("boh");
  });
});
