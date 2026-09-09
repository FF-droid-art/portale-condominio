import { describe, expect, test } from "vitest";
import {
  abbinaMovimenti,
  impronta,
  leggiData,
  leggiImporto,
  parseEstrattoContoCsv,
  type MovimentoGrezzo,
  type RipartizioneAperta,
} from "./riconciliazione";

describe("leggiData", () => {
  test("accetta le forme usate dalle banche italiane", () => {
    expect(leggiData("09/03/2026")).toBe("2026-03-09");
    expect(leggiData("9-3-2026")).toBe("2026-03-09");
    expect(leggiData("09.03.2026")).toBe("2026-03-09");
    expect(leggiData("2026-03-09")).toBe("2026-03-09");
    expect(leggiData(" 09/03/2026 ")).toBe("2026-03-09");
  });

  test("un anno a due cifre è di questo secolo", () => {
    expect(leggiData("09/03/26")).toBe("2026-03-09");
  });

  test("rifiuta date impossibili o illeggibili", () => {
    expect(leggiData("31/02/2026")).toBeNull();
    expect(leggiData("32/01/2026")).toBeNull();
    expect(leggiData("ieri")).toBeNull();
    expect(leggiData("")).toBeNull();
  });
});

describe("leggiImporto", () => {
  test("legge la forma italiana con separatore di migliaia", () => {
    expect(leggiImporto("1.234,56")).toBe(1234.56);
    expect(leggiImporto("1.234.567,89")).toBe(1234567.89);
  });

  test("legge la forma inglese", () => {
    expect(leggiImporto("1234.56")).toBe(1234.56);
    expect(leggiImporto("1,234.56")).toBe(1234.56);
  });

  test("un solo separatore con tre decimali è di migliaia, non decimale", () => {
    expect(leggiImporto("1.234")).toBe(1234);
    expect(leggiImporto("1,234")).toBe(1234);
    expect(leggiImporto("1.23")).toBe(1.23);
  });

  test("riconosce il segno davanti, dietro e tra parentesi", () => {
    expect(leggiImporto("-1.234,56")).toBe(-1234.56);
    expect(leggiImporto("1.234,56-")).toBe(-1234.56);
    expect(leggiImporto("(1.234,56)")).toBe(-1234.56);
    expect(leggiImporto("+240,00")).toBe(240);
  });

  test("tollera il simbolo di valuta e gli spazi", () => {
    expect(leggiImporto(" € 240,00 ")).toBe(240);
  });

  test("rifiuta quello che non è un numero", () => {
    expect(leggiImporto("saldo")).toBeNull();
    expect(leggiImporto("")).toBeNull();
  });
});

