import { describe, expect, test } from "vitest";
import {
  BOM_UTF8,
  aBlocchi,
  cellaCsv,
  estensioneDa,
  nomeArchivio,
  nomeUnico,
  slug,
  testoLeggimi,
  versoCsv,
} from "./esportazione";

describe("cellaCsv", () => {
  test("null e undefined diventano celle vuote", () => {
    expect(cellaCsv(null)).toBe("");
    expect(cellaCsv(undefined)).toBe("");
  });

  test("i booleani si leggono in italiano", () => {
    expect(cellaCsv(true)).toBe("vero");
    expect(cellaCsv(false)).toBe("falso");
  });

  test("i numeri restano col punto decimale, come li dà il database", () => {
    // Deliberato: il CSV è dato da rileggere, non da stampare. La virgola
    // decimale italiana renderebbe ambigua una cella separata da ";".
    expect(cellaCsv(1234.56)).toBe("1234.56");
  });

  test("quota il campo che contiene il separatore", () => {
    expect(cellaCsv("Rossi; Mario")).toBe('"Rossi; Mario"');
  });

  test("raddoppia gli apici doppi interni", () => {
    expect(cellaCsv('Spesa "straordinaria"')).toBe('"Spesa ""straordinaria"""');
  });

  test("quota i campi con andata a capo", () => {
    expect(cellaCsv("prima riga\nseconda")).toBe('"prima riga\nseconda"');
  });

  test("quota i campi con spazi ai bordi, che altrimenti si perderebbero", () => {
    expect(cellaCsv(" 12 ")).toBe('" 12 "');
  });

  test("neutralizza un valore che Excel leggerebbe come formula", () => {
    // Un campo di testo libero (nota, descrizione) può contenerlo.
    expect(cellaCsv("=1+1")).toBe("'=1+1");
    expect(cellaCsv("-SOMMA(A1)")).toBe("'-SOMMA(A1)");
    expect(cellaCsv("+39 333 1234567")).toBe("'+39 333 1234567");
  });

  test("un oggetto non si perde: finisce come JSON", () => {
    expect(cellaCsv({ a: 1 })).toBe('"{""a"":1}"');
  });
});

describe("versoCsv", () => {
  test("scrive BOM, intestazione e righe terminate da CRLF", () => {
    const csv = versoCsv(["id", "nome"], [{ id: "1", nome: "Interno 1" }]);
    expect(csv).toBe(`${BOM_UTF8}id;nome\r\n1;Interno 1\r\n`);
  });

  test("una tabella vuota produce comunque l'intestazione", () => {
    // Serve a distinguere "nessun dato" da "file dimenticato": in un
    // archivio di conservazione la differenza conta.
    const csv = versoCsv(["id", "importo"], []);
    expect(csv).toBe(`${BOM_UTF8}id;importo\r\n`);
  });

  test("le colonne mancanti in una riga diventano celle vuote, non 'undefined'", () => {
    const csv = versoCsv(["a", "b"], [{ a: "x" }]);
    expect(csv.endsWith("x;\r\n")).toBe(true);
  });

  test("l'ordine delle colonne è quello dichiarato, non quello dell'oggetto", () => {
    const csv = versoCsv(["b", "a"], [{ a: "1", b: "2" }]);
    expect(csv).toContain("b;a\r\n2;1");
  });

  test("ignora le chiavi non dichiarate (es. gli oggetti annidati di una join)", () => {
    const csv = versoCsv(["id"], [{ id: "1", spese: { condominio_id: "x" } }]);
    expect(csv).toBe(`${BOM_UTF8}id\r\n1\r\n`);
  });
});

describe("slug", () => {
  test("risolve accenti, maiuscole e punteggiatura", () => {
    expect(slug("Rifacimento facciata — 2° lotto / saldo")).toBe(
      "rifacimento-facciata-2-lotto-saldo"
    );
  });

  test("non lascia mai una stringa vuota", () => {
    expect(slug("///")).toBe("senza-nome");
    expect(slug("")).toBe("senza-nome");
  });

  test("taglia alla lunghezza richiesta senza lasciare un trattino in coda", () => {
    expect(slug("abcde fghij", 6)).toBe("abcde");
  });
});

describe("estensioneDa", () => {
  test("legge l'estensione del nome finale del percorso", () => {
    expect(estensioneDa("spese/abc/1730000000.PDF")).toBe("pdf");
  });

  test("senza estensione riconoscibile usa 'bin'", () => {
    expect(estensioneDa("condomini/abc/scansione")).toBe("bin");
    expect(estensioneDa("condomini/abc/file.")).toBe("bin");
    expect(estensioneDa("condomini/abc/.nascosto")).toBe("bin");
  });

  test("non si fida di una coda arbitraria dopo il punto", () => {
    expect(estensioneDa("x/y/nome.estensione-assurda")).toBe("bin");
  });
});

