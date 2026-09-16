import { describe, expect, test } from "vitest";
import {
  costruisciStatoPatrimoniale,
  riepilogaPartite,
  type DatiStatoPatrimoniale,
  type PartitaUnita,
} from "./stato-patrimoniale";
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
        case "tabella":
          return [b.colonne.map((c) => c.intestazione), ...b.righe, ...(b.totali ? [b.totali] : [])]
            .map((r) => r.join(" | "))
            .join("\n");
        default:
          return b.testo;
      }
    })
    .join("\n");
}

function partita(over: Partial<PartitaUnita> = {}): PartitaUnita {
  return {
    descrizione: "Spese ordinarie",
    categoria: "ordinaria",
    dataCompetenza: "2026-03-31",
    dataScadenza: "2026-03-31",
    importo: 100,
    statoPagamento: "da_pagare",
    dataPagamento: null,
    codiceAvviso: null,
    ...over,
  };
}

describe("riepilogaPartite", () => {
  test("separa l'insoluto nelle tre fasce dell'art. 63 disp. att. c.c.", () => {
    const riepilogo = riepilogaPartite(
      [
        partita({ dataCompetenza: "2026-03-31", importo: 100 }),
        partita({ dataCompetenza: "2025-06-30", importo: 50 }),
        partita({ dataCompetenza: "2023-06-30", importo: 25 }),
      ],
      2026
    );

    expect(riepilogo.insoluto).toEqual({
      annoCorrente: 100,
      annoPrecedente: 50,
      anniAnteriori: 25,
      totale: 175,
    });
  });

  test("le partite pagate contano nel versato e non nell'insoluto", () => {
    const riepilogo = riepilogaPartite(
      [
        partita({ importo: 100, statoPagamento: "pagato", dataPagamento: "2026-04-02" }),
        partita({ importo: 40, statoPagamento: "in_ritardo" }),
      ],
      2026
    );

    expect(riepilogo.totaleAddebitato).toBe(140);
    expect(riepilogo.totaleVersato).toBe(100);
    expect(riepilogo.insoluto.totale).toBe(40);
    expect(riepilogo.partiteAperte).toHaveLength(1);
  });

  test("«in ritardo» è insoluto quanto «da pagare»", () => {
    const riepilogo = riepilogaPartite(
      [partita({ statoPagamento: "in_ritardo", importo: 70 })],
      2026
    );
    expect(riepilogo.insoluto.annoCorrente).toBe(70);
  });

  test("una data di competenza illeggibile finisce tra gli anni anteriori", () => {
    // Fascia prudente: è quella che NON segue l'immobile, quindi un dato
    // incerto non fa sembrare la posizione dell'acquirente più leggera.
    const riepilogo = riepilogaPartite([partita({ dataCompetenza: "", importo: 10 })], 2026);
    expect(riepilogo.insoluto.anniAnteriori).toBe(10);
    expect(riepilogo.insoluto.annoCorrente).toBe(0);
  });

  test("le partite aperte sono ordinate dalla più vecchia", () => {
    const riepilogo = riepilogaPartite(
      [
        partita({ descrizione: "Recente", dataCompetenza: "2026-06-30" }),
        partita({ descrizione: "Vecchia", dataCompetenza: "2024-01-31" }),
      ],
      2026
    );
    expect(riepilogo.partiteAperte.map((p) => p.descrizione)).toEqual(["Vecchia", "Recente"]);
  });

  test("senza partite tutti i totali sono a zero", () => {
    const riepilogo = riepilogaPartite([], 2026);
    expect(riepilogo.totaleAddebitato).toBe(0);
    expect(riepilogo.insoluto.totale).toBe(0);
    expect(riepilogo.partiteAperte).toEqual([]);
  });
});