describe("parseEstrattoContoCsv", () => {
  test("legge un estratto con colonna importo unica e separatore punto e virgola", () => {
    const esito = parseEstrattoContoCsv(
      [
        "Data;Descrizione;Importo",
        "09/03/2026;BONIFICO DA ROSSI ADA - AV-2026-0012;240,00",
        "10/03/2026;PAGAMENTO FORNITORE PULIZIE;-500,00",
      ].join("\n")
    );

    expect(esito.errori).toEqual([]);
    expect(esito.movimenti).toHaveLength(2);
    expect(esito.movimenti[0]).toMatchObject({ data: "2026-03-09", importo: 240 });
    expect(esito.movimenti[1].importo).toBe(-500);
    expect(esito.colonne.descrizione).toBe("Descrizione");
  });

  test("legge le colonne dare/avere separate dando il segno giusto", () => {
    const esito = parseEstrattoContoCsv(
      [
        "Data valuta,Causale,Dare,Avere",
        "09/03/2026,BONIFICO DA ROSSI,,240.00",
        "10/03/2026,ADDEBITO SEPA,500.00,",
      ].join("\n")
    );

    expect(esito.errori).toEqual([]);
    expect(esito.movimenti.map((m) => m.importo)).toEqual([240, -500]);
  });

  test("preferisce la data valuta quando ci sono più colonne di data", () => {
    const esito = parseEstrattoContoCsv(
      ["Data contabile;Data valuta;Importo", "01/01/2026;09/03/2026;10,00"].join("\n")
    );
    expect(esito.colonne.data).toBe("Data valuta");
    expect(esito.movimenti[0].data).toBe("2026-03-09");
  });

  test("segnala le colonne mancanti invece di importare a metà", () => {
    const esito = parseEstrattoContoCsv("Pippo;Pluto\n1;2");
    expect(esito.movimenti).toEqual([]);
    expect(esito.errori.map((e) => e.messaggio).join(" ")).toContain("data del movimento");
  });

  test("segnala la riga che non si legge e importa le altre", () => {
    const esito = parseEstrattoContoCsv(
      ["Data;Descrizione;Importo", "09/03/2026;OK;240,00", "boh;ROTTA;10,00"].join("\n")
    );
    expect(esito.movimenti).toHaveLength(1);
    // Riga 3 del file: intestazione più due righe di dati.
    expect(esito.errori).toEqual([{ riga: 3, messaggio: "Data mancante o non riconosciuta." }]);
  });

  test("le righe a zero (totali e separatori) non diventano movimenti", () => {
    const esito = parseEstrattoContoCsv(
      ["Data;Descrizione;Importo", "09/03/2026;SALDO;0,00"].join("\n")
    );
    expect(esito.movimenti).toEqual([]);
    expect(esito.errori).toEqual([]);
  });

  test("un file vuoto lo dice", () => {
    expect(parseEstrattoContoCsv("   ").errori[0].messaggio).toContain("vuoto");
  });

  test("due righe identiche restano due movimenti distinti", () => {
    const esito = parseEstrattoContoCsv(
      [
        "Data;Descrizione;Importo",
        "09/03/2026;BONIFICO DA ROSSI;240,00",
        "09/03/2026;BONIFICO DA ROSSI;240,00",
      ].join("\n")
    );
    expect(esito.movimenti).toHaveLength(2);
    expect(esito.movimenti[0].hash).not.toBe(esito.movimenti[1].hash);
  });

  test("rileggere lo stesso file dà le stesse impronte", () => {
    const csv = ["Data;Descrizione;Importo", "09/03/2026;BONIFICO;240,00"].join("\n");
    expect(parseEstrattoContoCsv(csv).movimenti[0].hash).toBe(
      parseEstrattoContoCsv(csv).movimenti[0].hash
    );
  });
});

describe("impronta", () => {
  const base = {
    data: "2026-03-09",
    importo: 240,
    descrizione: "Bonifico da Rossi",
    riferimento: null,
  };

  test("è stabile e comincia con la data", () => {
    expect(impronta(base)).toBe(impronta({ ...base }));
    expect(impronta(base).startsWith("2026-03-09-")).toBe(true);
  });

  test("cambia se cambia l'importo o la causale", () => {
    expect(impronta({ ...base, importo: 241 })).not.toBe(impronta(base));
    expect(impronta({ ...base, descrizione: "Altro" })).not.toBe(impronta(base));
  });
});

/* ------------------------------------------------------------------ */

function movimento(over: Partial<MovimentoGrezzo> = {}): MovimentoGrezzo {
  const base = {
    data: "2026-07-05",
    importo: 240,
    descrizione: "BONIFICO DA ROSSI ADA",
    riferimento: null,
    ...over,
  };
  return { ...base, hash: impronta(base) };
}

function ripartizione(over: Partial<RipartizioneAperta> = {}): RipartizioneAperta {
  return {
    id: "r1",
    unitaId: "u1",
    identificativo: "Interno 3",
    nominativi: ["Ada Rossi"],
    importoDovuto: 240,
    dataScadenza: "2026-06-30",
    codiceAvviso: "AV-2026-0012",
    ...over,
  };
}

