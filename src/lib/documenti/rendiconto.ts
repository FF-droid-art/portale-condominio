/**
 * Rendiconto annuale del condominio (art. 1130-bis c.c.).
 *
 * COM'È FATTO E PERCHÉ. L'art. 1130-bis dice che il rendiconto «si compone di
 * un registro di contabilità, di un riepilogo finanziario, nonché di una nota
 * sintetica esplicativa della gestione con l'indicazione anche dei rapporti in
 * corso e delle questioni pendenti». La Cassazione (sez. II, 25446/2025, sulla
 * scia di 28257/2023) ha chiarito che non serve la rigidità del bilancio
 * civilistico, ma servono tutti e tre i pezzi e devono essere leggibili: il
 * documento segue quindi quella tripartizione, più lo stato di ripartizione fra
 * le unità che nella pratica di categoria accompagna sempre il consuntivo.
 *
 * DUE PIANI, TENUTI SEPARATI APPOSTA. Il rendiconto è un sistema MISTO: il
 * registro di contabilità è per cassa (incassi e pagamenti davvero avvenuti),
 * il riepilogo finanziario è per competenza (crediti e debiti a fine periodo).
 * Confondere i due piani è il modo più rapido per far tornare i conti sbagliati:
 *
 *  - la CASSA dell'anno: quanto è uscito (spese datate nell'anno) e quanto è
 *    entrato (quote effettivamente versate nell'anno, indipendentemente da
 *    quale anno riguardassero). La differenza è il risultato del periodo.
 *  - la COMPETENZA per unità: quanto è stato addebitato a ciascuna unità per
 *    l'anno, quanto di quello ha versato e quanto resta scoperto. Un versamento
 *    fatto quest'anno su una rata dell'anno scorso entra nella cassa di
 *    quest'anno ma nella competenza di quello scorso.
 *
 * Le due cose si ricongiungono nella colonna dei saldi: per ogni unità
 * `saldo al 31/12 = saldo al 1° gennaio + addebitato nell'anno − versato
 * nell'anno`, che è esattamente il modo in cui i gestionali di categoria
 * presentano il riparto consuntivo.
 *
 * LA SITUAZIONE PATRIMONIALE NON È IL SALDO DELL'ANNO. Il riepilogo finanziario
 * è una fotografia al 31 dicembre, non il risultato del periodo: le
 * disponibilità sono la cassa CUMULATA (tutti gli incassi meno tutte le uscite
 * registrate fino a quella data, da sempre) e i crediti verso i condòmini sono
 * TUTTE le quote addebitate e non ancora versate a quella data, non solo quelle
 * dell'anno del rendiconto. È la stessa lettura di `stato-patrimoniale.ts` per
 * la singola unità: le due stampe non devono poter raccontare storie diverse
 * sullo stesso dato.
 *
 * L'anno di competenza di una quota è quello della sua scadenza; se manca, si
 * usa la data della spesa — ancora la regola dello stato patrimoniale.
 *
 * QUELLO CHE IL PORTALE NON SA. Il preventivo approvato dall'assemblea, i fondi
 * e le riserve dell'art. 1135 c.c. e i debiti verso fornitori per fatture non
 * ancora pagate non sono dati tracciati qui. Non vengono inventati né taciuti:
 * il documento li dichiara mancanti dove la struttura standard li prevede.
 */

import { formatData, formatDataOra, formatValuta } from "@/lib/format";
import { contaSegnalazioni } from "@/lib/segnalazioni";
import type { PrioritaSegnalazione, StatoSegnalazione } from "@/lib/types";
import {
  segmentoNomeFile,
  type Blocco,
  type DatiAmministratore,
  type DatiCondominio,
  type Documento,
} from "./modello";

export type UscitaRendiconto = {
  dataSpesa: string;
  categoria: string;
  descrizione: string;
  fornitore: string | null;
  importo: number;
};

export type QuotaRendiconto = {
  /** Identificativo dell'unità: è la chiave con cui si raggruppa. */
  unita: string;
  /** Anno di competenza della quota: scadenza se c'è, altrimenti data spesa. */
  dataCompetenza: string;
  importo: number;
  statoPagamento: string;
  dataPagamento: string | null;
};

