/**
 * "Stato patrimoniale" di una unità: la situazione dei debiti verso il
 * condominio, da consegnare in vista di un rogito.
 *
 * A che serve. Quando un'unità cambia proprietario, l'art. 63 delle
 * disposizioni di attuazione del codice civile rende l'acquirente obbligato in
 * solido con il venditore per i contributi «relativi all'anno in corso e a
 * quello precedente». Il notaio e le parti hanno quindi bisogno di sapere non
 * solo QUANTO è insoluto, ma DI QUALE ANNO: è la differenza tra un debito che
 * seguirà l'immobile e uno che resta del solo venditore. Per questo il
 * riepilogo non è un totale unico ma tre fasce — anno in corso, anno
 * precedente, anni anteriori.
 *
 * Come per convocazione e verbale, i dati vengono prima trasformati in blocchi
 * tipizzati (`@/lib/documenti/modello`) e solo dopo in PDF: la costruzione del
 * testo resta una funzione pura e verificabile senza generare un file.
 *
 * Il documento è una fotografia dei dati registrati nel portale, non una
 * certificazione: va riletto e sottoscritto dall'amministratore.
 */

import { formatData, formatDataOra, formatMillesimi, formatValuta } from "@/lib/format";
import {
  segmentoNomeFile,
  type Blocco,
  type DatiAmministratore,
  type DatiCondominio,
  type Documento,
} from "./modello";

export type PartitaUnita = {
  descrizione: string;
  categoria: string;
  /** Anno di competenza: la scadenza se c'è, altrimenti la data della spesa. */
  dataCompetenza: string;
  dataScadenza: string | null;
  importo: number;
  statoPagamento: string;
  dataPagamento: string | null;
  codiceAvviso: string | null;
};

export type FasceInsoluto = {
  annoCorrente: number;
  annoPrecedente: number;
  anniAnteriori: number;
  totale: number;
};

export type RiepilogoUnita = {
  totaleAddebitato: number;
  totaleVersato: number;
  insoluto: FasceInsoluto;
  /** Le sole partite non saldate, dalla più vecchia alla più recente. */
  partiteAperte: PartitaUnita[];
};

function annoDi(data: string): number | null {
  const anno = Number(data.slice(0, 4));
  return Number.isInteger(anno) && anno > 1900 ? anno : null;
}

/**
 * Somma le partite di un'unità separando l'insoluto per anno di competenza.
 *
 * Una partita senza anno leggibile finisce tra gli "anni anteriori": è la
 * collocazione prudente, perché la fascia che NON segue l'immobile è proprio
 * quella, e un dato incerto non deve far sembrare più leggera la posizione
 * dell'acquirente di quanto sia.
 */
export function riepilogaPartite(
  partite: PartitaUnita[],
  annoRiferimento: number
): RiepilogoUnita {
  const riepilogo: RiepilogoUnita = {
    totaleAddebitato: 0,
    totaleVersato: 0,
    insoluto: { annoCorrente: 0, annoPrecedente: 0, anniAnteriori: 0, totale: 0 },
    partiteAperte: [],
  };

  for (const partita of partite) {
    riepilogo.totaleAddebitato += partita.importo;

    if (partita.statoPagamento === "pagato") {
      riepilogo.totaleVersato += partita.importo;
      continue;
    }

    riepilogo.partiteAperte.push(partita);
    riepilogo.insoluto.totale += partita.importo;

    const anno = annoDi(partita.dataCompetenza);
    if (anno === annoRiferimento) riepilogo.insoluto.annoCorrente += partita.importo;
    else if (anno === annoRiferimento - 1) riepilogo.insoluto.annoPrecedente += partita.importo;
    else riepilogo.insoluto.anniAnteriori += partita.importo;
  }

  riepilogo.partiteAperte.sort(
    (a, b) =>
      a.dataCompetenza.localeCompare(b.dataCompetenza) ||
      a.descrizione.localeCompare(b.descrizione, "it")
  );

  return riepilogo;
}

export type DatiStatoPatrimoniale = {
  condominio: DatiCondominio & {
    iban: string | null;
    banca: string | null;
    intestatarioConto: string | null;
  };
  unita: {
    identificativo: string;
    piano: string | null;
    millesimiProprieta: number;
    /** Tabelle millesimali diverse dalla generale, se il condominio ne ha. */
    millesimiPerTabella: { nome: string; valore: number }[];
  };
  soggetti: { nominativo: string; qualifica: string; quota: number }[];
  partite: PartitaUnita[];
  annoRiferimento: number;
  amministratore: DatiAmministratore;
  generatoIl: string;
};

const ETICHETTA_STATO: Record<string, string> = {
  da_pagare: "da pagare",
  in_ritardo: "in ritardo",
  pagato: "pagato",
};

