import { describe, expect, test } from "vitest";
import {
  costruisciConvocazione,
  costruisciVerbale,
  segmentoNomeFile,
  type Blocco,
  type DatiConvocazione,
  type DatiVerbale,
} from "./modello";

const CONDOMINIO = {
  nome: "Condominio Città Giardino",
  indirizzo: "Via Roma 12, Bologna",
  codiceFiscale: "91234567890",
};

const AMMINISTRATORE = { nome: "Anna", cognome: "Rossi", email: "anna@example.com" };

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
        default:
          return b.testo;
      }
    })
    .join("\n");
}

const CONVOCAZIONE_BASE: DatiConvocazione = {
  condominio: CONDOMINIO,
  assemblea: {
    tipo: "ordinaria",
    dataAssemblea: "2026-10-14T20:30:00.000Z",
    convocazione: 1,
    luogo: "Sala riunioni, piano terra",
    linkVideoconferenza: null,
  },
  puntiOdg: [
    { numero: 2, descrizione: "Nomina dell'amministratore", tipoMaggioranza: "qualificata_intervenuti" },
    { numero: 1, descrizione: "Approvazione del rendiconto", tipoMaggioranza: "semplice" },
  ],
  amministratore: AMMINISTRATORE,
  generatoIl: "2026-09-08T09:00:00.000Z",
};

describe("segmentoNomeFile", () => {
  test("toglie accenti, spazi e punteggiatura", () => {
    expect(segmentoNomeFile("Condominio Città Giardino")).toBe("condominio-citta-giardino");
    expect(segmentoNomeFile("  Via Roma, 12  ")).toBe("via-roma-12");
  });

  test("una stringa senza caratteri utili ricade su un valore neutro", () => {
    expect(segmentoNomeFile("!!!")).toBe("documento");
  });
});

describe("costruisciConvocazione", () => {
  test("riporta condominio, data, luogo e convocazione", () => {
    const doc = costruisciConvocazione(CONVOCAZIONE_BASE);
    const testo = testoDi(doc.blocchi);
    expect(testo).toContain("Condominio Città Giardino");
    expect(testo).toContain("Via Roma 12, Bologna");
    expect(testo).toContain("Sala riunioni, piano terra");
    expect(testo).toContain("prima convocazione");
    expect(doc.titolo).toBe("Convocazione assemblea ordinaria");
  });

  test("i punti all'ordine del giorno sono ordinati per numero", () => {
    const doc = costruisciConvocazione(CONVOCAZIONE_BASE);
    const elenco = doc.blocchi.find((b) => b.tipo === "elenco");
    expect(elenco).toBeDefined();
    expect(elenco?.tipo === "elenco" && elenco.voci[0]).toContain("1. Approvazione del rendiconto");
    expect(elenco?.tipo === "elenco" && elenco.voci[1]).toContain("2. Nomina dell'amministratore");
  });

  test("senza luogo indica che è da definire, senza punti lo dichiara", () => {
    const doc = costruisciConvocazione({
      ...CONVOCAZIONE_BASE,
      assemblea: { ...CONVOCAZIONE_BASE.assemblea, luogo: "   " },
      puntiOdg: [],
    });
    const testo = testoDi(doc.blocchi);
    expect(testo).toContain("Da definire");
    expect(testo).toContain("Nessun punto all'ordine del giorno");
    expect(doc.blocchi.some((b) => b.tipo === "elenco")).toBe(false);
  });

  test("il link videoconferenza compare solo se presente", () => {
    const senza = testoDi(costruisciConvocazione(CONVOCAZIONE_BASE).blocchi);
    expect(senza).not.toContain("Partecipazione da remoto");

    const con = testoDi(
      costruisciConvocazione({
        ...CONVOCAZIONE_BASE,
        assemblea: {
          ...CONVOCAZIONE_BASE.assemblea,
          linkVideoconferenza: "https://meet.example.com/abc",
        },
      }).blocchi
    );
    expect(con).toContain("https://meet.example.com/abc");
  });

  test("seconda convocazione e nome file derivato dai dati", () => {
    const doc = costruisciConvocazione({
      ...CONVOCAZIONE_BASE,
      assemblea: { ...CONVOCAZIONE_BASE.assemblea, convocazione: 2 },
    });
    expect(testoDi(doc.blocchi)).toContain("seconda convocazione");
    expect(doc.nomeFile).toBe("convocazione-condominio-citta-giardino-2026-10-14");
  });

  test("senza amministratore non aggiunge la riga di firma", () => {
    const doc = costruisciConvocazione({ ...CONVOCAZIONE_BASE, amministratore: null });
    expect(testoDi(doc.blocchi)).not.toContain("L'amministratore");
  });

  test("dichiara sempre di essere una bozza generata dal portale", () => {
    const nota = costruisciConvocazione(CONVOCAZIONE_BASE).blocchi.find((b) => b.tipo === "nota");
    expect(nota?.tipo === "nota" && nota.testo).toContain("Bozza generata automaticamente");
  });
});