/**
 * Solo stato e priorità: alla nota sintetica servono i CONTEGGI delle
 * questioni pendenti, non i titoli — che possono descrivere un guasto dentro
 * casa d'altri e non vanno letti da chi estrae copia del rendiconto.
 */
export type SegnalazioneRendiconto = {
  stato: StatoSegnalazione;
  priorita: PrioritaSegnalazione;
};

export type ManutenzioneRendiconto = {
  titolo: string;
  dataProssima: string;
  stato: string;
};

export type VoceCategoria = {
  categoria: string;
  totale: number;
  numero: number;
  /** Peso sul totale delle uscite dell'anno, in punti percentuali. */
  percentuale: number;
};

/** Una riga del registro di contabilità: o entra, o esce. */
export type MovimentoRegistro = {
  data: string;
  descrizione: string;
  /** Fornitore per le uscite, unità per gli incassi. */
  controparte: string;
  entrate: number;
  uscite: number;
};

export type SituazioneUnita = {
  identificativo: string;
  /** Posizione al 1° gennaio: positiva se l'unità era in arretrato. */
  saldoIniziale: number;
  /** Quote di competenza dell'anno addebitate all'unità. */
  addebitato: number;
  /** Quote effettivamente incassate dall'unità nell'anno (qualunque competenza). */
  versato: number;
  /** Posizione al 31 dicembre: positiva se l'unità deve ancora, negativa se ha anticipato. */
  saldoFinale: number;
};

export type SituazionePatrimoniale = {
  /** Cassa cumulata al 31/12: tutti gli incassi meno tutte le uscite registrate. */
  disponibilita: number;
  /** Quote addebitate entro il 31/12 e non ancora incassate a quella data. */
  creditiVersoCondomini: number;
  /** Quote di competenza di anni successivi già incassate al 31/12. */
  anticipiDaCondomini: number;
  totaleAttivita: number;
  totalePassivita: number;
  /** Attività meno passività rilevate: non è il risultato dell'anno. */
  saldoPatrimoniale: number;
};

export type QuestioniAperte = {
  /** Quote scadute entro il 31/12 e non versate a quella data. */
  quoteInsolute: number;
  importoInsoluto: number;
  unitaMorose: number;
  segnalazioniAperte: number;
  segnalazioniUrgenti: number;
  /** Manutenzioni con scadenza entro il 31/12 ancora non completate. */
  manutenzioniScadute: ManutenzioneRendiconto[];
  /** Manutenzioni programmate oltre il 31/12: sono i rapporti in corso. */
  manutenzioniFuture: number;
};

export type RiepilogoRendiconto = {
  anno: number;
  /** Uscite dell'anno raggruppate per categoria, dalla più pesante. */
  uscitePerCategoria: VoceCategoria[];
  totaleUscite: number;
  /** Quote incassate nell'anno, qualunque sia l'anno di competenza. */
  totaleEntrate: number;
  /** Entrate meno uscite del periodo: avanzo se positivo, disavanzo se negativo. */
  risultatoGestione: number;
  /** Movimenti dell'anno in ordine cronologico. */
  registro: MovimentoRegistro[];
  /** Situazione delle unità, in ordine naturale di identificativo. */
  unita: SituazioneUnita[];
  totaleSaldoIniziale: number;
  totaleAddebitato: number;
  totaleVersato: number;
  totaleSaldoFinale: number;
  patrimoniale: SituazionePatrimoniale;
  questioni: QuestioniAperte;
};

/**
 * Anno di una data ISO. Il fallback non è neutro e va scelto con la testa:
 *
 *  - competenza illeggibile -> 0, cioè "già scaduta da sempre". È la scelta
 *    prudente, la stessa dello stato patrimoniale: un dato incerto non deve far
 *    sembrare la posizione più leggera di quanto sia.
 *  - pagamento illeggibile su una quota risultata pagata -> 0, cioè "incassata
 *    prima". Così non gonfia la cassa di nessun anno, ma esce correttamente dai
 *    crediti: la quota è saldata, semplicemente non si sa quando.
 */
function annoDi(data: string | null, seIllegibile: number): number {
  if (!data) return seIllegibile;
  const anno = Number(data.slice(0, 4));
  return Number.isInteger(anno) && anno > 1900 ? anno : seIllegibile;
}