const DATI: DatiStatoPatrimoniale = {
  condominio: {
    nome: "Condominio Città Giardino",
    indirizzo: "Via Roma 12, Bologna",
    codiceFiscale: "91234567890",
    iban: "IT60X0542811101000000123456",
    banca: "Banca Esempio",
    intestatarioConto: "Condominio Città Giardino",
  },
  unita: {
    identificativo: "Scala A - Interno 3",
    piano: "2",
    millesimiProprieta: 84.5,
    millesimiPerTabella: [{ nome: "Ascensore", valore: 96 }],
  },
  soggetti: [
    { nominativo: "Mario Bianchi", qualifica: "Proprietario", quota: 50 },
    { nominativo: "Luisa Verdi", qualifica: "Proprietario", quota: 50 },
  ],
  partite: [
    partita({ descrizione: "Spese ordinarie 1° trimestre", dataCompetenza: "2026-03-31", importo: 120 }),
    partita({
      descrizione: "Rifacimento facciata",
      dataCompetenza: "2025-09-30",
      importo: 800,
      statoPagamento: "in_ritardo",
      codiceAvviso: "RIP-2025-000123",
    }),
    partita({
      descrizione: "Spese ordinarie 4° trimestre",
      dataCompetenza: "2025-12-31",
      importo: 110,
      statoPagamento: "pagato",
      dataPagamento: "2026-01-10",
    }),
  ],
  annoRiferimento: 2026,
  amministratore: { nome: "Anna", cognome: "Rossi", email: "anna@example.com" },
  generatoIl: "2026-09-08T09:00:00.000Z",
};

describe("costruisciStatoPatrimoniale", () => {
  test("riporta condominio, unità e millesimi di ogni tabella", () => {
    const testo = testoDi(costruisciStatoPatrimoniale(DATI).blocchi);
    expect(testo).toContain("Condominio Città Giardino");
    expect(testo).toContain("Scala A - Interno 3");
    expect(testo).toContain("Millesimi Ascensore");
  });

  test("espone le tre fasce e cita l'art. 63 disp. att. c.c.", () => {
    const testo = testoDi(costruisciStatoPatrimoniale(DATI).blocchi);
    expect(testo).toContain("Anno in corso (2026)");
    expect(testo).toContain("Anno precedente (2025)");
    expect(testo).toContain("Anni anteriori");
    expect(testo).toContain("art. 63 disp. att. c.c.");
  });

  test("elenca solo le partite non saldate, con il codice avviso quando c'è", () => {
    const elenco = costruisciStatoPatrimoniale(DATI).blocchi.filter((b) => b.tipo === "elenco");
    const partiteAperte = elenco[elenco.length - 1];
    const voci = partiteAperte.tipo === "elenco" ? partiteAperte.voci : [];
    expect(voci).toHaveLength(2);
    expect(voci.join("\n")).toContain("Rifacimento facciata");
    expect(voci.join("\n")).toContain("RIP-2025-000123");
    expect(voci.join("\n")).not.toContain("4° trimestre");
  });

  test("un'unità in regola lo dice invece di mostrare tre zeri", () => {
    const testo = testoDi(
      costruisciStatoPatrimoniale({
        ...DATI,
        partite: [partita({ statoPagamento: "pagato", dataPagamento: "2026-04-01" })],
      }).blocchi
    );
    expect(testo).toContain("non risultano somme insolute");
    expect(testo).not.toContain("Anno in corso (2026)");
    expect(testo).toContain("Nessuna partita aperta.");
  });

  test("senza IBAN non stampa la sezione per il versamento", () => {
    const testo = testoDi(
      costruisciStatoPatrimoniale({
        ...DATI,
        condominio: { ...DATI.condominio, iban: null },
      }).blocchi
    );
    expect(testo).not.toContain("Coordinate per il versamento");
  });

  test("dichiara di non essere una certificazione", () => {
    const nota = costruisciStatoPatrimoniale(DATI).blocchi.find((b) => b.tipo === "nota");
    expect(nota?.tipo === "nota" && nota.testo).toContain("non costituisce una certificazione");
  });

  test("il nome file identifica condominio e unità", () => {
    expect(costruisciStatoPatrimoniale(DATI).nomeFile).toBe(
      "stato-patrimoniale-condominio-citta-giardino-scala-a-interno-3"
    );
  });
});
