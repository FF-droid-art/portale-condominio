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
        case "tabella":
          return [b.colonne.map((c) => c.intestazione), ...b.righe]
            .map((r) => r.join(" | "))
            .join("\n");
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
    // L'unico elenco che resta è quello delle avvertenze di legge.
    expect(testo).not.toContain("1. Approvazione del rendiconto");
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
    const note = costruisciConvocazione(CONVOCAZIONE_BASE).blocchi.filter((b) => b.tipo === "nota");
    expect(note.map((n) => (n.tipo === "nota" ? n.testo : "")).join("\n")).toContain(
      "Bozza generata automaticamente"
    );
  });

  test("riporta gli obblighi di legge sull'avviso: termine, mezzi e perimetro dell'odg", () => {
    const testo = testoDi(costruisciConvocazione(CONVOCAZIONE_BASE).blocchi);
    expect(testo).toContain("almeno cinque giorni prima");
    expect(testo).toContain("posta elettronica certificata");
    expect(testo).toContain("art. 66 c. 3 disp. att. c.c.");
    expect(testo).toContain("soltanto sugli argomenti indicati nell'ordine del giorno");
  });

  test("spiega i limiti della delega dell'art. 67 e offre il modulo da compilare", () => {
    const testo = testoDi(costruisciConvocazione(CONVOCAZIONE_BASE).blocchi);
    expect(testo).toContain("delega scritta");
    expect(testo).toContain("un quinto dei condòmini");
    expect(testo).toContain("non può essere conferita all'amministratore");
    expect(testo).toContain("art. 67 disp. att. c.c.");
    expect(testo).toContain("Modulo di delega");
  });

  test("la regola sulla seconda convocazione compare solo nell'avviso di prima", () => {
    const prima = testoDi(costruisciConvocazione(CONVOCAZIONE_BASE).blocchi);
    expect(prima).toContain("non può tenersi nel medesimo giorno solare della prima");
    expect(prima).toContain("entro dieci giorni dalla prima");

    const seconda = testoDi(
      costruisciConvocazione({
        ...CONVOCAZIONE_BASE,
        assemblea: { ...CONVOCAZIONE_BASE.assemblea, convocazione: 2 },
      }).blocchi
    );
    expect(seconda).not.toContain("medesimo giorno solare");
  });

  test("avverte se all'assemblea mancano meno di cinque giorni", () => {
    const tardi = testoDi(
      costruisciConvocazione({ ...CONVOCAZIONE_BASE, generatoIl: "2026-10-12T09:00:00.000Z" })
        .blocchi
    );
    expect(tardi).toContain("mancano meno di 5 giorni");

    const inTempo = testoDi(costruisciConvocazione(CONVOCAZIONE_BASE).blocchi);
    expect(inTempo).not.toContain("mancano meno di");
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
  cariche: { presidente: null, segretario: null },
  presenze: [
    { identificativo: "Scala A - Int. 1", modalita: "presenza", millesimi: 120 },
    { identificativo: "Scala A - Int. 2", modalita: "remoto", millesimi: 100 },
  ],
  assenti: [{ identificativo: "Scala B - Int. 9", millesimi: 80 }],
  deleghe: [{ delegante: "Scala B - Int. 5", delegato: "Mario Bianchi" }],
  punti: [
    {
      numero: 1,
      descrizione: "Approvazione del rendiconto",
      tipoMaggioranza: "semplice",
      esito: "approvato",
      favorevoliUnita: 4,
      contrariUnita: 1,
      astenutiUnita: 1,
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

  test("elenca presenti, deleghe e assenti in tabella", () => {
    const doc = costruisciVerbale(VERBALE_BASE);
    const testo = testoDi(doc.blocchi);
    expect(testo).toContain("Scala A - Int. 1");
    expect(testo).toContain("in presenza");
    expect(testo).toContain("da remoto");
    expect(testo).toContain("Scala B - Int. 5 | Mario Bianchi");
    expect(testo).toContain("Risultano assenti");
    expect(testo).toContain("Scala B - Int. 9");

    const tabelle = doc.blocchi.filter((b) => b.tipo === "tabella");
    expect(tabelle.length).toBeGreaterThanOrEqual(4); // presenti, deleghe, assenti, voti
  });

  test("senza presenze, deleghe o assenti non stampa le sezioni relative", () => {
    const testo = testoDi(
      costruisciVerbale({ ...VERBALE_BASE, presenze: [], deleghe: [], assenti: [] }).blocchi
    );
    expect(testo).not.toContain("Fatto l'appello");
    expect(testo).not.toContain("deleghe scritte");
    expect(testo).not.toContain("Risultano assenti");
  });

  test("apre con la nomina di presidente e segretario, prima della costituzione", () => {
    const doc = costruisciVerbale(VERBALE_BASE);
    const titoli = doc.blocchi
      .filter((b) => b.tipo === "sottotitolo")
      .map((b) => (b.tipo === "sottotitolo" ? b.testo : ""));
    expect(titoli.indexOf("Nomina del presidente e del segretario")).toBeLessThan(
      titoli.indexOf("Costituzione dell'assemblea")
    );
    expect(titoli.indexOf("Costituzione dell'assemblea")).toBeLessThan(
      titoli.indexOf("Trattazione dell'ordine del giorno")
    );
  });

  test("usa i nominativi dei firmatari quando ci sono, altrimenti lascia da compilare", () => {
    const conNomi = costruisciVerbale({
      ...VERBALE_BASE,
      cariche: { presidente: "Luca Verdi", segretario: "Sara Neri" },
    });
    const testo = testoDi(conNomi.blocchi);
    expect(testo).toContain("Luca Verdi");
    expect(testo).toContain("Sara Neri");
    expect(testo).not.toContain("rigenerare il documento");

    const senzaNomi = testoDi(costruisciVerbale(VERBALE_BASE).blocchi);
    expect(senzaNomi).toContain("_____");
    expect(senzaNomi).toContain("rigenerare il documento");
  });

  test("riporta l'ordine del giorno anche in testa al verbale", () => {
    const elenco = costruisciVerbale(VERBALE_BASE).blocchi.find((b) => b.tipo === "elenco");
    expect(elenco?.tipo === "elenco" && elenco.voci[0]).toBe("1. Approvazione del rendiconto");
  });

  test("i voti sono riportati sia per teste sia per millesimi", () => {
    const testo = testoDi(costruisciVerbale(VERBALE_BASE).blocchi);
    expect(testo).toContain("Voto | Unità | Millesimi");
    expect(testo).toContain("Favorevoli | 4 | 400,000");
    expect(testo).toContain("Contrari | 1 | 100,000");
    expect(testo).toContain("Astenuti | 1 | 20,000");
  });

  test("chiude con la formula di rito, il rinvio al registro e il termine di impugnazione", () => {
    const testo = testoDi(costruisciVerbale(VERBALE_BASE).blocchi);
    expect(testo).toContain("dichiara sciolta l'assemblea alle ore");
    expect(testo).toContain("registro dei verbali");
    expect(testo).toContain("art. 1130 n. 7 c.c.");
    expect(testo).toContain("entro trenta giorni");
    expect(testo).toContain("art. 1137 c.c.");
  });

  test("avverte se l'assemblea non è ancora conclusa", () => {
    const inCorso = testoDi(
      costruisciVerbale({
        ...VERBALE_BASE,
        assemblea: { ...VERBALE_BASE.assemblea, stato: "in_corso" },
      }).blocchi
    );
    expect(inCorso).toContain("non risulta ancora conclusa");
    expect(testoDi(costruisciVerbale(VERBALE_BASE).blocchi)).not.toContain(
      "non risulta ancora conclusa"
    );
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
    expect(testo).toContain("L'amministratore");
  });

  test("la mancata costituzione viene verbalizzata, non nascosta", () => {
    const testo = testoDi(
      costruisciVerbale({
        ...VERBALE_BASE,
        quorum: { ...VERBALE_BASE.quorum, raggiunto: false },
      }).blocchi
    );
    expect(testo).toContain("Della mancata costituzione si dà atto a verbale");
  });
});