/** "aaaa-mm-gg" -> numero ordinabile, per il registro cronologico. */
function chiaveData(data: string | null): string {
  return (data ?? "").slice(0, 10);
}

function percentuale(parte: number, totale: number): number {
  if (!totale) return 0;
  return (parte / totale) * 100;
}

/** Estremi accettati per un anno di gestione: fuori da qui è un refuso. */
const ANNO_MINIMO = 1900;
const ANNO_MASSIMO = 2200;

/**
 * Anno del rendiconto chiesto da un parametro di URL.
 *
 * Vive qui, e non dentro le due route che scaricano il PDF, perché le route
 * sono due — amministratore e condòmino — e devono interpretare `?anno=` allo
 * stesso modo. `annoCorrente` arriva dal chiamante (che lo prende da
 * `oggiLocale()`, non dall'orologio del server, che il 1° gennaio direbbe
 * l'anno sbagliato) così la funzione resta pura e verificabile.
 */
export function annoRendiconto(parametro: string | null, annoCorrente: number): number {
  const richiesto = Number(parametro);
  return Number.isInteger(richiesto) && richiesto >= ANNO_MINIMO && richiesto <= ANNO_MASSIMO
    ? richiesto
    : annoCorrente;
}

/**
 * Anni selezionabili per il rendiconto, dal più recente.
 *
 * Sono gli anni in cui risulta almeno una spesa, più quello corrente — così il
 * prospetto è scaricabile anche a gennaio, quando ancora non c'è nulla.
 * Le date sono stringhe di calendario ("aaaa-mm-gg") e si leggono come tali:
 * passare da `new Date()` sposterebbe il 1° gennaio all'anno precedente a
 * seconda del fuso.
 */
export function anniRendiconto(dateSpesa: (string | null)[], annoCorrente: number): number[] {
  const anni = new Set<number>([annoCorrente]);
  for (const data of dateSpesa) {
    const anno = annoDi(data, 0);
    if (anno >= ANNO_MINIMO && anno <= ANNO_MASSIMO) anni.add(anno);
  }
  return [...anni].sort((a, b) => b - a);
}

