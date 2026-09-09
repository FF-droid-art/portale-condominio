/**
 * Lettera di sollecito per le quote condominiali arretrate.
 *
 * Tre toni per tre livelli (vedi `@/lib/solleciti`): promemoria, richiamo
 * formale, diffida ad adempiere. Cambia il testo di apertura e di chiusura,
 * non la sostanza: l'elenco delle rate scadute e le coordinate per pagare
 * devono esserci sempre, perché è quello che serve davvero a chi riceve la
 * lettera per sistemare la posizione.
 *
 * La lettera NON è un atto legale: è la comunicazione dell'amministratore, da
 * rileggere e sottoscrivere prima di spedirla. Anche la diffida (livello 3)
 * resta una lettera — il decreto ingiuntivo lo chiede un legale, non il
 * portale.
 *
 * Come gli altri documenti, i dati diventano prima blocchi tipizzati
 * (`./modello`) e solo dopo PDF: il testo si verifica senza generare un file.
 */

import { formatData, formatDataOra, formatValuta } from "@/lib/format";
import { ETICHETTE_LIVELLO, type LivelloSollecito } from "@/lib/solleciti";
import {
  segmentoNomeFile,
  type Blocco,
  type DatiAmministratore,
  type DatiCondominio,
  type Documento,
} from "./modello";

export type RataSollecito = {
  descrizione: string;
  dataScadenza: string | null;
  importo: number;
  giorniRitardo: number;
  codiceAvviso: string | null;
};

export type DatiSollecito = {
  condominio: DatiCondominio & {
    iban: string | null;
    banca: string | null;
    intestatarioConto: string | null;
  };
  unita: { identificativo: string; piano: string | null };
  /** Intestatari a cui la lettera è indirizzata. */
  destinatari: string[];
  livello: LivelloSollecito;
  rate: RataSollecito[];
  totale: number;
  giorniRitardoMax: number;
  amministratore: DatiAmministratore;
  generatoIl: string;
};

const OGGETTO: Record<LivelloSollecito, string> = {
  1: "Promemoria di pagamento delle quote condominiali",
  2: "Sollecito di pagamento delle quote condominiali",
  3: "Diffida ad adempiere al pagamento delle quote condominiali",
};

const APERTURA: Record<LivelloSollecito, string> = {
  1:
    "Dalla contabilità del condominio risultano a carico dell'unità indicata alcune quote " +
    "non ancora versate. Si tratta con ogni probabilità di una svista: con la presente si " +
    "invita cortesemente a provvedere al versamento delle somme elencate di seguito.",
  2:
    "Nonostante il tempo trascorso dalla scadenza, dalla contabilità del condominio risultano " +
    "tuttora impagate le quote elencate di seguito. Si sollecita pertanto il versamento delle " +
    "somme dovute nel più breve tempo possibile.",
  3:
    "Le quote elencate di seguito risultano tuttora impagate, malgrado i precedenti solleciti. " +
    "Con la presente si diffida formalmente a provvedere al pagamento integrale delle somme " +
    "dovute entro quindici giorni dal ricevimento della presente.",
};

const CHIUSURA: Record<LivelloSollecito, string> = {
  1:
    "Qualora il pagamento sia già stato effettuato, la presente è da considerarsi priva di " +
    "effetto: in tal caso si prega di trasmettere la contabile all'amministrazione, così da " +
    "aggiornare la posizione.",
  2:
    "Qualora il pagamento sia già stato effettuato, si prega di trasmettere la contabile " +
    "all'amministrazione. In mancanza di riscontro l'amministrazione sarà tenuta a procedere " +
    "con le azioni previste per il recupero delle somme.",
  3:
    "Decorso inutilmente il termine indicato, l'amministratore procederà al recupero coattivo " +
    "delle somme dovute, come previsto dall'art. 63 disp. att. c.c. e dall'art. 1129, comma 9, " +
    "c.c., con addebito delle relative spese al condòmino moroso.",
};

