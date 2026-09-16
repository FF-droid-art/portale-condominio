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

import { formatData, formatDataOra, formatMillesimi, formatOra } from "@/lib/format";
import { etichettaMaggioranza, type Convocazione } from "@/lib/quorum";

/**
 * Colonna di una tabella. L'allineamento non è un vezzo tipografico: gli importi
 * si confrontano a colpo d'occhio solo se le unità stanno incolonnate, quindi
 * tutto ciò che è numerico va a destra e il resto a sinistra.
 */
export type ColonnaTabella = {
  intestazione: string;
  allineamento?: "sinistra" | "destra";
};

export type Blocco =
  | { tipo: "titolo"; testo: string }
  | { tipo: "sottotitolo"; testo: string }
  | { tipo: "paragrafo"; testo: string }
  | { tipo: "campo"; etichetta: string; valore: string }
  | { tipo: "elenco"; voci: string[] }
  /**
   * Tabella a colonne allineate. Le celle sono già formattate (stringhe): la
   * resa non deve conoscere valute né date, e il testo del documento resta
   * verificabile senza generare un PDF.
   */
  | {
      tipo: "tabella";
      colonne: ColonnaTabella[];
      righe: string[][];
      /** Riga conclusiva dei totali: stessa forma delle altre, resa in grassetto. */
      totali?: string[];
    }
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
 * Riga da completare a penna. I documenti restano bozze da stampare: dove il
 * portale non ha (e non può avere) il dato — l'ora di chiusura dei lavori, il
 * nome di un presidente non ancora registrato — la prassi è lasciare uno spazio
 * visibile, non una frase che finge una certezza.
 */
const DA_COMPILARE = "_____________________";

/** Giorni di preavviso richiesti dall'art. 66 c. 3 disp. att. c.c. */
const PREAVVISO_GIORNI = 5;
const GIORNO_MS = 24 * 60 * 60 * 1000;

