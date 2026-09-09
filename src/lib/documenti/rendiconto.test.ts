import { describe, expect, test } from "vitest";
import {
  costruisciRendiconto,
  riepilogaRendiconto,
  type QuotaRendiconto,
  type UscitaRendiconto,
} from "./rendiconto";
import type { Blocco } from "./modello";

function testoDi(blocchi: Blocco[]): string {
  return blocchi
    .map((b) => {
      switch (b.tipo) {
        case "spazio":
          return "";
        case "campo":
          return `${b.etichetta}: ${b.valore}`;
        case "elenco":
          return b.voci.join("\n");
        default:
          return b.testo;
      }
    })
    .join("\n");
}

function uscita(over: Partial<UscitaRendiconto> = {}): UscitaRendiconto {
  return {
    dataSpesa: "2026-03-10",
    categoria: "ordinaria",
    descrizione: "Pulizie scale",
    importo: 500,
    ...over,
  };
}

function quota(over: Partial<QuotaRendiconto> = {}): QuotaRendiconto {
  return {
    unita: "Interno 1",
    dataCompetenza: "2026-03-31",
    importo: 100,
    statoPagamento: "pagato",
    dataPagamento: "2026-04-02",
    ...over,
  };
}

describe("riepilogaRendiconto — uscite", () => {
  test("raggruppa per categoria e ordina dalla più pesante", () => {
    const r = riepilogaRendiconto({
      anno: 2026,
      uscite: [
        uscita({ categoria: "ordinaria", importo: 100 }),
        uscita({ categoria: "straordinaria", importo: 900 }),
        uscita({ categoria: "ordinaria", importo: 300 }),
      ],
      quote: [],
    });

    expect(r.uscitePerCategoria).toEqual([
      { categoria: "straordinaria", totale: 900, numero: 1 },
      { categoria: "ordinaria", totale: 400, numero: 2 },
    ]);
    expect(r.totaleUscite).toBe(1300);
  });

  test("le spese di altri anni restano fuori", () => {
    const r = riepilogaRendiconto({
      anno: 2026,
      uscite: [uscita({ dataSpesa: "2025-12-31" }), uscita({ dataSpesa: "2026-01-01" })],
      quote: [],
    });
    expect(r.totaleUscite).toBe(500);
  });

  test("una categoria vuota non sparisce, prende un nome leggibile", () => {
    const r = riepilogaRendiconto({
      anno: 2026,
      uscite: [uscita({ categoria: "  " })],
      quote: [],
    });
    expect(r.uscitePerCategoria[0].categoria).toBe("Senza categoria");
  });
});

describe("riepilogaRendiconto — cassa e competenza", () => {
  test("le entrate contano l'anno del versamento, non quello della quota", () => {
    const r = riepilogaRendiconto({
      anno: 2026,
      uscite: [],
      quote: [
        // Quota del 2025 saldata nel 2026: entra nella cassa 2026.
        quota({ dataCompetenza: "2025-11-30", dataPagamento: "2026-02-01", importo: 70 }),
        // Quota del 2026 saldata nel 2027: fuori dalla cassa 2026.
        quota({ dataCompetenza: "2026-11-30", dataPagamento: "2027-01-15", importo: 90 }),
      ],
    });
    expect(r.totaleEntrate).toBe(70);
  });

  test("la competenza per unità guarda l'anno della quota, non del pagamento", () => {
    const r = riepilogaRendiconto({
      anno: 2026,
      uscite: [],
      quote: [
        quota({ dataCompetenza: "2025-11-30", importo: 70 }),
        quota({ dataCompetenza: "2026-11-30", dataPagamento: "2027-01-15", importo: 90 }),
      ],
    });
    expect(r.unita).toEqual([
      { identificativo: "Interno 1", dovuto: 90, versato: 90, residuo: 0 },
    ]);
  });

  test("dovuto, versato e residuo per unità", () => {
    const r = riepilogaRendiconto({
      anno: 2026,
      uscite: [],
      quote: [
        quota({ unita: "Interno 1", importo: 100, statoPagamento: "pagato" }),
        quota({
          unita: "Interno 1",
          importo: 50,
          statoPagamento: "da_pagare",
          dataPagamento: null,
        }),
        quota({
          unita: "Interno 2",
          importo: 200,
          statoPagamento: "in_ritardo",
          dataPagamento: null,
        }),
      ],
    });

    expect(r.unita).toEqual([
      { identificativo: "Interno 1", dovuto: 150, versato: 100, residuo: 50 },
      { identificativo: "Interno 2", dovuto: 200, versato: 0, residuo: 200 },
    ]);
    expect(r.totaleDovuto).toBe(350);
    expect(r.totaleVersato).toBe(100);
    expect(r.totaleResiduo).toBe(250);
  });

  test("le unità sono ordinate in modo naturale (2 prima di 10)", () => {
    const r = riepilogaRendiconto({
      anno: 2026,
      uscite: [],
      quote: [
        quota({ unita: "Interno 10" }),
        quota({ unita: "Interno 2" }),
        quota({ unita: "Interno 1" }),
      ],
    });
    expect(r.unita.map((u) => u.identificativo)).toEqual([
      "Interno 1",
      "Interno 2",
      "Interno 10",
    ]);
  });

  test("il saldo è entrate meno uscite", () => {
    const r = riepilogaRendiconto({
      anno: 2026,
      uscite: [uscita({ importo: 800 })],
      quote: [quota({ importo: 500 })],
    });
    expect(r.saldo).toBe(-300);
  });
});

describe("costruisciRendiconto", () => {
  const dati = {
    condominio: { nome: "Il Glicine", indirizzo: "Via Roma 1", codiceFiscale: "91234567890" },
    anno: 2026,
    uscite: [uscita({ categoria: "ascensore", importo: 1200 })],
    quote: [quota({ unita: "Interno 1", importo: 300 })],
    amministratore: { nome: "Bruno", cognome: "Verdi", email: "bruno@example.it" },
    generatoIl: "2026-09-09T10:00:00.000Z",
  };

  test("titola con l'anno e il condominio", () => {
    const documento = costruisciRendiconto(dati);
    expect(documento.titolo).toBe("Rendiconto 2026 — Il Glicine");
    expect(documento.nomeFile).toBe("rendiconto-2026-il-glicine");
  });

  test("riporta cassa, categorie e situazione delle unità", () => {
    const testo = testoDi(costruisciRendiconto(dati).blocchi);
    expect(testo).toContain("Totale uscite:");
    expect(testo).toContain("Saldo del periodo:");
    expect(testo).toContain("ascensore");
    expect(testo).toContain("Interno 1 — dovuto");
  });

  test("un anno senza movimenti lo dice invece di stampare tabelle vuote", () => {
    const testo = testoDi(costruisciRendiconto({ ...dati, uscite: [], quote: [] }).blocchi);
    expect(testo).toContain("Nessuna spesa registrata nel 2026");
    expect(testo).toContain("Nessuna quota di competenza 2026");
  });

  test("avverte che non sostituisce il rendiconto da approvare in assemblea", () => {
    const nota = costruisciRendiconto(dati).blocchi.find((b) => b.tipo === "nota");
    expect(nota?.tipo === "nota" && nota.testo).toContain("art. 1130-bis");
  });
});