export function costruisciSollecito(dati: DatiSollecito): Documento {
  const { condominio, unita, destinatari, livello, rate, amministratore } = dati;

  const blocchi: Blocco[] = [
    { tipo: "sottotitolo", testo: `Condominio ${condominio.nome}` },
    { tipo: "paragrafo", testo: condominio.indirizzo },
  ];

  if (condominio.codiceFiscale) {
    blocchi.push({ tipo: "paragrafo", testo: `Codice fiscale ${condominio.codiceFiscale}` });
  }

  blocchi.push(
    { tipo: "spazio" },
    { tipo: "titolo", testo: OGGETTO[livello] },
    { tipo: "spazio" },
    {
      tipo: "campo",
      etichetta: "Destinatari",
      valore: destinatari.length ? destinatari.join(", ") : "Ai proprietari dell'unità",
    },
    { tipo: "campo", etichetta: "Unità", valore: unita.identificativo },
    ...(unita.piano?.trim()
      ? ([{ tipo: "campo", etichetta: "Piano", valore: unita.piano.trim() }] as Blocco[])
      : []),
    { tipo: "campo", etichetta: "Situazione alla data", valore: formatData(dati.generatoIl) },
    { tipo: "spazio" },
    { tipo: "paragrafo", testo: APERTURA[livello] },
    { tipo: "spazio" },
    { tipo: "sottotitolo", testo: "Quote scadute e non versate" }
  );

  if (rate.length) {
    blocchi.push({
      tipo: "elenco",
      voci: rate.map((r) => {
        const scadenza = r.dataScadenza
          ? `scadenza ${formatData(r.dataScadenza)} (${r.giorniRitardo} ${
              r.giorniRitardo === 1 ? "giorno" : "giorni"
            } di ritardo)`
          : "senza data di scadenza";
        const avviso = r.codiceAvviso ? ` — avviso ${r.codiceAvviso}` : "";
        return `${r.descrizione} — ${formatValuta(r.importo)} — ${scadenza}${avviso}`;
      }),
    });
  } else {
    blocchi.push({ tipo: "paragrafo", testo: "Nessuna quota scaduta risulta al momento." });
  }

  blocchi.push(
    { tipo: "spazio" },
    { tipo: "campo", etichetta: "Totale dovuto", valore: formatValuta(dati.totale) }
  );

  if (dati.giorniRitardoMax > 0) {
    blocchi.push({
      tipo: "campo",
      etichetta: "Ritardo massimo",
      valore: `${dati.giorniRitardoMax} ${dati.giorniRitardoMax === 1 ? "giorno" : "giorni"}`,
    });
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
        : []),
      {
        tipo: "paragrafo",
        testo:
          "Nella causale si prega di indicare l'unità immobiliare e, dove presente, il codice " +
          "dell'avviso riportato accanto a ciascuna quota: rende immediato l'abbinamento del " +
          "versamento alla posizione.",
      }
    );
  } else {
    blocchi.push(
      { tipo: "spazio" },
      {
        tipo: "paragrafo",
        testo:
          "Per le coordinate del conto corrente condominiale si prega di rivolgersi " +
          "all'amministrazione.",
      }
    );
  }

  blocchi.push(
    { tipo: "spazio" },
    { tipo: "paragrafo", testo: CHIUSURA[livello] },
    { tipo: "spazio" },
    { tipo: "paragrafo", testo: "Distinti saluti." },
    ...(amministratore
      ? ([
          { tipo: "spazio" },
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
        `Lettera generata automaticamente dal portale il ${formatDataOra(dati.generatoIl)} sulle ` +
        "ripartizioni registrate per questa unità. Va riletta e sottoscritta dall'amministratore " +
        "prima dell'invio; non costituisce di per sé un atto con valore legale.",
    }
  );

  return {
    titolo: `${ETICHETTE_LIVELLO[livello]} — ${unita.identificativo}`,
    nomeFile: `sollecito-${livello}-${segmentoNomeFile(condominio.nome)}-${segmentoNomeFile(
      unita.identificativo
    )}`,
    blocchi,
  };
}