export function costruisciStatoPatrimoniale(dati: DatiStatoPatrimoniale): Documento {
  const { condominio, unita, soggetti, annoRiferimento, amministratore } = dati;
  const riepilogo = riepilogaPartite(dati.partite, annoRiferimento);
  const { insoluto } = riepilogo;

  const blocchi: Blocco[] = [
    { tipo: "sottotitolo", testo: `Condominio ${condominio.nome}` },
    { tipo: "paragrafo", testo: condominio.indirizzo },
  ];

  if (condominio.codiceFiscale) {
    blocchi.push({ tipo: "paragrafo", testo: `Codice fiscale ${condominio.codiceFiscale}` });
  }

  blocchi.push(
    { tipo: "spazio" },
    { tipo: "titolo", testo: "Situazione contabile dell'unità immobiliare" },
    { tipo: "spazio" },
    { tipo: "campo", etichetta: "Unità", valore: unita.identificativo },
    { tipo: "campo", etichetta: "Piano", valore: unita.piano?.trim() || "Non indicato" },
    {
      tipo: "campo",
      etichetta: "Millesimi di proprietà",
      valore: formatMillesimi(unita.millesimiProprieta),
    }
  );

  for (const tabella of unita.millesimiPerTabella) {
    blocchi.push({
      tipo: "campo",
      etichetta: `Millesimi ${tabella.nome}`,
      valore: formatMillesimi(tabella.valore),
    });
  }

  blocchi.push({
    tipo: "campo",
    etichetta: "Situazione alla data",
    valore: formatDataOra(dati.generatoIl),
  });

  if (soggetti.length) {
    blocchi.push(
      { tipo: "spazio" },
      { tipo: "sottotitolo", testo: "Soggetti attualmente collegati all'unità" },
      {
        tipo: "elenco",
        voci: soggetti.map((s) =>
          s.quota === 100
            ? `${s.nominativo} — ${s.qualifica}`
            : `${s.nominativo} — ${s.qualifica} (quota ${s.quota}%)`
        ),
      }
    );
  }

  blocchi.push(
    { tipo: "spazio" },
    { tipo: "sottotitolo", testo: "Riepilogo" },
    {
      tipo: "campo",
      etichetta: "Totale addebitato all'unità",
      valore: formatValuta(riepilogo.totaleAddebitato),
    },
    { tipo: "campo", etichetta: "Totale versato", valore: formatValuta(riepilogo.totaleVersato) },
    { tipo: "campo", etichetta: "Totale insoluto", valore: formatValuta(insoluto.totale) }
  );

  if (insoluto.totale > 0) {
    blocchi.push(
      { tipo: "spazio" },
      { tipo: "sottotitolo", testo: "Insoluto per anno di competenza" },
      {
        tipo: "campo",
        etichetta: `Anno in corso (${annoRiferimento})`,
        valore: formatValuta(insoluto.annoCorrente),
      },
      {
        tipo: "campo",
        etichetta: `Anno precedente (${annoRiferimento - 1})`,
        valore: formatValuta(insoluto.annoPrecedente),
      },
      {
        tipo: "campo",
        etichetta: "Anni anteriori",
        valore: formatValuta(insoluto.anniAnteriori),
      },
      {
        tipo: "paragrafo",
        testo:
          "La distinzione per anno è riportata perché l'art. 63 disp. att. c.c. rende chi " +
          "subentra nei diritti del condòmino obbligato in solido con lui per i contributi " +
          "relativi all'anno in corso e a quello precedente. Le somme più vecchie restano a " +
          "carico del solo condòmino attuale.",
      }
    );
  } else {
    blocchi.push(
      { tipo: "spazio" },
      {
        tipo: "paragrafo",
        testo:
          "Alla data indicata non risultano somme insolute a carico dell'unità per le " +
          "ripartizioni registrate nel portale.",
      }
    );
  }

  blocchi.push({ tipo: "spazio" }, { tipo: "sottotitolo", testo: "Partite non saldate" });

  if (riepilogo.partiteAperte.length) {
    blocchi.push({
      tipo: "elenco",
      voci: riepilogo.partiteAperte.map((p) => {
        const scadenza = p.dataScadenza ? `scadenza ${formatData(p.dataScadenza)}` : "senza scadenza";
        const avviso = p.codiceAvviso ? ` — avviso ${p.codiceAvviso}` : "";
        return (
          `${formatData(p.dataCompetenza)} — ${p.descrizione} (${p.categoria}) — ` +
          `${formatValuta(p.importo)} — ${ETICHETTA_STATO[p.statoPagamento] ?? p.statoPagamento} — ` +
          `${scadenza}${avviso}`
        );
      }),
    });
  } else {
    blocchi.push({ tipo: "paragrafo", testo: "Nessuna partita aperta." });
  }

  if (condominio.iban) {
    blocchi.push(
      { tipo: "spazio" },
      { tipo: "sottotitolo", testo: "Coordinate per il versamento" },
      { tipo: "campo", etichetta: "IBAN", valore: condominio.iban },
      ...(condominio.banca
        ? ([{ tipo: "campo", etichetta: "Banca", valore: condominio.banca }] as Blocco[])
        : []),
      ...(condominio.intestatarioConto
        ? ([
            { tipo: "campo", etichetta: "Intestato a", valore: condominio.intestatarioConto },
          ] as Blocco[])
        : [])
    );
  }

  blocchi.push(
    { tipo: "spazio" },
    ...(amministratore
      ? ([
          {
            tipo: "paragrafo",
            testo: `L'amministratore\n${amministratore.nome} ${amministratore.cognome}`,
          },
        ] as Blocco[])
      : []),
    { tipo: "spazio" },
    {
      tipo: "nota",
      testo:
        `Documento generato automaticamente dal portale il ${formatDataOra(dati.generatoIl)} ` +
        "sulle ripartizioni registrate per questa unità. Riporta la situazione risultante dai " +
        "dati inseriti e non costituisce una certificazione: va verificato e sottoscritto " +
        "dall'amministratore prima della consegna, insieme all'indicazione di eventuali lavori " +
        "deliberati e non ancora ripartiti.",
    }
  );

  return {
    titolo: `Situazione contabile — ${unita.identificativo}`,
    nomeFile: `stato-patrimoniale-${segmentoNomeFile(condominio.nome)}-${segmentoNomeFile(
      unita.identificativo
    )}`,
    blocchi,
  };
}