export function riepilogaRendiconto(input: {
  anno: number;
  uscite: UscitaRendiconto[];
  quote: QuotaRendiconto[];
  segnalazioni?: SegnalazioneRendiconto[];
  manutenzioni?: ManutenzioneRendiconto[];
}): RiepilogoRendiconto {
  const { anno } = input;
  const fineAnno = `${anno}-12-31`;

  /* --- Uscite: cassa dell'anno e cassa cumulata ------------------------- */

  const perCategoria = new Map<string, Omit<VoceCategoria, "percentuale">>();
  const registro: MovimentoRegistro[] = [];
  let totaleUscite = 0;
  let usciteCumulate = 0;

  for (const uscita of input.uscite) {
    // Una spesa senza data leggibile pesa comunque sulla cassa cumulata: darla
    // per inesistente farebbe sembrare il condominio più liquido di quanto è.
    const annoSpesa = annoDi(uscita.dataSpesa, 0);
    if (annoSpesa <= anno) usciteCumulate += uscita.importo;
    if (annoSpesa !== anno) continue;

    const categoria = uscita.categoria?.trim() || "Senza categoria";
    const voce = perCategoria.get(categoria) ?? { categoria, totale: 0, numero: 0 };
    voce.totale += uscita.importo;
    voce.numero += 1;
    perCategoria.set(categoria, voce);
    totaleUscite += uscita.importo;

    registro.push({
      data: uscita.dataSpesa,
      descrizione: uscita.descrizione?.trim() || "Spesa",
      controparte: uscita.fornitore?.trim() || categoria,
      entrate: 0,
      uscite: uscita.importo,
    });
  }

  const uscitePerCategoria = [...perCategoria.values()]
    .map((v) => ({ ...v, percentuale: percentuale(v.totale, totaleUscite) }))
    .sort((a, b) => b.totale - a.totale || a.categoria.localeCompare(b.categoria, "it"));

  /* --- Quote: competenza per unità, cassa dell'anno, posizione al 31/12 -- */

  let totaleEntrate = 0;
  let incassiCumulati = 0;
  let creditiVersoCondomini = 0;
  let anticipiDaCondomini = 0;
  let quoteInsolute = 0;
  let importoInsoluto = 0;

  const perUnita = new Map<string, SituazioneUnita>();
  const unitaMorose = new Set<string>();
  // Gli incassi dello stesso giorno della stessa unità sono un versamento solo:
  // nel registro si legge come l'ha fatto il condòmino, non come lo ha spezzato
  // la ripartizione fra le spese.
  const incassiDelGiorno = new Map<string, MovimentoRegistro>();

  for (const quota of input.quote) {
    const identificativo = quota.unita?.trim() || "Unità non indicata";
    const riga =
      perUnita.get(identificativo) ??
      ({
        identificativo,
        saldoIniziale: 0,
        addebitato: 0,
        versato: 0,
        saldoFinale: 0,
      } satisfies SituazioneUnita);
    perUnita.set(identificativo, riga);

    const annoCompetenza = annoDi(quota.dataCompetenza, 0);
    const pagata = quota.statoPagamento === "pagato";
    const annoPagamento = pagata ? annoDi(quota.dataPagamento, 0) : null;

    // Posizione al 1° gennaio = addebitato fino al 31/12 dell'anno precedente
    // meno incassato entro la stessa data. Scritta così, e non come "arretrati",
    // tiene conto anche degli anticipi versati prima del periodo.
    if (annoCompetenza <= anno - 1) riga.saldoIniziale += quota.importo;
    if (annoPagamento !== null && annoPagamento <= anno - 1) riga.saldoIniziale -= quota.importo;

    if (annoCompetenza === anno) riga.addebitato += quota.importo;

    if (annoPagamento === anno) {
      riga.versato += quota.importo;
      totaleEntrate += quota.importo;

      const giorno = chiaveData(quota.dataPagamento);
      const chiave = `${giorno}|${identificativo}`;
      const movimento = incassiDelGiorno.get(chiave);
      if (movimento) movimento.entrate += quota.importo;
      else {
        const nuovo: MovimentoRegistro = {
          data: quota.dataPagamento ?? fineAnno,
          descrizione: "Versamento quote",
          controparte: identificativo,
          entrate: quota.importo,
          uscite: 0,
        };
        incassiDelGiorno.set(chiave, nuovo);
        registro.push(nuovo);
      }
    }

    // Fotografia al 31/12: cassa cumulata, crediti da un lato, anticipi dall'altro.
    const incassataEntroFineAnno = annoPagamento !== null && annoPagamento <= anno;
    if (incassataEntroFineAnno) incassiCumulati += quota.importo;

    if (annoCompetenza <= anno && !incassataEntroFineAnno) {
      creditiVersoCondomini += quota.importo;
      quoteInsolute += 1;
      importoInsoluto += quota.importo;
      unitaMorose.add(identificativo);
    }
    if (annoCompetenza > anno && incassataEntroFineAnno) {
      anticipiDaCondomini += quota.importo;
    }
  }

  const unita = [...perUnita.values()]
    .map((u) => ({ ...u, saldoFinale: u.saldoIniziale + u.addebitato - u.versato }))
    .sort((a, b) => a.identificativo.localeCompare(b.identificativo, "it", { numeric: true }));

  registro.sort(
    (a, b) =>
      chiaveData(a.data).localeCompare(chiaveData(b.data)) ||
      b.uscite - a.uscite ||
      a.controparte.localeCompare(b.controparte, "it", { numeric: true })
  );

  const somma = (prendi: (u: SituazioneUnita) => number) =>
    unita.reduce((totale, u) => totale + prendi(u), 0);

  const disponibilita = incassiCumulati - usciteCumulate;
  const totaleAttivita = disponibilita + creditiVersoCondomini;
  const totalePassivita = anticipiDaCondomini;

  /* --- Questioni pendenti, per la nota sintetica ------------------------ */

  const conteggi = contaSegnalazioni(input.segnalazioni ?? []);
  const programmate = (input.manutenzioni ?? []).filter((m) => m.stato === "programmata");

  const questioni: QuestioniAperte = {
    quoteInsolute,
    importoInsoluto,
    unitaMorose: unitaMorose.size,
    segnalazioniAperte: conteggi.aperte + conteggi.inCorso,
    segnalazioniUrgenti: conteggi.urgenti,
    manutenzioniScadute: programmate
      .filter((m) => chiaveData(m.dataProssima) <= fineAnno)
      .sort((a, b) => chiaveData(a.dataProssima).localeCompare(chiaveData(b.dataProssima))),
    manutenzioniFuture: programmate.filter((m) => chiaveData(m.dataProssima) > fineAnno).length,
  };

  return {
    anno,
    uscitePerCategoria,
    totaleUscite,
    totaleEntrate,
    risultatoGestione: totaleEntrate - totaleUscite,
    registro,
    unita,
    totaleSaldoIniziale: somma((u) => u.saldoIniziale),
    totaleAddebitato: somma((u) => u.addebitato),
    totaleVersato: somma((u) => u.versato),
    totaleSaldoFinale: somma((u) => u.saldoFinale),
    patrimoniale: {
      disponibilita,
      creditiVersoCondomini,
      anticipiDaCondomini,
      totaleAttivita,
      totalePassivita,
      saldoPatrimoniale: totaleAttivita - totalePassivita,
    },
    questioni,
  };
}

