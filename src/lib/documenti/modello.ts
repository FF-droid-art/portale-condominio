/**
 * Modello (indipendente dal formato) dei documenti legali dell'assemblea.
 *
 * I dati vengono trasformati prima in una sequenza di blocchi tipizzati e solo
 * dopo in PDF: la costruzione del testo resta così una funzione pura,
 * testabile senza generare un file, e lo stesso modello potrà servire domani
 * per un'anteprima HTML o un altro formato.
 *
 * I documenti prodotti sono BOZZE: riportano i dati registrati nel portale in
 * una forma già presentabile, ma vanno riletti e completati dall'amministratore
 * (e, per il verbale, sottoscritti da presidente e segretario). Il caricamento
 * manuale di un PDF redatto altrove resta sempre disponibile.
 */

import { formatData, formatDataOra, formatMillesimi } from "@/lib/format";
import { etichettaMaggioranza, type Convocazione } from "@/lib/quorum";

export type Blocco =
  | { tipo: "titolo"; testo: string }
  | { tipo: "sottotitolo"; testo: string }
  | { tipo: "paragrafo"; testo: string }
  | { tipo: "campo"; etichetta: string; valore: string }
  | { tipo: "elenco"; voci: string[] }
  | { tipo: "nota"; testo: string }
  | { tipo: "spazio" };

export type Documento = {
  /** Titolo del file e intestazione della prima pagina. */
  titolo: string;
  /** Nome file suggerito, senza estensione. */
  nomeFile: string;
  blocchi: Blocco[];
};

export type DatiCondominio = {
  nome: string;
  indirizzo: string;
  codiceFiscale: string | null;
};

export type DatiAmministratore = {
  nome: string;
  cognome: string;
  email: string;
} | null;

const ETICHETTA_CONVOCAZIONE: Record<Convocazione, string> = {
  1: "prima convocazione",
  2: "seconda convocazione",
};

const ETICHETTA_MODALITA: Record<string, string> = {
  presenza: "in presenza",
  remoto: "da remoto",
  delega: "per delega",
};

/**
 * Ripulisce un frammento per usarlo in un nome file. La normalizzazione NFD
 * separa le lettere accentate dai segni diacritici, che poi cadono insieme a
 * ogni altro carattere non alfanumerico: "Condominio Città" -> "condominio-citta".
 */