describe("abbinaMovimenti", () => {
  test("abbina con confidenza alta quando la causale cita il codice avviso", () => {
    const esito = abbinaMovimenti(
      [movimento({ descrizione: "BONIFICO AVVISO AV-2026-0012" })],
      [ripartizione()]
    );
    expect(esito.abbinamenti).toHaveLength(1);
    expect(esito.abbinamenti[0].confidenza).toBe("alta");
    expect(esito.ripartizioniNonCoperte).toEqual([]);
  });

  test("abbina con confidenza media quando riconosce solo il nominativo", () => {
    const esito = abbinaMovimenti([movimento()], [ripartizione()]);
    expect(esito.abbinamenti[0].confidenza).toBe("media");
  });

  test("riconosce anche l'identificativo dell'unità nella causale", () => {
    const esito = abbinaMovimenti(
      [movimento({ descrizione: "VERSAMENTO QUOTE INTERNO 3" })],
      [ripartizione({ nominativi: [] })]
    );
    expect(esito.abbinamenti).toHaveLength(1);
  });

  test("l'unità 3 non si accende sull'unità 30", () => {
    const esito = abbinaMovimenti(
      [movimento({ descrizione: "QUOTE INTERNO 30" })],
      [ripartizione({ nominativi: [] })]
    );
    expect(esito.abbinamenti).toEqual([]);
    expect(esito.senzaRiscontro).toHaveLength(1);
  });

  test("l'importo deve corrispondere al centesimo", () => {
    const esito = abbinaMovimenti([movimento({ importo: 239.99 })], [ripartizione()]);
    expect(esito.abbinamenti).toEqual([]);
    expect(esito.senzaRiscontro).toHaveLength(1);
    expect(esito.ripartizioniNonCoperte).toHaveLength(1);
  });

  test("un accredito troppo anteriore alla scadenza non viene abbinato", () => {
    const tardivo = abbinaMovimenti([movimento({ data: "2026-06-01" })], [ripartizione()]);
    expect(tardivo.abbinamenti).toHaveLength(1); // 29 giorni prima: dentro la finestra

    const troppoPresto = abbinaMovimenti([movimento({ data: "2026-01-10" })], [ripartizione()]);
    expect(troppoPresto.abbinamenti).toEqual([]);
  });

  test("una quota senza scadenza non ha vincolo di data", () => {
    const esito = abbinaMovimenti(
      [movimento({ data: "2020-01-01" })],
      [ripartizione({ dataScadenza: null })]
    );
    expect(esito.abbinamenti).toHaveLength(1);
  });

  test("due quote compatibili non vengono mai abbinate da sole", () => {
    const esito = abbinaMovimenti(
      [movimento()],
      [ripartizione({ id: "r1" }), ripartizione({ id: "r2", codiceAvviso: "AV-2026-0099" })]
    );
    expect(esito.abbinamenti).toEqual([]);
    expect(esito.ambigui).toHaveLength(1);
    expect(esito.ambigui[0].candidate.map((c) => c.id)).toEqual(["r1", "r2"]);
  });

  test("due bonifici identici che puntano alla stessa quota diventano ambigui entrambi", () => {
    const esito = abbinaMovimenti(
      [movimento(), movimento({ data: "2026-07-06" })],
      [ripartizione()]
    );
    expect(esito.abbinamenti).toEqual([]);
    expect(esito.ambigui).toHaveLength(2);
  });

  test("gli addebiti restano da parte: non sono pagamenti di quote", () => {
    const esito = abbinaMovimenti(
      [movimento({ importo: -500, descrizione: "PAGAMENTO PULIZIE" })],
      [ripartizione()]
    );
    expect(esito.addebiti).toHaveLength(1);
    expect(esito.abbinamenti).toEqual([]);
    expect(esito.senzaRiscontro).toEqual([]);
  });

  test("un accredito senza alcun riscontro finisce tra quelli da guardare", () => {
    const esito = abbinaMovimenti(
      [movimento({ descrizione: "ACCREDITO INTERESSI", importo: 1.5 })],
      [ripartizione()]
    );
    expect(esito.senzaRiscontro).toHaveLength(1);
    expect(esito.ripartizioniNonCoperte).toHaveLength(1);
  });

  test("il codice avviso vince anche con la causale piena di rumore", () => {
    const esito = abbinaMovimenti(
      [
        movimento({
          descrizione: "BONIFICO SEPA ORD: MARIO NEUTRO CAUSALE: av 2026 0012 quote",
        }),
      ],
      [ripartizione({ nominativi: ["Chi Altro"] })]
    );
    expect(esito.abbinamenti).toHaveLength(1);
    expect(esito.abbinamenti[0].confidenza).toBe("alta");
  });

  test("senza movimenti non propone nulla e lascia tutte le quote scoperte", () => {
    const esito = abbinaMovimenti([], [ripartizione()]);
    expect(esito).toMatchObject({ abbinamenti: [], ambigui: [], senzaRiscontro: [] });
    expect(esito.ripartizioniNonCoperte).toHaveLength(1);
  });
});