export type DatiRendiconto = {
  condominio: DatiCondominio;
  anno: number;
  uscite: UscitaRendiconto[];
  quote: QuotaRendiconto[];
  /** Segnalazioni del condominio: servono solo alla nota sintetica. */
  segnalazioni: SegnalazioneRendiconto[];
  /** Scadenzario delle manutenzioni: rapporti in corso e questioni pendenti. */
  manutenzioni: ManutenzioneRendiconto[];
  amministratore: DatiAmministratore;
  generatoIl: string;
};

const NON_RILEVATO = "non rilevato dal portale";

function formatPercentuale(valore: number): string {
  return `${valore.toFixed(1).replace(".", ",")}%`;
}

/**
 * Data breve, ma senza far saltare l'intero documento se il dato è sporco:
 * `Intl` solleva un errore sulle date non interpretabili, e un rendiconto non
 * deve fallire per una riga scritta male — si mostra il valore grezzo.
 */
function dataBreve(iso: string): string {
  return Number.isNaN(new Date(iso).getTime()) ? iso || "—" : formatData(iso);
}

/** Nome dell'amministratore, usato sia in testa che in calce al documento. */
function nomeAmministratore(amministratore: DatiAmministratore): string | null {
  if (!amministratore) return null;
  const nome = `${amministratore.nome} ${amministratore.cognome}`.trim();
  return nome || null;
}