export function segmentoNomeFile(testo: string): string {
  const normalizzato = testo
    .normalize("NFD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return normalizzato || "documento";
}

function intestazione(condominio: DatiCondominio): Blocco[] {
  const blocchi: Blocco[] = [
    { tipo: "sottotitolo", testo: `Condominio ${condominio.nome}` },
    { tipo: "paragrafo", testo: condominio.indirizzo },
  ];
  if (condominio.codiceFiscale) {
    blocchi.push({ tipo: "paragrafo", testo: `Codice fiscale ${condominio.codiceFiscale}` });
  }
  return blocchi;
}

function firmaAmministratore(amministratore: DatiAmministratore): Blocco[] {
  if (!amministratore) return [];
  return [
    { tipo: "spazio" },
    {
      tipo: "paragrafo",
      testo: `L'amministratore\n${amministratore.nome} ${amministratore.cognome}`,
    },
  ];
}

/* -------------------------------------------------------------------------
   Convocazione
   ------------------------------------------------------------------------- */

export type DatiConvocazione = {
  condominio: DatiCondominio;
  assemblea: {
    tipo: string;
    dataAssemblea: string;
    convocazione: Convocazione;
    luogo: string | null;
    linkVideoconferenza: string | null;
  };
  puntiOdg: { numero: number; descrizione: string; tipoMaggioranza: string }[];
  amministratore: DatiAmministratore;
  generatoIl: string;
};

export function costruisciConvocazione(dati: DatiConvocazione): Documento {
  const { condominio, assemblea, puntiOdg, amministratore } = dati;
  const convocazione = ETICHETTA_CONVOCAZIONE[assemblea.convocazione];

  const blocchi: Blocco[] = [
    ...intestazione(condominio),
    { tipo: "spazio" },
    { tipo: "titolo", testo: `Convocazione di assemblea ${assemblea.tipo}` },
    { tipo: "spazio" },
    {
      tipo: "paragrafo",
      testo:
        `I signori condòmini sono convocati in assemblea ${assemblea.tipo}, in ${convocazione}, ` +
        `per discutere e deliberare sui punti all'ordine del giorno indicati di seguito.`,
    },
    { tipo: "spazio" },
    { tipo: "campo", etichetta: "Data e ora", valore: formatDataOra(assemblea.dataAssemblea) },
    {
      tipo: "campo",
      etichetta: "Luogo",
      valore: assemblea.luogo?.trim() || "Da definire",
    },
    { tipo: "campo", etichetta: "Convocazione", valore: convocazione },
  ];

  if (assemblea.linkVideoconferenza) {
    blocchi.push({
      tipo: "campo",
      etichetta: "Partecipazione da remoto",
      valore: assemblea.linkVideoconferenza,
    });
  }

  blocchi.push({ tipo: "spazio" }, { tipo: "sottotitolo", testo: "Ordine del giorno" });

  if (puntiOdg.length) {
    blocchi.push({
      tipo: "elenco",
      voci: puntiOdg
        .slice()
        .sort((a, b) => a.numero - b.numero)
        .map(
          (p) =>
            `${p.numero}. ${p.descrizione} (${etichettaMaggioranza(p.tipoMaggioranza).toLowerCase()})`
        ),
    });
  } else {
    blocchi.push({
      tipo: "paragrafo",
      testo: "Nessun punto all'ordine del giorno è ancora stato inserito nel portale.",
    });
  }

  blocchi.push(
    { tipo: "spazio" },
    {
      tipo: "paragrafo",
      testo:
        "Il condòmino impossibilitato a partecipare può farsi rappresentare da un delegato, " +
        "nei limiti previsti dall'art. 67 disp. att. c.c. La delega può essere conferita anche " +
        "dall'area riservata del portale.",
    },
    ...firmaAmministratore(amministratore),
    { tipo: "spazio" },
    {
      tipo: "nota",
      testo:
        `Bozza generata automaticamente dal portale il ${formatDataOra(dati.generatoIl)} sui dati ` +
        "registrati per questa assemblea. Verificare i contenuti prima dell'invio ai condòmini.",
    }
  );

  return {
    titolo: `Convocazione assemblea ${assemblea.tipo}`,
    nomeFile: `convocazione-${segmentoNomeFile(condominio.nome)}-${formatDataFile(
      assemblea.dataAssemblea
    )}`,
    blocchi,
  };
}

/* -------------------------------------------------------------------------
   Verbale
   ------------------------------------------------------------------------- */

export type DatiVerbale = {
  condominio: DatiCondominio;
  assemblea: {
    tipo: string;
    dataAssemblea: string;
    convocazione: Convocazione;
    luogo: string | null;
    stato: string;
  };
  quorum: {
    unitaTotali: number;
    millesimiTotali: number;
    unitaIntervenute: number;
    millesimiIntervenuti: number;
    raggiunto: boolean;
    riferimento: string;
  };
  presenze: { identificativo: string; modalita: string; millesimi: number }[];
  deleghe: { delegante: string; delegato: string }[];
  punti: {
    numero: number;
    descrizione: string;
    tipoMaggioranza: string;
    esito: string | null;
    favorevoliMillesimi: number;
    contrariMillesimi: number;
    astenutiMillesimi: number;
    quorumRaggiunto: boolean;
    riferimento: string;
  }[];
  amministratore: DatiAmministratore;
  generatoIl: string;
};

export function costruisciVerbale(dati: DatiVerbale): Documento {
  const { condominio, assemblea, quorum, presenze, deleghe, punti, amministratore } = dati;
  const convocazione = ETICHETTA_CONVOCAZIONE[assemblea.convocazione];

  const blocchi: Blocco[] = [
    ...intestazione(condominio),
    { tipo: "spazio" },
    { tipo: "titolo", testo: `Verbale di assemblea ${assemblea.tipo}` },
    { tipo: "spazio" },
    { tipo: "campo", etichetta: "Data e ora", valore: formatDataOra(assemblea.dataAssemblea) },
    { tipo: "campo", etichetta: "Luogo", valore: assemblea.luogo?.trim() || "Non indicato" },
    { tipo: "campo", etichetta: "Convocazione", valore: convocazione },
    { tipo: "spazio" },
    { tipo: "sottotitolo", testo: "Costituzione dell'assemblea" },
    {
      tipo: "campo",
      etichetta: "Unità intervenute",
      valore: `${quorum.unitaIntervenute} su ${quorum.unitaTotali}`,
    },
    {
      tipo: "campo",
      etichetta: "Millesimi rappresentati",
      valore: `${formatMillesimi(quorum.millesimiIntervenuti)} su ${formatMillesimi(
        quorum.millesimiTotali
      )}`,
    },
    {
      tipo: "paragrafo",
      testo: quorum.raggiunto
        ? `L'assemblea, in ${convocazione}, risulta regolarmente costituita (${quorum.riferimento}).`
        : `In base ai dati registrati l'assemblea, in ${convocazione}, NON raggiunge il quorum costitutivo (${quorum.riferimento}).`,
    },
  ];

  if (presenze.length) {
    blocchi.push(
      { tipo: "spazio" },
      { tipo: "sottotitolo", testo: "Elenco dei presenti" },
      {
        tipo: "elenco",
        voci: presenze.map(
          (p) =>
            `${p.identificativo} — ${ETICHETTA_MODALITA[p.modalita] ?? p.modalita} — ${formatMillesimi(
              p.millesimi
            )} millesimi`
        ),
      }
    );
  }

  if (deleghe.length) {
    blocchi.push(
      { tipo: "spazio" },
      { tipo: "sottotitolo", testo: "Deleghe" },
      { tipo: "elenco", voci: deleghe.map((d) => `${d.delegante} rappresentata da ${d.delegato}`) }
    );
  }

  blocchi.push({ tipo: "spazio" }, { tipo: "sottotitolo", testo: "Ordine del giorno e delibere" });

  if (!punti.length) {
    blocchi.push({
      tipo: "paragrafo",
      testo: "Nessun punto all'ordine del giorno è registrato per questa assemblea.",
    });
  }

  for (const punto of punti.slice().sort((a, b) => a.numero - b.numero)) {
    blocchi.push(
      { tipo: "spazio" },
      {
        tipo: "paragrafo",
        testo: `Punto ${punto.numero} — ${punto.descrizione}`,
      },
      {
        tipo: "campo",
        etichetta: "Maggioranza richiesta",
        valore: `${etichettaMaggioranza(punto.tipoMaggioranza)} (${punto.riferimento})`,
      },
      {
        tipo: "campo",
        etichetta: "Millesimi favorevoli",
        valore: formatMillesimi(punto.favorevoliMillesimi),
      },
      {
        tipo: "campo",
        etichetta: "Millesimi contrari",
        valore: formatMillesimi(punto.contrariMillesimi),
      },
      {
        tipo: "campo",
        etichetta: "Millesimi astenuti",
        valore: formatMillesimi(punto.astenutiMillesimi),
      },
      {
        tipo: "campo",
        etichetta: "Esito",
        valore: descriviEsito(punto.esito, punto.quorumRaggiunto),
      }
    );
  }

  blocchi.push(
    { tipo: "spazio" },
    {
      tipo: "paragrafo",
      testo:
        "Null'altro essendovi da deliberare, e nessuno chiedendo la parola, la seduta è tolta.",
    },
    { tipo: "spazio" },
    { tipo: "paragrafo", testo: "Il presidente\n\n\nIl segretario" },
    ...firmaAmministratore(amministratore),
    { tipo: "spazio" },
    {
      tipo: "nota",
      testo:
        `Bozza generata automaticamente dal portale il ${formatDataOra(dati.generatoIl)} sui dati ` +
        "registrati (presenze, deleghe, voti). I quorum indicati sono calcolati in automatico e " +
        "non sostituiscono la verifica dell'amministratore.",
    }
  );

  return {
    titolo: `Verbale assemblea ${assemblea.tipo}`,
    nomeFile: `verbale-${segmentoNomeFile(condominio.nome)}-${formatDataFile(
      assemblea.dataAssemblea
    )}`,
    blocchi,
  };
}

function descriviEsito(esito: string | null, quorumRaggiunto: boolean): string {
  if (esito === "approvato") {
    return quorumRaggiunto
      ? "Approvato"
      : "Approvato a maggioranza dei voti espressi, ma il quorum di legge risulta non raggiunto";
  }
  if (esito === "respinto") return "Respinto";
  return quorumRaggiunto
    ? "Votazione non ancora chiusa (quorum già raggiunto sui voti registrati)"
    : "Votazione non ancora chiusa";
}

/** Data in formato ISO breve (aaaa-mm-gg) per i nomi file. */
function formatDataFile(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return segmentoNomeFile(formatData(iso));
  return d.toISOString().slice(0, 10);
}