/** Giorni interi tra due istanti; NaN se una delle due date non è leggibile. */
function giorniTra(daIso: string, aIso: string): number {
  const da = new Date(daIso).getTime();
  const a = new Date(aIso).getTime();
  if (Number.isNaN(da) || Number.isNaN(a)) return Number.NaN;
  return Math.floor((a - da) / GIORNO_MS);
}

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
  const luogo = assemblea.luogo?.trim() || "Da definire";

  const blocchi: Blocco[] = [
    ...intestazione(condominio),
    { tipo: "spazio" },
    { tipo: "titolo", testo: `Avviso di convocazione di assemblea ${assemblea.tipo}` },
    { tipo: "paragrafo", testo: "Ai signori partecipanti al condominio, loro sedi" },
    { tipo: "spazio" },
    {
      tipo: "paragrafo",
      testo:
        `Le SS.LL. sono invitate a partecipare all'assemblea ${assemblea.tipo} dei condòmini, ` +
        `convocata in ${convocazione} per il giorno ${formatData(assemblea.dataAssemblea)} ` +
        `alle ore ${formatOra(assemblea.dataAssemblea)} presso ${luogo}, ` +
        "per discutere e deliberare sul seguente ordine del giorno.",
    },
    { tipo: "spazio" },
    { tipo: "campo", etichetta: "Data e ora", valore: formatDataOra(assemblea.dataAssemblea) },
    { tipo: "campo", etichetta: "Luogo", valore: luogo },
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
    // L'art. 66 c. 3 disp. att. c.c. chiede la "specifica indicazione
    // dell'ordine del giorno": ogni punto va enunciato per esteso, perché
    // l'assemblea potrà deliberare solo su ciò che è scritto qui.
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

  const avvertenze: string[] = [
    "L'assemblea può discutere e deliberare soltanto sugli argomenti indicati nell'ordine del giorno.",
    "Il presente avviso deve essere comunicato a tutti gli aventi diritto almeno cinque giorni prima " +
      "della data fissata per l'adunanza in prima convocazione, a mezzo di posta raccomandata, posta " +
      "elettronica certificata, fax o consegna a mani (art. 66 c. 3 disp. att. c.c.).",
  ];

  if (assemblea.convocazione === 1) {
    avvertenze.push(
      "L'assemblea in seconda convocazione non può tenersi nel medesimo giorno solare della prima " +
        "(art. 66 c. 3 disp. att. c.c.) e deve svolgersi entro dieci giorni dalla prima " +
        "(art. 1136 c. 3 c.c.)."
    );
  }

  avvertenze.push(
    "In caso di omessa, tardiva o incompleta convocazione degli aventi diritto la deliberazione " +
      "assembleare è annullabile su istanza dei dissenzienti o assenti perché non ritualmente " +
      "convocati (art. 66 c. 3 disp. att. c.c.)."
  );

  blocchi.push(
    { tipo: "spazio" },
    { tipo: "sottotitolo", testo: "Avvertenze" },
    { tipo: "elenco", voci: avvertenze },
    { tipo: "spazio" },
    { tipo: "sottotitolo", testo: "Deleghe" },
    {
      tipo: "paragrafo",
      testo:
        "Il condòmino impossibilitato a partecipare può farsi rappresentare in assemblea da un " +
        "delegato munito di delega scritta. Se i condòmini sono più di venti, il delegato non può " +
        "rappresentare più di un quinto dei condòmini e del valore proporzionale; la delega non può " +
        "essere conferita all'amministratore (art. 67 disp. att. c.c.). La delega può essere " +
        "conferita anche dall'area riservata del portale, oppure compilando il modulo in calce.",
    },
    ...firmaAmministratore(amministratore),
    { tipo: "spazio" },
    // Il tagliando di delega sta in calce all'avviso, dopo la firma: è la
    // posizione della modulistica di categoria, così il condòmino lo stacca e
    // lo consegna al delegato senza doversi procurare un altro foglio.
    { tipo: "paragrafo", testo: "- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -" },
    { tipo: "sottotitolo", testo: "Modulo di delega" },
    {
      tipo: "paragrafo",
      testo:
        `Il/la sottoscritto/a ${DA_COMPILARE}, proprietario/a dell'unità ${DA_COMPILARE} ` +
        `del Condominio ${condominio.nome}, delega il/la sig./ra ${DA_COMPILARE} ` +
        `a rappresentarlo/a nell'assemblea ${assemblea.tipo} del ` +
        `${formatData(assemblea.dataAssemblea)}, in ${convocazione}, approvando fin d'ora il suo ` +
        "operato sugli argomenti all'ordine del giorno.",
    },
    { tipo: "spazio" },
    { tipo: "campo", etichetta: "Data", valore: DA_COMPILARE },
    { tipo: "campo", etichetta: "Firma del delegante", valore: DA_COMPILARE }
  );

  // Il portale conosce sia la data dell'assemblea sia il momento in cui la
  // bozza viene prodotta: se il margine è già sotto i cinque giorni conviene
  // dirlo qui, perché il termine decorre dalla RICEZIONE dell'avviso e un
  // ritardo rende annullabili le delibere.
  const giorniDiPreavviso = giorniTra(dati.generatoIl, assemblea.dataAssemblea);
  if (
    assemblea.convocazione === 1 &&
    !Number.isNaN(giorniDiPreavviso) &&
    giorniDiPreavviso < PREAVVISO_GIORNI
  ) {
    blocchi.push(
      { tipo: "spazio" },
      {
        tipo: "nota",
        testo:
          "Attenzione: dalla generazione di questo avviso alla data dell'assemblea mancano meno di " +
          `${PREAVVISO_GIORNI} giorni. Il termine dell'art. 66 c. 3 disp. att. c.c. decorre dalla ` +
          "ricezione da parte del destinatario: valutare lo spostamento della data.",
      }
    );
  }

  blocchi.push(
    { tipo: "spazio" },
    {
      tipo: "nota",
      testo:
        `Bozza generata automaticamente dal portale il ${formatDataOra(dati.generatoIl)} sui dati ` +
        "registrati per questa assemblea. Verificare i contenuti prima dell'invio ai condòmini. " +
        "L'assemblea va di norma convocata in un luogo del comune in cui si trova l'edificio, " +
        "idoneo ad accogliere tutti gli aventi diritto.",
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
  /**
   * Nominativi di presidente e segretario, se già registrati tra i firmatari
   * del verbale. Sono null finché l'amministratore non li indica nel portale:
   * la bozza lascia allora la riga da compilare a mano.
   */
  cariche: { presidente: string | null; segretario: string | null };
  presenze: { identificativo: string; modalita: string; millesimi: number }[];
  /** Unità del condominio che non risultano intervenute, né di persona né per delega. */
  assenti: { identificativo: string; millesimi: number }[];
  deleghe: { delegante: string; delegato: string }[];
  punti: {
    numero: number;
    descrizione: string;
    tipoMaggioranza: string;
    esito: string | null;
    favorevoliUnita: number;
    contrariUnita: number;
    astenutiUnita: number;
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
  const { condominio, assemblea, quorum, cariche, presenze, assenti, deleghe, punti, amministratore } =
    dati;
  const convocazione = ETICHETTA_CONVOCAZIONE[assemblea.convocazione];
  const luogo = assemblea.luogo?.trim() || "Non indicato";
  const presidente = cariche.presidente?.trim() || DA_COMPILARE;
  const segretario = cariche.segretario?.trim() || DA_COMPILARE;
  const puntiOrdinati = punti.slice().sort((a, b) => a.numero - b.numero);

  const blocchi: Blocco[] = [
    ...intestazione(condominio),
    { tipo: "spazio" },
    { tipo: "titolo", testo: `Verbale di assemblea ${assemblea.tipo}` },
    { tipo: "paragrafo", testo: "(art. 1136 c.c.)" },
    { tipo: "spazio" },
    {
      tipo: "paragrafo",
      testo:
        `Il giorno ${formatData(assemblea.dataAssemblea)} alle ore ` +
        `${formatOra(assemblea.dataAssemblea)}, presso ${luogo}, si è riunita in ${convocazione} ` +
        `l'assemblea ${assemblea.tipo} dei condòmini del Condominio ${condominio.nome}, ` +
        "convocata con avviso comunicato a tutti gli aventi diritto, per discutere e deliberare " +
        "sul seguente ordine del giorno.",
    },
    { tipo: "spazio" },
    { tipo: "campo", etichetta: "Data e ora", valore: formatDataOra(assemblea.dataAssemblea) },
    { tipo: "campo", etichetta: "Luogo", valore: luogo },
    { tipo: "campo", etichetta: "Convocazione", valore: convocazione },
    { tipo: "spazio" },
    { tipo: "sottotitolo", testo: "Ordine del giorno" },
  ];

  // L'ordine del giorno va ripetuto qui nella stessa formulazione dell'avviso:
  // è il perimetro entro cui l'assemblea può deliberare, e chi legge il verbale
  // deve poterlo confrontare senza avere sottomano la convocazione.
  if (puntiOrdinati.length) {
    blocchi.push({
      tipo: "elenco",
      voci: puntiOrdinati.map((p) => `${p.numero}. ${p.descrizione}`),
    });
  } else {
    blocchi.push({
      tipo: "paragrafo",
      testo: "Nessun punto all'ordine del giorno è registrato per questa assemblea.",
    });
  }

  // Nella prassi la prima cosa verbalizzata è la nomina delle cariche: è il
  // presidente a dare atto della regolarità della convocazione e della
  // costituzione, quindi deve esistere prima di quella constatazione.
  blocchi.push(
    { tipo: "spazio" },
    { tipo: "sottotitolo", testo: "Nomina del presidente e del segretario" },
    {
      tipo: "paragrafo",
      testo:
        `L'assemblea chiama a presiedere la seduta il/la sig./ra ${presidente}, che accetta, ` +
        `e nomina segretario il/la sig./ra ${segretario}, incaricato/a della redazione del ` +
        "presente verbale.",
    }
  );

  if (!cariche.presidente || !cariche.segretario) {
    blocchi.push({
      tipo: "nota",
      testo:
        "I nominativi mancanti vengono compilati in automatico se presidente e segretario sono " +
        "registrati tra i firmatari del verbale nella scheda dell'assemblea: in quel caso basta " +
        "rigenerare il documento.",
    });
  }

  blocchi.push(
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
    }
  );

  if (presenze.length) {
    blocchi.push(
      { tipo: "spazio" },
      { tipo: "paragrafo", testo: "Fatto l'appello, risultano intervenute le seguenti unità:" },
      {
        tipo: "tabella",
        colonne: [
          { intestazione: "Unità" },
          { intestazione: "Partecipazione" },
          { intestazione: "Millesimi", allineamento: "destra" },
        ],
        righe: presenze.map((p) => [
          p.identificativo,
          ETICHETTA_MODALITA[p.modalita] ?? p.modalita,
          formatMillesimi(p.millesimi),
        ]),
      }
    );
  }

  if (deleghe.length) {
    blocchi.push(
      { tipo: "spazio" },
      { tipo: "paragrafo", testo: "Sono state esibite le seguenti deleghe scritte:" },
      {
        tipo: "tabella",
        colonne: [{ intestazione: "Unità delegante" }, { intestazione: "Delegato" }],
        righe: deleghe.map((d) => [d.delegante, d.delegato]),
      }
    );
  }

  // Gli assenti si indicano per nome perché per loro il termine di
  // impugnazione dell'art. 1137 c.c. decorre dalla comunicazione del verbale,
  // non dalla data della delibera: senza l'elenco non è verificabile.
  if (assenti.length) {
    blocchi.push(
      { tipo: "spazio" },
      { tipo: "paragrafo", testo: "Risultano assenti le seguenti unità:" },
      {
        tipo: "tabella",
        colonne: [{ intestazione: "Unità" }, { intestazione: "Millesimi", allineamento: "destra" }],
        righe: assenti.map((a) => [a.identificativo, formatMillesimi(a.millesimi)]),
      }
    );
  }

  blocchi.push({
    tipo: "paragrafo",
    testo: quorum.raggiunto
      ? `Il presidente, verificata la regolarità degli avvisi di convocazione e delle deleghe, ` +
        `dà atto che l'assemblea, in ${convocazione}, è regolarmente costituita e atta a ` +
        `deliberare (${quorum.riferimento}).`
      : `In base ai dati registrati l'assemblea, in ${convocazione}, NON raggiunge il quorum ` +
        `costitutivo (${quorum.riferimento}). Della mancata costituzione si dà atto a verbale, ` +
        "da trascrivere comunque nel registro dei verbali (art. 1130 n. 7 c.c.).",
  });

  blocchi.push(
    { tipo: "spazio" },
    { tipo: "sottotitolo", testo: "Trattazione dell'ordine del giorno" }
  );

  if (!puntiOrdinati.length) {
    blocchi.push({
      tipo: "paragrafo",
      testo: "Nessun punto all'ordine del giorno è registrato per questa assemblea.",
    });
  }

  for (const punto of puntiOrdinati) {
    blocchi.push(
      { tipo: "spazio" },
      { tipo: "sottotitolo", testo: `Punto ${punto.numero} — ${punto.descrizione}` },
      {
        tipo: "campo",
        etichetta: "Maggioranza richiesta",
        valore: `${etichettaMaggioranza(punto.tipoMaggioranza)} (${punto.riferimento})`,
      },
      {
        tipo: "paragrafo",
        testo:
          "Il presidente illustra il punto e apre la discussione; esaurita la discussione si " +
          "procede alla votazione, che dà il seguente risultato:",
      },
      // Voti per teste E per millesimi: la maggioranza dell'art. 1136 c.c. è
      // doppia, e un verbale che riporti solo i millesimi non permette di
      // verificare la "maggioranza degli intervenuti".
      {
        tipo: "tabella",
        colonne: [
          { intestazione: "Voto" },
          { intestazione: "Unità", allineamento: "destra" },
          { intestazione: "Millesimi", allineamento: "destra" },
        ],
        righe: [
          ["Favorevoli", String(punto.favorevoliUnita), formatMillesimi(punto.favorevoliMillesimi)],
          ["Contrari", String(punto.contrariUnita), formatMillesimi(punto.contrariMillesimi)],
          ["Astenuti", String(punto.astenutiUnita), formatMillesimi(punto.astenutiMillesimi)],
        ],
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
        "Esaurito l'ordine del giorno e null'altro essendovi da deliberare, nessuno chiedendo la " +
        `parola, il presidente dichiara sciolta l'assemblea alle ore ${DA_COMPILARE}.`,
    },
    {
      tipo: "paragrafo",
      testo:
        "Il presente verbale, previa lettura, viene confermato e sottoscritto e sarà trascritto " +
        "nel registro dei verbali delle assemblee tenuto dall'amministratore (art. 1130 n. 7 c.c.).",
    },
    { tipo: "spazio" },
    { tipo: "paragrafo", testo: `Il presidente\n${presidente}` },
    { tipo: "spazio" },
    { tipo: "paragrafo", testo: `Il segretario\n${segretario}` },
    ...firmaAmministratore(amministratore),
    { tipo: "spazio" },
    {
      tipo: "nota",
      testo:
        "Le deliberazioni contrarie alla legge o al regolamento di condominio possono essere " +
        "impugnate davanti all'autorità giudiziaria, a pena di decadenza, entro trenta giorni: " +
        "il termine decorre dalla data della deliberazione per i dissenzienti e gli astenuti, " +
        "dalla data di comunicazione del verbale per gli assenti (art. 1137 c.c.).",
    }
  );

  if (assemblea.stato !== "conclusa") {
    blocchi.push({
      tipo: "nota",
      testo:
        "L'assemblea non risulta ancora conclusa nel portale: presenze e voti qui riportati sono " +
        "quelli registrati al momento della generazione e possono ancora cambiare.",
    });
  }

  blocchi.push({
    tipo: "nota",
    testo:
      `Bozza generata automaticamente dal portale il ${formatDataOra(dati.generatoIl)} sui dati ` +
      "registrati (presenze, deleghe, voti). I quorum indicati sono calcolati in automatico e " +
      "non sostituiscono la verifica dell'amministratore.",
  });

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