export function costruisciRendiconto(dati: DatiRendiconto): Documento {
  const { condominio, anno, amministratore } = dati;
  const riepilogo = riepilogaRendiconto({
    anno,
    uscite: dati.uscite,
    quote: dati.quote,
    segnalazioni: dati.segnalazioni,
    manutenzioni: dati.manutenzioni,
  });
  const { patrimoniale, questioni } = riepilogo;
  const amministratoreNome = nomeAmministratore(amministratore);

  const blocchi: Blocco[] = [
    { tipo: "sottotitolo", testo: `Condominio ${condominio.nome}` },
    { tipo: "paragrafo", testo: condominio.indirizzo },
  ];

  if (condominio.codiceFiscale) {
    blocchi.push({ tipo: "paragrafo", testo: `Codice fiscale ${condominio.codiceFiscale}` });
  }

  blocchi.push(
    { tipo: "spazio" },
    { tipo: "titolo", testo: `Rendiconto della gestione ${anno}` },
    { tipo: "spazio" },
    {
      tipo: "campo",
      etichetta: "Periodo di gestione",
      valore: `1° gennaio ${anno} — 31 dicembre ${anno}`,
    }
  );

  // Richiesta esplicita: chi amministra si legge in testa al documento, non
  // solo nella riga di firma in fondo.
  if (amministratoreNome) {
    blocchi.push({ tipo: "campo", etichetta: "Amministratore", valore: amministratoreNome });
    if (amministratore?.email) {
      blocchi.push({ tipo: "campo", etichetta: "Recapito", valore: amministratore.email });
    }
  }

  blocchi.push(
    { tipo: "campo", etichetta: "Documento generato il", valore: formatDataOra(dati.generatoIl) },
    { tipo: "spazio" },
    {
      tipo: "paragrafo",
      testo:
        "Il rendiconto è redatto secondo la struttura dell'art. 1130-bis c.c.: registro di " +
        "contabilità, riepilogo finanziario e nota sintetica esplicativa della gestione, con " +
        "l'aggiunta dello stato di ripartizione fra le unità. Il registro è tenuto per cassa " +
        "(incassi e pagamenti effettivi), mentre il riepilogo finanziario espone crediti e " +
        "posizioni per competenza alla data di chiusura.",
    },

    /* 1. Riepilogo della gestione ---------------------------------------- */
    { tipo: "spazio" },
    { tipo: "sottotitolo", testo: "1. Riepilogo della gestione" },
    {
      tipo: "campo",
      etichetta: "Entrate incassate nell'anno",
      valore: formatValuta(riepilogo.totaleEntrate),
    },
    { tipo: "campo", etichetta: "Uscite dell'anno", valore: formatValuta(riepilogo.totaleUscite) },
    {
      tipo: "campo",
      etichetta:
        riepilogo.risultatoGestione >= 0 ? "Avanzo di gestione" : "Disavanzo di gestione",
      valore: formatValuta(riepilogo.risultatoGestione),
    },
    {
      tipo: "paragrafo",
      testo:
        "Le entrate contano i versamenti ricevuti nell'anno, anche quando riguardano quote di " +
        "anni precedenti: è la cassa, non la competenza. Il risultato del periodo non coincide " +
        "quindi con la situazione patrimoniale di fine anno, esposta al punto 5.",
    },

    /* 2. Uscite per categoria -------------------------------------------- */
    { tipo: "spazio" },
    { tipo: "sottotitolo", testo: "2. Uscite per categoria" }
  );

  if (riepilogo.uscitePerCategoria.length) {
    blocchi.push({
      tipo: "tabella",
      colonne: [
        { intestazione: "Categoria" },
        { intestazione: "N. spese", allineamento: "destra" },
        { intestazione: "Importo", allineamento: "destra" },
        { intestazione: "Peso", allineamento: "destra" },
      ],
      righe: riepilogo.uscitePerCategoria.map((v) => [
        v.categoria,
        String(v.numero),
        formatValuta(v.totale),
        formatPercentuale(v.percentuale),
      ]),
      totali: [
        "Totale uscite",
        String(riepilogo.uscitePerCategoria.reduce((s, v) => s + v.numero, 0)),
        formatValuta(riepilogo.totaleUscite),
        formatPercentuale(riepilogo.totaleUscite ? 100 : 0),
      ],
    });
  } else {
    blocchi.push({ tipo: "paragrafo", testo: `Nessuna spesa registrata nel ${anno}.` });
  }

  /* 3. Registro di contabilità ------------------------------------------ */
  blocchi.push(
    { tipo: "spazio" },
    { tipo: "sottotitolo", testo: "3. Registro di contabilità" },
    {
      tipo: "paragrafo",
      testo:
        "Movimenti dell'anno in ordine cronologico, come richiesto dall'art. 1130-bis, comma 1, " +
        "c.c. I versamenti ricevuti dalla stessa unità nello stesso giorno sono riportati in " +
        "un'unica riga.",
    }
  );

  if (riepilogo.registro.length) {
    blocchi.push({
      tipo: "tabella",
      colonne: [
        { intestazione: "Data" },
        { intestazione: "Movimento" },
        { intestazione: "Riferimento" },
        { intestazione: "Entrate", allineamento: "destra" },
        { intestazione: "Uscite", allineamento: "destra" },
      ],
      righe: riepilogo.registro.map((m) => [
        dataBreve(m.data),
        m.descrizione,
        m.controparte,
        m.entrate ? formatValuta(m.entrate) : "",
        m.uscite ? formatValuta(m.uscite) : "",
      ]),
      totali: [
        "Totali",
        "",
        "",
        formatValuta(riepilogo.totaleEntrate),
        formatValuta(riepilogo.totaleUscite),
      ],
    });
  } else {
    blocchi.push({
      tipo: "paragrafo",
      testo: `Nessun movimento risulta registrato nel ${anno}.`,
    });
  }

  /* 4. Stato di ripartizione -------------------------------------------- */
  blocchi.push(
    { tipo: "spazio" },
    { tipo: "sottotitolo", testo: "4. Stato di ripartizione — situazione delle unità" }
  );

  if (riepilogo.unita.length) {
    blocchi.push(
      {
        tipo: "tabella",
        colonne: [
          { intestazione: "Unità" },
          { intestazione: "Saldo al 1° gen.", allineamento: "destra" },
          { intestazione: `Addebitato ${anno}`, allineamento: "destra" },
          { intestazione: "Versato nell'anno", allineamento: "destra" },
          { intestazione: "Saldo al 31 dic.", allineamento: "destra" },
        ],
        righe: riepilogo.unita.map((u) => [
          u.identificativo,
          formatValuta(u.saldoIniziale),
          formatValuta(u.addebitato),
          formatValuta(u.versato),
          formatValuta(u.saldoFinale),
        ]),
        totali: [
          "Totali",
          formatValuta(riepilogo.totaleSaldoIniziale),
          formatValuta(riepilogo.totaleAddebitato),
          formatValuta(riepilogo.totaleVersato),
          formatValuta(riepilogo.totaleSaldoFinale),
        ],
      },
      {
        tipo: "paragrafo",
        testo:
          "Il saldo al 31 dicembre è il saldo al 1° gennaio più quanto addebitato nell'anno " +
          "meno quanto versato nell'anno. Un saldo positivo è un debito dell'unità verso il " +
          "condominio; un saldo negativo è un anticipo a suo credito.",
      }
    );
  } else {
    blocchi.push({
      tipo: "paragrafo",
      testo: `Nessuna quota risulta ripartita tra le unità per la gestione ${anno}.`,
    });
  }

  /* 5. Riepilogo finanziario -------------------------------------------- */
  blocchi.push(
    { tipo: "spazio" },
    { tipo: "sottotitolo", testo: `5. Riepilogo finanziario al 31 dicembre ${anno}` },
    {
      tipo: "paragrafo",
      testo:
        "È la fotografia patrimoniale alla chiusura del periodo, non il risultato dell'anno: " +
        "le disponibilità sono la cassa cumulata di tutta la gestione registrata nel portale e " +
        "i crediti comprendono ogni quota addebitata e non ancora versata a quella data, anche " +
        "se di competenza di anni precedenti.",
    },
    {
      tipo: "tabella",
      colonne: [{ intestazione: "Attività" }, { intestazione: "Importo", allineamento: "destra" }],
      righe: [
        ["Disponibilità di cassa (movimenti registrati)", formatValuta(patrimoniale.disponibilita)],
        ["Crediti verso i condòmini", formatValuta(patrimoniale.creditiVersoCondomini)],
      ],
      totali: ["Totale attività", formatValuta(patrimoniale.totaleAttivita)],
    },
    { tipo: "spazio" },
    {
      tipo: "tabella",
      colonne: [{ intestazione: "Passività" }, { intestazione: "Importo", allineamento: "destra" }],
      righe: [
        ["Anticipi ricevuti dai condòmini", formatValuta(patrimoniale.anticipiDaCondomini)],
        ["Debiti verso fornitori", NON_RILEVATO],
        ["Fondi e riserve deliberati (art. 1135 c.c.)", NON_RILEVATO],
      ],
      totali: ["Totale passività rilevate", formatValuta(patrimoniale.totalePassivita)],
    },
    {
      tipo: "campo",
      etichetta: "Attività meno passività rilevate",
      valore: formatValuta(patrimoniale.saldoPatrimoniale),
    },
    {
      tipo: "paragrafo",
      testo:
        "Le disponibilità di cassa sono la differenza fra quanto incassato e quanto speso " +
        "secondo i movimenti registrati nel portale: non sono il saldo del conto corrente " +
        "condominiale, che può includere giacenze anteriori all'uso del portale. Il portale non " +
        "tiene traccia delle fatture ricevute e non ancora pagate né dei fondi e delle riserve " +
        "deliberati dall'assemblea: quelle voci vanno integrate a mano prima di sottoporre il " +
        "rendiconto all'assemblea.",
    },

    /* 6. Nota sintetica esplicativa --------------------------------------- */
    { tipo: "spazio" },
    { tipo: "sottotitolo", testo: "6. Nota sintetica esplicativa della gestione" }
  );

  const voci: string[] = [];

  if (riepilogo.uscitePerCategoria.length) {
    const principale = riepilogo.uscitePerCategoria[0];
    voci.push(
      `Le uscite del ${anno} ammontano a ${formatValuta(riepilogo.totaleUscite)}; la voce più ` +
        `rilevante è «${principale.categoria}» con ${formatValuta(principale.totale)}, pari al ` +
        `${formatPercentuale(principale.percentuale)} del totale.`
    );
  } else {
    voci.push(`Nel ${anno} non risultano spese registrate nel portale.`);
  }

  voci.push(
    questioni.quoteInsolute
      ? `Al 31 dicembre ${anno} risultano ${questioni.quoteInsolute} ${
          questioni.quoteInsolute === 1 ? "quota non versata" : "quote non versate"
        } per complessivi ${formatValuta(questioni.importoInsoluto)}, a carico di ${
          questioni.unitaMorose
        } ${questioni.unitaMorose === 1 ? "unità" : "unità distinte"}.`
      : `Al 31 dicembre ${anno} non risultano quote scadute e non versate.`
  );

  if (patrimoniale.anticipiDaCondomini > 0) {
    voci.push(
      `Risultano inoltre ${formatValuta(patrimoniale.anticipiDaCondomini)} già versati a fronte ` +
        "di quote di competenza di esercizi successivi."
    );
  }

  if (questioni.manutenzioniScadute.length) {
    const elenco = questioni.manutenzioniScadute
      .map((m) => `${m.titolo} (${dataBreve(m.dataProssima)})`)
      .join("; ");
    voci.push(
      `Manutenzioni programmate entro la chiusura del periodo e non ancora risultate ` +
        `completate: ${elenco}.`
    );
  }

  if (questioni.manutenzioniFuture) {
    voci.push(
      `Sono in corso ${questioni.manutenzioniFuture} ${
        questioni.manutenzioniFuture === 1
          ? "manutenzione programmata con scadenza"
          : "manutenzioni programmate con scadenza"
      } successiva al 31 dicembre ${anno}.`
    );
  }

  if (questioni.segnalazioniAperte) {
    voci.push(
      `Alla data di generazione del documento risultano ${questioni.segnalazioniAperte} ` +
        `${questioni.segnalazioniAperte === 1 ? "segnalazione ancora aperta" : "segnalazioni ancora aperte"}` +
        `${questioni.segnalazioniUrgenti ? `, di cui ${questioni.segnalazioniUrgenti} a priorità alta` : ""}.`
    );
  }

  voci.push(
    "Il portale non registra il preventivo approvato dall'assemblea: il rendiconto non espone " +
      "quindi il confronto fra preventivo e consuntivo, che va aggiunto a parte."
  );

  blocchi.push({ tipo: "elenco", voci });

  /* Firma e avvertenza --------------------------------------------------- */
  if (amministratoreNome) {
    blocchi.push(
      { tipo: "spazio" },
      { tipo: "paragrafo", testo: `L'amministratore\n${amministratoreNome}` }
    );
  }

  blocchi.push(
    { tipo: "spazio" },
    {
      tipo: "nota",
      testo:
        `Documento generato automaticamente dal portale il ${formatDataOra(dati.generatoIl)}` +
        `${amministratoreNome ? ` da ${amministratoreNome}` : ""} sui movimenti registrati per ` +
        "questo condominio. Riproduce la struttura prevista dall'art. 1130-bis c.c. ma non " +
        "sostituisce il rendiconto da sottoporre all'assemblea ai sensi dell'art. 1130 n. 10 " +
        "c.c.: va riletto, integrato con i dati non tracciati nel portale e sottoscritto " +
        "dall'amministratore.",
    }
  );

  return {
    titolo: `Rendiconto ${anno} — ${condominio.nome}`,
    nomeFile: `rendiconto-${anno}-${segmentoNomeFile(condominio.nome)}`,
    blocchi,
  };
}
