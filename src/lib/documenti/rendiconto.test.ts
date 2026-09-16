import { describe, expect, test } from "vitest";
import {
  costruisciRendiconto,
  riepilogaRendiconto,
  type DatiRendiconto,
  type QuotaRendiconto,
  type UscitaRendiconto,
} from "./rendiconto";
import type { Blocco } from "./modello";

/** Tutto il testo del documento, per le asserzioni "il documento contiene…". */
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

function tabelle(blocchi: Blocco[]) {
  return blocchi.filter((b) => b.tipo === "tabella");
}

function uscita(over: Partial<UscitaRendiconto> = {}): UscitaRendiconto {
  return {
    dataSpesa: "2026-03-10",
    categoria: "ordinaria",
    descrizione: "Pulizie scale",
    fornitore: "Pulinet Srl",
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

function riepiloga(over: Partial<Parameters<typeof riepilogaRendiconto>[0]> = {}) {
  return riepilogaRendiconto({ anno: 2026, uscite: [], quote: [], ...over });
}

describe("riepilogaRendiconto — uscite", () => {
  test("raggruppa per categoria, ordina dalla più pesante e ne calcola il peso", () => {
    const r = riepiloga({
      uscite: [
        uscita({ categoria: "ordinaria", importo: 100 }),
        uscita({ categoria: "straordinaria", importo: 900 }),
        uscita({ categoria: "ordinaria", importo: 300 }),
      ],
    });

    expect(r.uscitePerCategoria.map((v) => [v.categoria, v.totale, v.numero])).toEqual([
      ["straordinaria", 900, 1],
      ["ordinaria", 400, 2],
    ]);
    expect(r.uscitePerCategoria[0].percentuale).toBeCloseTo(69.23, 2);
    expect(r.totaleUscite).toBe(1300);
  });

  test("le spese di altri anni restano fuori dal conto del periodo", () => {
    const r = riepiloga({
      uscite: [uscita({ dataSpesa: "2025-12-31" }), uscita({ dataSpesa: "2026-01-01" })],
    });
    expect(r.totaleUscite).toBe(500);
  });

  test("una categoria vuota non sparisce, prende un nome leggibile", () => {
    const r = riepiloga({ uscite: [uscita({ categoria: "  " })] });
    expect(r.uscitePerCategoria[0].categoria).toBe("Senza categoria");
  });
});

describe("riepilogaRendiconto — registro di contabilità", () => {
  test("mette in ordine cronologico uscite e incassi", () => {
    const r = riepiloga({
      uscite: [uscita({ dataSpesa: "2026-05-02", importo: 200 })],
      quote: [quota({ dataPagamento: "2026-02-01", importo: 60 })],
    });

    expect(r.registro.map((m) => [m.data, m.entrate, m.uscite])).toEqual([
      ["2026-02-01", 60, 0],
      ["2026-05-02", 0, 200],
    ]);
  });

  test("gli incassi dello stesso giorno della stessa unità sono un versamento solo", () => {
    const r = riepiloga({
      quote: [
        quota({ unita: "Interno 1", dataPagamento: "2026-04-02", importo: 100 }),
        quota({ unita: "Interno 1", dataPagamento: "2026-04-02", importo: 40 }),
        quota({ unita: "Interno 2", dataPagamento: "2026-04-02", importo: 30 }),
      ],
    });

    expect(r.registro).toHaveLength(2);
    expect(r.registro[0]).toMatchObject({ controparte: "Interno 1", entrate: 140 });
    expect(r.registro[1]).toMatchObject({ controparte: "Interno 2", entrate: 30 });
  });

  test("l'uscita porta con sé il fornitore, e senza fornitore ripiega sulla categoria", () => {
    const r = riepiloga({
      uscite: [uscita({ fornitore: null, categoria: "ascensore" })],
    });
    expect(r.registro[0].controparte).toBe("ascensore");
  });
});

describe("riepilogaRendiconto — cassa e competenza", () => {
  test("le entrate contano l'anno del versamento, non quello della quota", () => {
    const r = riepiloga({
      quote: [
        // Quota del 2025 saldata nel 2026: entra nella cassa 2026.
        quota({ dataCompetenza: "2025-11-30", dataPagamento: "2026-02-01", importo: 70 }),
        // Quota del 2026 saldata nel 2027: fuori dalla cassa 2026.
        quota({ dataCompetenza: "2026-11-30", dataPagamento: "2027-01-15", importo: 90 }),
      ],
    });
    expect(r.totaleEntrate).toBe(70);
  });

  test("l'addebito per unità guarda l'anno della quota, non del pagamento", () => {
    const r = riepiloga({
      quote: [
        quota({ dataCompetenza: "2025-11-30", importo: 70 }),
        quota({ dataCompetenza: "2026-11-30", dataPagamento: "2027-01-15", importo: 90 }),
      ],
    });
    expect(r.unita[0].addebitato).toBe(90);
  });

  test("il risultato di gestione è entrate meno uscite del periodo", () => {
    const r = riepiloga({ uscite: [uscita({ importo: 800 })], quote: [quota({ importo: 500 })] });
    expect(r.risultatoGestione).toBe(-300);
  });
});

describe("riepilogaRendiconto — saldi delle unità", () => {
  test("arretrati in apertura, addebiti e versamenti dell'anno, saldo di chiusura", () => {
    const r = riepiloga({
      quote: [
        // Arretrato 2025 mai versato: pesa sul saldo iniziale e resta a fine anno.
        quota({
          unita: "Interno 1",
          dataCompetenza: "2025-06-30",
          importo: 80,
          statoPagamento: "in_ritardo",
          dataPagamento: null,
        }),
        // Quota 2026 saldata nel 2026.
        quota({ unita: "Interno 1", importo: 100, dataPagamento: "2026-05-05" }),
        // Quota 2026 non saldata.
        quota({
          unita: "Interno 1",
          importo: 50,
          statoPagamento: "da_pagare",
          dataPagamento: null,
        }),
      ],
    });

    expect(r.unita).toEqual([
      {
        identificativo: "Interno 1",
        saldoIniziale: 80,
        addebitato: 150,
        versato: 100,
        saldoFinale: 130,
      },
    ]);
  });

  test("il saldo di chiusura quadra sempre con apertura, addebiti e versamenti", () => {
    const r = riepiloga({
      quote: [
        quota({ unita: "Interno 1", dataCompetenza: "2025-01-31", dataPagamento: "2026-01-10" }),
        quota({ unita: "Interno 2", importo: 200, statoPagamento: "da_pagare", dataPagamento: null }),
        quota({ unita: "Interno 3", dataCompetenza: "2027-01-31", dataPagamento: "2026-12-30" }),
      ],
    });

    for (const u of r.unita) {
      expect(u.saldoFinale).toBe(u.saldoIniziale + u.addebitato - u.versato);
    }
    expect(r.totaleSaldoFinale).toBe(
      r.totaleSaldoIniziale + r.totaleAddebitato - r.totaleVersato
    );
  });

  test("chi ha versato in anticipo una quota dell'anno dopo chiude a credito", () => {
    const r = riepiloga({
      quote: [
        quota({
          unita: "Interno 9",
          dataCompetenza: "2027-01-31",
          importo: 120,
          dataPagamento: "2026-12-20",
        }),
      ],
    });
    expect(r.unita[0].saldoFinale).toBe(-120);
    expect(r.patrimoniale.anticipiDaCondomini).toBe(120);
  });

  test("le unità sono ordinate in modo naturale (2 prima di 10)", () => {
    const r = riepiloga({
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
});

describe("riepilogaRendiconto — situazione patrimoniale al 31/12", () => {
  test("le disponibilità sono la cassa cumulata, non il saldo dell'anno", () => {
    const r = riepiloga({
      uscite: [
        uscita({ dataSpesa: "2024-06-01", importo: 300 }),
        uscita({ dataSpesa: "2026-06-01", importo: 100 }),
        // Spesa del 2027: fuori dalla fotografia al 31/12/2026.
        uscita({ dataSpesa: "2027-01-05", importo: 999 }),
      ],
      quote: [
        quota({ dataCompetenza: "2024-06-30", dataPagamento: "2024-07-01", importo: 500 }),
        quota({ dataPagamento: "2026-07-01", importo: 200 }),
      ],
    });

    // (500 + 200) incassati - (300 + 100) spesi = 300, mentre il periodo 2026
    // da solo chiude a +100.
    expect(r.patrimoniale.disponibilita).toBe(300);
    expect(r.risultatoGestione).toBe(100);
  });

  test("i crediti comprendono ogni quota non versata, non solo quelle dell'anno", () => {
    const r = riepiloga({
      quote: [
        quota({
          dataCompetenza: "2023-12-31",
          importo: 40,
          statoPagamento: "in_ritardo",
          dataPagamento: null,
        }),
        quota({ importo: 60, statoPagamento: "da_pagare", dataPagamento: null }),
        quota({ importo: 100, dataPagamento: "2026-04-02" }),
      ],
    });
    expect(r.patrimoniale.creditiVersoCondomini).toBe(100);
  });

  test("una quota saldata nel 2027 è ancora un credito al 31/12/2026", () => {
    const r = riepiloga({ quote: [quota({ importo: 90, dataPagamento: "2027-03-01" })] });
    expect(r.patrimoniale.creditiVersoCondomini).toBe(90);
  });

  test("crediti meno anticipi coincidono con la somma dei saldi delle unità", () => {
    const r = riepiloga({
      quote: [
        quota({ unita: "A", importo: 60, statoPagamento: "da_pagare", dataPagamento: null }),
        quota({ unita: "B", dataCompetenza: "2027-02-28", importo: 25, dataPagamento: "2026-11-11" }),
        quota({ unita: "C", importo: 10, dataPagamento: "2026-01-01" }),
      ],
    });

    expect(r.patrimoniale.creditiVersoCondomini - r.patrimoniale.anticipiDaCondomini).toBe(
      r.totaleSaldoFinale
    );
    expect(r.patrimoniale.totaleAttivita).toBe(
      r.patrimoniale.disponibilita + r.patrimoniale.creditiVersoCondomini
    );
  });
});

describe("riepilogaRendiconto — questioni pendenti", () => {
  test("conta insoluti, segnalazioni aperte e manutenzioni scadute", () => {
    const r = riepiloga({
      quote: [
        quota({ unita: "A", importo: 60, statoPagamento: "da_pagare", dataPagamento: null }),
        quota({ unita: "B", importo: 40, statoPagamento: "in_ritardo", dataPagamento: null }),
        quota({ unita: "B", importo: 10, dataPagamento: "2026-02-02" }),
      ],
      segnalazioni: [
        { titolo: "Ascensore fermo", stato: "aperta", priorita: "alta" },
        { titolo: "Lampada rotta", stato: "in_corso", priorita: "normale" },
        { titolo: "Vecchia", stato: "chiusa", priorita: "alta" },
      ],
      manutenzioni: [
        { titolo: "Revisione caldaia", dataProssima: "2026-10-01", stato: "programmata" },
        { titolo: "Verifica ascensore", dataProssima: "2027-04-01", stato: "programmata" },
        { titolo: "Estintori", dataProssima: "2026-02-01", stato: "completata" },
      ],
    });

    expect(r.questioni.quoteInsolute).toBe(2);
    expect(r.questioni.importoInsoluto).toBe(100);
    expect(r.questioni.unitaMorose).toBe(2);
    expect(r.questioni.segnalazioniAperte).toBe(2);
    expect(r.questioni.segnalazioniUrgenti).toBe(1);
    expect(r.questioni.manutenzioniScadute.map((m) => m.titolo)).toEqual(["Revisione caldaia"]);
    expect(r.questioni.manutenzioniFuture).toBe(1);
  });
});

describe("costruisciRendiconto", () => {
  const dati: DatiRendiconto = {
    condominio: { nome: "Il Glicine", indirizzo: "Via Roma 1", codiceFiscale: "91234567890" },
    anno: 2026,
    uscite: [uscita({ categoria: "ascensore", importo: 1200 })],
    quote: [quota({ unita: "Interno 1", importo: 300 })],
    segnalazioni: [{ titolo: "Ascensore fermo", stato: "aperta", priorita: "alta" }],
    manutenzioni: [
      { titolo: "Revisione caldaia", dataProssima: "2026-10-01", stato: "programmata" },
    ],
    amministratore: { nome: "Bruno", cognome: "Verdi", email: "bruno@example.it" },
    generatoIl: "2026-09-09T10:00:00.000Z",
  };

  test("titola con l'anno e il condominio", () => {
    const documento = costruisciRendiconto(dati);
    expect(documento.titolo).toBe("Rendiconto 2026 — Il Glicine");
    expect(documento.nomeFile).toBe("rendiconto-2026-il-glicine");
  });

  test("segue la tripartizione dell'art. 1130-bis con lo stato di ripartizione", () => {
    const testo = testoDi(costruisciRendiconto(dati).blocchi);
    expect(testo).toContain("1. Riepilogo della gestione");
    expect(testo).toContain("2. Uscite per categoria");
    expect(testo).toContain("3. Registro di contabilità");
    expect(testo).toContain("4. Stato di ripartizione");
    expect(testo).toContain("5. Riepilogo finanziario al 31 dicembre 2026");
    expect(testo).toContain("6. Nota sintetica esplicativa della gestione");
  });

  test("l'amministratore è in testa al documento, non solo nella firma", () => {
    const blocchi = costruisciRendiconto(dati).blocchi;
    const campo = blocchi.find((b) => b.tipo === "campo" && b.etichetta === "Amministratore");
    expect(campo?.tipo === "campo" && campo.valore).toBe("Bruno Verdi");

    const nota = blocchi.find((b) => b.tipo === "nota");
    expect(nota?.tipo === "nota" && nota.testo).toContain("da Bruno Verdi");
  });

  test("senza amministratore non inventa né intestazione né firma", () => {
    const testo = testoDi(costruisciRendiconto({ ...dati, amministratore: null }).blocchi);
    expect(testo).not.toContain("Amministratore:");
    expect(testo).not.toContain("L'amministratore");
  });

  test("usa tabelle a colonne per categorie, registro, unità e patrimoniale", () => {
    const trovate = tabelle(costruisciRendiconto(dati).blocchi);
    // Categorie, registro, unità, attività, passività.
    expect(trovate).toHaveLength(5);
    for (const t of trovate) {
      for (const riga of t.righe) expect(riga).toHaveLength(t.colonne.length);
      if (t.totali) expect(t.totali).toHaveLength(t.colonne.length);
    }
  });

  test("la tabella delle unità espone i quattro saldi del riparto consuntivo", () => {
    const testo = testoDi(costruisciRendiconto(dati).blocchi);
    expect(testo).toContain("Saldo al 1° gen.");
    expect(testo).toContain("Addebitato 2026");
    expect(testo).toContain("Versato nell'anno");
    expect(testo).toContain("Saldo al 31 dic.");
  });

  test("dichiara i dati che il portale non tiene, invece di inventarli", () => {
    const testo = testoDi(costruisciRendiconto(dati).blocchi);
    expect(testo).toContain("Debiti verso fornitori | non rilevato dal portale");
    expect(testo).toContain("Fondi e riserve deliberati (art. 1135 c.c.) | non rilevato dal portale");
    expect(testo).toContain("non registra il preventivo approvato dall'assemblea");
  });

  test("la nota sintetica parla di dati reali, non di formule di rito", () => {
    const morosita = costruisciRendiconto({
      ...dati,
      quote: [
        quota({ unita: "Interno 1", importo: 300, statoPagamento: "in_ritardo", dataPagamento: null }),
      ],
    });
    const testo = testoDi(morosita.blocchi);
    expect(testo).toContain("1 quota non versata");
    expect(testo).toContain("Revisione caldaia");
    expect(testo).toContain("1 segnalazione ancora aperta");
    expect(testo).toContain("di cui 1 a priorità alta");
  });

  test("un anno senza movimenti lo dice invece di stampare tabelle vuote", () => {
    const documento = costruisciRendiconto({ ...dati, uscite: [], quote: [] });
    const testo = testoDi(documento.blocchi);
    expect(testo).toContain("Nessuna spesa registrata nel 2026");
    expect(testo).toContain("Nessun movimento risulta registrato nel 2026");
    expect(testo).toContain("Nessuna quota risulta ripartita tra le unità");
    // Restano solo le due tabelle del riepilogo finanziario.
    expect(tabelle(documento.blocchi)).toHaveLength(2);
  });

  test("avverte che non sostituisce il rendiconto da approvare in assemblea", () => {
    const nota = costruisciRendiconto(dati).blocchi.find((b) => b.tipo === "nota");
    expect(nota?.tipo === "nota" && nota.testo).toContain("art. 1130-bis");
    expect(nota?.tipo === "nota" && nota.testo).toContain("art. 1130 n. 10");
  });
});
