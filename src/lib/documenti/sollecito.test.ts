import { describe, expect, test } from "vitest";
import { costruisciSollecito, type DatiSollecito } from "./sollecito";
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

function dati(over: Partial<DatiSollecito> = {}): DatiSollecito {
  return {
    condominio: {
      nome: "Il Glicine",
      indirizzo: "Via Roma 1, Bologna",
      codiceFiscale: "91234567890",
      iban: "IT60X0542811101000000123456",
      banca: "Banca di Prova",
      intestatarioConto: "Condominio Il Glicine",
    },
    unita: { identificativo: "Interno 3", piano: "2" },
    destinatari: ["Ada Rossi"],
    livello: 1,
    rate: [
      {
        descrizione: "Rata ordinaria primo semestre",
        dataScadenza: "2026-06-30",
        importo: 240,
        giorniRitardo: 71,
        codiceAvviso: "AV-2026-0012",
      },
    ],
    totale: 240,
    giorniRitardoMax: 71,
    amministratore: { nome: "Bruno", cognome: "Verdi", email: "bruno@example.it" },
    generatoIl: "2026-09-09T10:00:00.000Z",
    ...over,
  };
}

describe("costruisciSollecito", () => {
  test("intesta la lettera al condominio e all'unità", () => {
    const testo = testoDi(costruisciSollecito(dati()).blocchi);
    expect(testo).toContain("Condominio Il Glicine");
    expect(testo).toContain("Via Roma 1, Bologna");
    expect(testo).toContain("Unità: Interno 3");
    expect(testo).toContain("Piano: 2");
    expect(testo).toContain("Destinatari: Ada Rossi");
  });

  test("il tono cambia con il livello, l'elenco delle rate no", () => {
    const primo = costruisciSollecito(dati({ livello: 1 }));
    const diffida = costruisciSollecito(dati({ livello: 3 }));

    expect(primo.titolo).toContain("Primo sollecito");
    expect(diffida.titolo).toContain("Diffida");
    expect(testoDi(primo.blocchi)).toContain("invita cortesemente");
    expect(testoDi(diffida.blocchi)).toContain("diffida formalmente");
    expect(testoDi(diffida.blocchi)).toContain("art. 1129");

    for (const documento of [primo, diffida]) {
      expect(testoDi(documento.blocchi)).toContain("Rata ordinaria primo semestre");
    }
  });

  test("riporta importo, scadenza, ritardo e codice avviso di ogni rata", () => {
    const testo = testoDi(costruisciSollecito(dati()).blocchi);
    expect(testo).toContain("71 giorni di ritardo");
    expect(testo).toContain("avviso AV-2026-0012");
    expect(testo).toContain("Totale dovuto:");
  });

  test("un solo giorno di ritardo è scritto al singolare", () => {
    const testo = testoDi(
      costruisciSollecito(
        dati({
          giorniRitardoMax: 1,
          rate: [
            {
              descrizione: "Rata",
              dataScadenza: "2026-09-08",
              importo: 10,
              giorniRitardo: 1,
              codiceAvviso: null,
            },
          ],
        })
      ).blocchi
    );
    expect(testo).toContain("1 giorno di ritardo");
    expect(testo).toContain("Ritardo massimo: 1 giorno");
  });

  test("le coordinate del conto ci sono quando il condominio le ha registrate", () => {
    const testo = testoDi(costruisciSollecito(dati()).blocchi);
    expect(testo).toContain("IBAN: IT60X0542811101000000123456");
    expect(testo).toContain("Intestato a: Condominio Il Glicine");
  });

  test("senza IBAN rimanda all'amministrazione invece di lasciare il vuoto", () => {
    const testo = testoDi(
      costruisciSollecito(
        dati({
          condominio: {
            nome: "Il Glicine",
            indirizzo: "Via Roma 1",
            codiceFiscale: null,
            iban: null,
            banca: null,
            intestatarioConto: null,
          },
        })
      ).blocchi
    );
    expect(testo).not.toContain("IBAN:");
    expect(testo).toContain("rivolgersi all'amministrazione");
  });

  test("il nome file distingue livello, condominio e unità", () => {
    expect(costruisciSollecito(dati({ livello: 2 })).nomeFile).toBe(
      "sollecito-2-il-glicine-interno-3"
    );
  });

  test("chiude sempre con la nota che è una bozza da sottoscrivere", () => {
    const nota = costruisciSollecito(dati()).blocchi.find((b) => b.tipo === "nota");
    expect(nota?.tipo === "nota" && nota.testo).toContain("sottoscritta dall'amministratore");
  });

  test("senza destinatari nominati la lettera resta indirizzabile", () => {
    const testo = testoDi(costruisciSollecito(dati({ destinatari: [] })).blocchi);
    expect(testo).toContain("Ai proprietari dell'unità");
  });
});