const VERBALE_BASE: DatiVerbale = {
  condominio: CONDOMINIO,
  assemblea: {
    tipo: "ordinaria",
    dataAssemblea: "2026-10-14T20:30:00.000Z",
    convocazione: 2,
    luogo: "Sala riunioni",
    stato: "conclusa",
  },
  quorum: {
    unitaTotali: 12,
    millesimiTotali: 1000,
    unitaIntervenute: 6,
    millesimiIntervenuti: 520,
    raggiunto: true,
    riferimento: "art. 1136 c. 3 c.c.",
  },
  presenze: [
    { identificativo: "Scala A - Int. 1", modalita: "presenza", millesimi: 120 },
    { identificativo: "Scala A - Int. 2", modalita: "remoto", millesimi: 100 },
  ],
  deleghe: [{ delegante: "Scala B - Int. 5", delegato: "Mario Bianchi" }],
  punti: [
    {
      numero: 1,
      descrizione: "Approvazione del rendiconto",
      tipoMaggioranza: "semplice",
      esito: "approvato",
      favorevoliMillesimi: 400,
      contrariMillesimi: 100,
      astenutiMillesimi: 20,
      quorumRaggiunto: true,
      riferimento: "art. 1136 c. 3 c.c.",
    },
  ],
  amministratore: AMMINISTRATORE,
  generatoIl: "2026-10-15T08:00:00.000Z",
};

describe("costruisciVerbale", () => {
  test("dichiara l'assemblea costituita quando il quorum è raggiunto", () => {
    const testo = testoDi(costruisciVerbale(VERBALE_BASE).blocchi);
    expect(testo).toContain("regolarmente costituita");
    expect(testo).toContain("6 su 12");
    expect(testo).toContain("art. 1136 c. 3 c.c.");
  });

  test("segnala esplicitamente il quorum costitutivo non raggiunto", () => {
    const testo = testoDi(
      costruisciVerbale({
        ...VERBALE_BASE,
        quorum: { ...VERBALE_BASE.quorum, raggiunto: false },
      }).blocchi
    );
    expect(testo).toContain("NON raggiunge il quorum costitutivo");
  });

  test("elenca presenti e deleghe", () => {
    const testo = testoDi(costruisciVerbale(VERBALE_BASE).blocchi);
    expect(testo).toContain("Scala A - Int. 1");
    expect(testo).toContain("in presenza");
    expect(testo).toContain("da remoto");
    expect(testo).toContain("Scala B - Int. 5 rappresentata da Mario Bianchi");
  });

  test("senza presenze né deleghe non stampa le sezioni relative", () => {
    const testo = testoDi(
      costruisciVerbale({ ...VERBALE_BASE, presenze: [], deleghe: [] }).blocchi
    );
    expect(testo).not.toContain("Elenco dei presenti");
    expect(testo).not.toContain("Deleghe");
  });

  test("un punto approvato senza quorum di legge viene segnalato", () => {
    const testo = testoDi(
      costruisciVerbale({
        ...VERBALE_BASE,
        punti: [{ ...VERBALE_BASE.punti[0], quorumRaggiunto: false }],
      }).blocchi
    );
    expect(testo).toContain("il quorum di legge risulta non raggiunto");
  });

  test("una votazione ancora aperta non viene spacciata per delibera", () => {
    const testo = testoDi(
      costruisciVerbale({
        ...VERBALE_BASE,
        punti: [{ ...VERBALE_BASE.punti[0], esito: null, quorumRaggiunto: false }],
      }).blocchi
    );
    expect(testo).toContain("Votazione non ancora chiusa");
  });

  test("senza punti all'ordine del giorno lo dichiara", () => {
    const testo = testoDi(costruisciVerbale({ ...VERBALE_BASE, punti: [] }).blocchi);
    expect(testo).toContain("Nessun punto all'ordine del giorno è registrato");
  });

  test("nome file e spazio per le firme di presidente e segretario", () => {
    const doc = costruisciVerbale(VERBALE_BASE);
    expect(doc.nomeFile).toBe("verbale-condominio-citta-giardino-2026-10-14");
    const testo = testoDi(doc.blocchi);
    expect(testo).toContain("Il presidente");
    expect(testo).toContain("Il segretario");
  });
});