describe("nomeUnico", () => {
  test("il primo nome passa invariato", () => {
    const usati = new Set<string>();
    expect(nomeUnico("fattura.pdf", usati)).toBe("fattura.pdf");
  });

  test("i doppioni non si sovrascrivono: si numerano", () => {
    const usati = new Set<string>();
    nomeUnico("fattura.pdf", usati);
    expect(nomeUnico("fattura.pdf", usati)).toBe("fattura-2.pdf");
    expect(nomeUnico("fattura.pdf", usati)).toBe("fattura-3.pdf");
  });

  test("funziona anche su nomi senza estensione", () => {
    const usati = new Set<string>();
    nomeUnico("allegato", usati);
    expect(nomeUnico("allegato", usati)).toBe("allegato-2");
  });
});

describe("nomeArchivio", () => {
  test("contiene il nome del condominio e la data", () => {
    expect(nomeArchivio("Condominio Via Verdi 12", "2026-10-29")).toBe(
      "esportazione-condominio-via-verdi-12-2026-10-29.zip"
    );
  });
});

describe("aBlocchi", () => {
  test("divide in blocchi della dimensione richiesta", () => {
    expect(aBlocchi([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  test("un elenco vuoto non produce nessun blocco (nessuna query inutile)", () => {
    expect(aBlocchi([], 10)).toEqual([]);
  });

  test("un elenco più corto del blocco resta in un blocco solo", () => {
    expect(aBlocchi([1, 2], 100)).toEqual([[1, 2]]);
  });

  test("rifiuta una dimensione non valida invece di ciclare all'infinito", () => {
    expect(() => aBlocchi([1], 0)).toThrow();
  });
});

describe("testoLeggimi", () => {
  const base = {
    condominio: { nome: "Condominio Verdi", indirizzo: "Via Verdi 12, Milano", codiceFiscale: "12345678901" },
    amministratore: { nome: "Anna", cognome: "Bianchi", email: "anna@example.com" },
    data: "2026-10-29",
    ora: "10:30",
    tabelle: [{ nome: "unita", descrizione: "Unità immobiliari", righe: 12 }],
    cartelle: [{ cartella: "archivio", descrizione: "Archivio documenti", file: 3 }],
    documentiMancanti: [] as string[],
  };

  test("riporta condominio, data e richiedente", () => {
    const testo = testoLeggimi(base);
    expect(testo).toContain("Condominio Verdi");
    expect(testo).toContain("Via Verdi 12, Milano");
    expect(testo).toContain("2026-10-29");
    expect(testo).toContain("anna@example.com");
  });

  test("elenca i CSV con il conteggio delle righe", () => {
    const testo = testoLeggimi(base);
    expect(testo).toContain("dati/unita.csv");
    expect(testo).toContain("12 righe");
  });

  test("elenca le cartelle dei documenti", () => {
    expect(testoLeggimi(base)).toContain("documenti/archivio/");
  });

  test("dice esplicitamente che non c'è nessun documento, invece di tacere", () => {
    const testo = testoLeggimi({ ...base, cartelle: [] });
    expect(testo).toContain("nessun documento caricato");
  });

  test("cita l'art. 10.1 della DPA e l'art. 1130-bis c.c. col disclaimer", () => {
    const testo = testoLeggimi(base);
    expect(testo).toContain("art. 10.1");
    expect(testo).toContain("1130-bis");
    expect(testo).toContain("NON sostituisce la verifica che devi fare tu.");
  });

  test("avverte che l'archivio contiene dati personali", () => {
    expect(testoLeggimi(base)).toContain("DATI PERSONALI");
  });

  test("senza documenti mancanti non compare la sezione relativa", () => {
    expect(testoLeggimi(base)).not.toContain("DOCUMENTI NON RECUPERATI");
  });

  test("con documenti mancanti li elenca e rinumera le sezioni successive", () => {
    const testo = testoLeggimi({ ...base, documentiMancanti: ["spese/abc/1.pdf"] });
    expect(testo).toContain("DOCUMENTI NON RECUPERATI");
    expect(testo).toContain("spese/abc/1.pdf");
    expect(testo).toContain("3. A CHE COSA SERVE");
    expect(testo).toContain("4. DATI PERSONALI");
  });

  test("il codice fiscale si omette se il condominio non ne ha uno", () => {
    const testo = testoLeggimi({
      ...base,
      condominio: { ...base.condominio, codiceFiscale: null },
    });
    expect(testo).not.toContain("Cod. fiscale");
  });
});
