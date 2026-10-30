import "server-only";
import JSZip from "jszip";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { oggiLocale, oraLocale } from "@/lib/fuso";
import {
  aBlocchi,
  estensioneDa,
  nomeArchivio,
  nomeUnico,
  slug,
  testoLeggimi,
  versoCsv,
  type VoceCartella,
  type VoceTabella,
} from "@/lib/esportazione";

/**
 * Raccolta dei dati di UN condominio e confezionamento dello ZIP (CONT-02).
 *
 * DOVE STA E PERCHÉ. Accanto alla route che lo usa, come
 * `src/app/admin/assemblee/[id]/documenti-dati.ts`, e non in `src/lib`: qui
 * dentro c'è solo I/O (query e letture di storage), e la regola di `CLAUDE.md`
 * vuole che `src/lib/<feature>.ts` resti logica pura testabile senza database.
 * La parte pura (CSV, nomi di file, LEGGIMI) sta in `src/lib/esportazione.ts`
 * col suo `*.test.ts`. A differenza del rendiconto, questo modulo serve UN
 * solo ruolo — l'amministratore proprietario — quindi non c'è ragione di
 * metterlo in `src/lib/documenti/`.
 *
 * COME SI VERIFICA L'AUTORIZZAZIONE. Qui dentro NON si verifica: la verifica
 * sta nella route (`./esportazione/route.ts`), che accerta con una query vera
 * che `condomini.amministratore_id` sia l'utente in sessione PRIMA di chiamare
 * questa funzione. Il motivo per cui non è qui è che un controllo dentro la
 * raccolta dati arriverebbe dopo l'inizio della raccolta: su un'operazione che
 * legge tutto di tutti, l'ordine conta. Resta comunque la terza barriera: ogni
 * query passa dal client con la sessione dell'utente, quindi la RLS filtra
 * riga per riga, e lo stesso vale per lo storage (policy `documenti_select`,
 * che per i prefissi `condomini/`, `spese/`, `assemblee/` e `segnalazioni/`
 * risale sempre a `admin_possiede_condominio`).
 *
 * PERCHÉ UNA SELECT PER TABELLA E NON UNA JOIN SOLA. L'archivio deve essere
 * rileggibile da un altro programma: un CSV per tabella, con le chiavi
 * esterne lasciate come sono, si rimonta in qualunque strumento. Una join già
 * appiattita sarebbe più comoda da leggere a occhio ma perderebbe la
 * struttura — e con essa la possibilità di ricostruire l'archivio.
 *
 * PERCHÉ LE COLONNE SONO SCRITTE A MANO E NON `select("*")`. Due ragioni. La
 * prima: una tabella senza righe deve produrre un CSV con la sua intestazione,
 * e con `*` non si saprebbe quali colonne scrivere. La seconda: alcune colonne
 * NON devono finire nell'archivio (vedi `firme_verbale` più sotto), e un `*`
 * le porterebbe dentro al primo `alter table` che le aggiunge, senza che
 * nessuno se ne accorga.
 */

/** Numero massimo di righe che PostgREST restituisce in una volta. */
const PAGINA = 1000;

/** Quanti documenti si scaricano in parallelo dallo storage. */
const DOCUMENTI_IN_PARALLELO = 5;

type Riga = Record<string, unknown>;

export type Tabella = {
  /** Nome del file in `dati/`, senza estensione: di norma è il nome della tabella. */
  nome: string;
  /** Nome reale della tabella, quando è diverso dal nome del file. */
  tabellaDb?: string;
  /** A cosa corrisponde, per il LEGGIMI. */
  descrizione: string;
  colonne: readonly string[];
  /** Colonna di ordinamento, per avere due esportazioni confrontabili. */
  ordine: string;
};

/** Nome della tabella da interrogare per una voce dell'elenco. */
export function tabellaDi(t: Tabella): string {
  return t.tabellaDb ?? t.nome;
}

/**
 * Le tabelle esportate, con le colonne verificate su `supabase/schema.sql`.
 *
 * SCELTE DI CONTENUTO, perché non sono tutte ovvie:
 *
 * - `firme_verbale` entra, ma senza `token`, `otp_hash`, `otp_scadenza` e
 *   `otp_tentativi`: `token` è la credenziale che apre il link pubblico di
 *   firma (`/firma-verbale/[token]`) e `otp_hash` è l'impronta del codice.
 *   Metterli in un file che gira per email significherebbe esportare
 *   credenziali ancora valide. Di quella tabella interessa chi ha firmato e
 *   quando, e quello c'è tutto.
 * - `segnalazione_note` entra comprese le note interne, con la colonna
 *   `interna` in chiaro: sono annotazioni che l'amministratore ha scritto lui
 *   e che gli servono nel suo archivio; la colonna dice quali non erano
 *   visibili al condòmino, così chi rilegge l'archivio non le scambia per
 *   comunicazioni ufficiali.
 * - `movimenti_bancari` entra con `import_hash`: è l'impronta della riga del
 *   CSV della banca e rende riconoscibili i reimport, non è un segreto.
 * - `ripartizioni` entra con `codice_avviso` e `stripe_checkout_session_id`:
 *   il primo è il riferimento stampato sugli avvisi di pagamento (serve per
 *   riconciliare), il secondo è un identificativo di sessione già consumato,
 *   non una chiave.
 * - `utenti` NON entra come tabella a sé: le persone del condominio stanno in
 *   `anagrafiche`, che è il registro di anagrafe dell'art. 1130, n. 6, c.c.
 *   La tabella `utenti` contiene account di login di tutto il portale, anche
 *   di persone che non hanno nulla a che fare con questo condominio, e la RLS
 *   giustamente non la espone per intero. Dove serve, gli `utente_id` restano
 *   nelle colonne delle altre tabelle.
 * - `preferenze_notifiche` NON entra: è una preferenza personale di ciascun
 *   utente sul portale, non un dato del condominio, e non serve a ricostruire
 *   nessun registro.
 */
export const TABELLE_CONDOMINIO: readonly Tabella[] = [
  {
    // Il file si chiama "condominio" al singolare perché contiene una riga
    // sola: quella di QUESTO condominio, non la tabella `condomini` intera.
    nome: "condominio",
    tabellaDb: "condomini",
    descrizione: "Dati del condominio (anagrafici e conto corrente)",
    colonne: [
      "id",
      "nome",
      "indirizzo",
      "codice_fiscale",
      "iban",
      "banca",
      "intestatario_conto",
      "amministratore_id",
      "created_at",
    ],
    ordine: "id",
  },
  {
    nome: "unita",
    descrizione: "Unità immobiliari, millesimi generali e dati catastali",
    colonne: [
      "id",
      "condominio_id",
      "identificativo",
      "piano",
      "millesimi_proprieta",
      "catasto_foglio",
      "catasto_particella",
      "catasto_subalterno",
      "catasto_categoria",
      "created_at",
    ],
    ordine: "identificativo",
  },
  {
    nome: "anagrafiche",
    descrizione:
      "Registro di anagrafe: persone e società, codice fiscale, residenza o domicilio, recapiti",
    colonne: [
      "id",
      "condominio_id",
      "nominativo",
      "tipo",
      "codice_fiscale",
      "residenza_domicilio",
      "email",
      "telefono",
      "utente_id",
      "created_at",
    ],
    ordine: "nominativo",
  },
  {
    nome: "tabelle_millesimali",
    descrizione: "Tabelle millesimali del condominio (generali, ascensore, scale…)",
    colonne: ["id", "condominio_id", "nome", "created_at"],
    ordine: "nome",
  },
  {
    nome: "spese",
    descrizione: "Spese registrate",
    colonne: [
      "id",
      "condominio_id",
      "descrizione",
      "categoria",
      "data_spesa",
      "importo_totale",
      "fornitore",
      "documento_url",
      "created_at",
    ],
    ordine: "data_spesa",
  },
  {
    nome: "assemblee",
    descrizione: "Assemblee convocate e tenute",
    colonne: [
      "id",
      "condominio_id",
      "data_assemblea",
      "tipo",
      "stato",
      "convocazione",
      "luogo",
      "link_videoconferenza",
      "verbale_url",
      "created_at",
    ],
    ordine: "data_assemblea",
  },
  {
    nome: "solleciti",
    descrizione: "Solleciti di morosità inviati",
    colonne: [
      "id",
      "condominio_id",
      "unita_id",
      "livello",
      "importo_totale",
      "data_invio",
      "inviato_da",
      "note",
      "created_at",
    ],
    ordine: "data_invio",
  },
  {
    nome: "movimenti_bancari",
    descrizione: "Movimenti del conto corrente importati e loro abbinamento",
    colonne: [
      "id",
      "condominio_id",
      "data",
      "importo",
      "descrizione",
      "riferimento",
      "ripartizione_id",
      "stato",
      "import_hash",
      "created_at",
    ],
    ordine: "data",
  },
  {
    nome: "condizioni_sicurezza_parti_comuni",
    descrizione:
      "Condizioni di sicurezza delle parti comuni e degli impianti (art. 1130, n. 6, c.c.)",
    colonne: [
      "id",
      "condominio_id",
      "parte",
      "descrizione",
      "data_ultima_verifica",
      "documento_url",
      "created_at",
    ],
    ordine: "parte",
  },
  {
    nome: "fornitori",
    descrizione: "Fornitori e manutentori del condominio",
    colonne: [
      "id",
      "condominio_id",
      "nome",
      "categoria",
      "referente",
      "email",
      "telefono",
      "partita_iva",
      "note",
      "attivo",
      "created_at",
    ],
    ordine: "nome",
  },
  {
    nome: "manutenzioni_programmate",
    descrizione: "Manutenzioni programmate, periodicità e stato",
    colonne: [
      "id",
      "condominio_id",
      "fornitore_id",
      "spesa_id",
      "titolo",
      "descrizione",
      "data_prossima",
      "periodicita",
      "stato",
      "data_completamento",
      "costo_previsto",
      "created_at",
    ],
    ordine: "data_prossima",
  },
  {
    nome: "segnalazioni",
    descrizione: "Segnalazioni e guasti aperti dai condòmini o dall'amministratore",
    colonne: [
      "id",
      "condominio_id",
      "unita_id",
      "titolo",
      "descrizione",
      "categoria",
      "priorita",
      "stato",
      "fornitore_id",
      "aperta_da",
      "foto_url",
      "chiusa_il",
      "created_at",
      "aggiornata_il",
    ],
    ordine: "created_at",
  },
  {
    nome: "sondaggi",
    descrizione: "Sondaggi consultivi proposti al condominio",
    colonne: [
      "id",
      "condominio_id",
      "domanda",
      "descrizione",
      "scadenza",
      "ponderato",
      "stato",
      "creato_da",
      "created_at",
    ],
    ordine: "created_at",
  },
  {
    nome: "documenti_condominio",
    descrizione: "Indice dell'archivio documenti (i file sono in documenti/archivio/)",
    colonne: [
      "id",
      "condominio_id",
      "titolo",
      "descrizione",
      "categoria",
      "percorso",
      "nome_file",
      "dimensione_byte",
      "mime_type",
      "caricato_da",
      "created_at",
    ],
    ordine: "created_at",
  },
  {
    nome: "spazi_comuni",
    descrizione: "Spazi comuni prenotabili e loro orari",
    colonne: [
      "id",
      "condominio_id",
      "nome",
      "descrizione",
      "posti",
      "ora_apertura",
      "ora_chiusura",
      "durata_massima_ore",
      "attivo",
      "created_at",
    ],
    ordine: "nome",
  },
];

/** Tabelle figlie: si leggono per identificativo del padre, non per condominio. */
export const TABELLE_FIGLIE: readonly (Tabella & { colonnaPadre: string })[] = [
  {
    nome: "unita_proprietari",
    descrizione: "Legami unità ↔ persona: qualifica, quota, storico",
    colonnaPadre: "unita_id",
    colonne: [
      "id",
      "unita_id",
      "anagrafica_id",
      "utente_id",
      "tipo_soggetto",
      "quota_possesso",
      "diritto_voto",
      "attivo",
      "created_at",
    ],
    ordine: "unita_id",
  },
  {
    nome: "valori_millesimali",
    descrizione: "Millesimi di ogni unità in ogni tabella millesimale",
    colonnaPadre: "tabella_id",
    colonne: ["id", "tabella_id", "unita_id", "valore"],
    ordine: "tabella_id",
  },
  {
    nome: "ripartizioni",
    descrizione: "Riparto di ogni spesa tra le unità e stato di pagamento",
    colonnaPadre: "spesa_id",
    colonne: [
      "id",
      "spesa_id",
      "unita_id",
      "importo_dovuto",
      "stato_pagamento",
      "data_scadenza",
      "data_pagamento",
      "codice_avviso",
      "stripe_checkout_session_id",
    ],
    ordine: "spesa_id",
  },
  {
    nome: "punti_odg",
    descrizione: "Punti all'ordine del giorno, maggioranze richieste ed esiti",
    colonnaPadre: "assemblea_id",
    colonne: [
      "id",
      "assemblea_id",
      "numero_punto",
      "descrizione",
      "tipo_maggioranza",
      "stato_votazione",
      "esito",
      "esito_favorevole",
      "esito_contrario",
      "esito_astenuto",
      "esito_quorum_totale",
      "tally_favorevole",
      "tally_contrario",
      "tally_astenuto",
      "tally_n_favorevole",
      "tally_n_contrario",
      "tally_n_astenuto",
      "created_at",
    ],
    ordine: "assemblea_id",
  },
  {
    nome: "presenze",
    descrizione: "Presenze in assemblea e millesimi rappresentati",
    colonnaPadre: "assemblea_id",
    colonne: [
      "id",
      "assemblea_id",
      "unita_id",
      "utente_id",
      "modalita",
      "millesimi_rappresentati",
      "ora_ingresso",
      "ora_uscita",
      "registrata_da",
      "nota",
    ],
    ordine: "assemblea_id",
  },
  {
    nome: "deleghe",
    descrizione: "Deleghe conferite per ciascuna assemblea",
    colonnaPadre: "assemblea_id",
    colonne: [
      "id",
      "assemblea_id",
      "unita_delegante_id",
      "unita_delegataria_id",
      "utente_delegato_id",
      "created_at",
    ],
    ordine: "assemblea_id",
  },
  {
    // Senza token né impronta dell'OTP: vedi la nota su TABELLE_CONDOMINIO.
    nome: "firme_verbale",
    descrizione:
      "Conferme di lettura del verbale (nome, ruolo, data). Non è una firma elettronica con valore legale",
    colonnaPadre: "assemblea_id",
    colonne: [
      "id",
      "assemblea_id",
      "nominativo",
      "email",
      "ruolo",
      "richiesta_inviata_il",
      "confermato_il",
      "verbale_url_confermato",
      "created_at",
    ],
    ordine: "assemblea_id",
  },
  {
    nome: "segnalazione_note",
    descrizione: "Note sulle segnalazioni (la colonna «interna» segna quelle di servizio)",
    colonnaPadre: "segnalazione_id",
    colonne: ["id", "segnalazione_id", "autore_id", "testo", "interna", "created_at"],
    ordine: "segnalazione_id",
  },
  {
    nome: "sondaggio_opzioni",
    descrizione: "Opzioni di risposta dei sondaggi",
    colonnaPadre: "sondaggio_id",
    colonne: ["id", "sondaggio_id", "testo", "ordine"],
    ordine: "sondaggio_id",
  },
  {
    nome: "sondaggio_risposte",
    descrizione: "Risposte ai sondaggi, per unità",
    colonnaPadre: "sondaggio_id",
    colonne: [
      "id",
      "sondaggio_id",
      "opzione_id",
      "unita_id",
      "utente_id",
      "millesimi_rappresentati",
      "created_at",
    ],
    ordine: "sondaggio_id",
  },
  {
    nome: "prenotazioni_spazi",
    descrizione: "Prenotazioni degli spazi comuni",
    colonnaPadre: "spazio_id",
    colonne: ["id", "spazio_id", "unita_id", "utente_id", "inizio", "fine", "note", "stato", "created_at"],
    ordine: "inizio",
  },
  {
    // L'art. 1136 c.c. non ammette voto anonimo: il verbale deve poter dar
    // conto dei dissenzienti, quindi l'archivio riporta chi ha votato che
    // cosa. Si legge per unità e non per punto: `voti` ha una chiave esterna
    // diretta a `unita`, e passare dalle unità del condominio è una catena
    // più corta (e un filtro più stretto) che passare dai punti dell'odg.
    nome: "voti",
    descrizione: "Voti espressi punto per punto (non anonimi, art. 1136 c.c.)",
    colonnaPadre: "unita_id",
    colonne: [
      "id",
      "punto_id",
      "unita_id",
      "utente_id",
      "scelta",
      "millesimi_rappresentati",
      "data_voto",
    ],
    ordine: "punto_id",
  },
];

/** Documento dello storage da infilare nell'archivio. */
type Documento = {
  /** Percorso nel bucket `documenti-condominio`. */
  percorso: string;
  /** Sottocartella leggibile dentro `documenti/`. */
  cartella: string;
  /** Nome del file dentro la sottocartella, estensione compresa. */
  nome: string;
};

const DESCRIZIONE_CARTELLA: Record<string, string> = {
  archivio: "Archivio documenti del condominio (regolamento, polizze, planimetrie…)",
  spese: "Fatture e giustificativi allegati alle spese",
  assemblee: "Verbali caricati o generati per le assemblee",
  segnalazioni: "Foto allegate alle segnalazioni",
};

export type EsportazioneCondominio = {
  /** Nome proposto al browser per il file .zip. */
  nomeFile: string;
  contenuto: Uint8Array;
};

/**
 * Legge una tabella per intero, pagina per pagina.
 *
 * La paginazione non è un'ottimizzazione: PostgREST tronca a 1000 righe senza
 * dirlo, e `ripartizioni` supera quella soglia già con cinquanta unità e venti
 * spese. Un archivio troncato in silenzio è il modo peggiore in cui questa
 * funzione potrebbe fallire.
 */
/** Come restringere la lettura: un valore solo, oppure un elenco. */
type Filtro =
  | { tipo: "eq"; colonna: string; valore: string }
  | { tipo: "in"; colonna: string; valori: readonly string[] };

async function leggiTutto(
  supabase: SupabaseClient,
  tabella: string,
  colonne: readonly string[],
  ordine: string,
  filtro: Filtro
): Promise<Riga[]> {
  const righe: Riga[] = [];
  for (let da = 0; ; da += PAGINA) {
    let query = supabase.from(tabella).select(colonne.join(", "));
    query =
      filtro.tipo === "eq"
        ? query.eq(filtro.colonna, filtro.valore)
        : query.in(filtro.colonna, filtro.valori as string[]);

    // Secondo ordinamento su `id` per avere un ordine totale: senza, due
    // pagine consecutive possono ripetere o perdere una riga quando la
    // colonna di ordinamento ha valori uguali.
    let ordinata = query.order(ordine, { ascending: true });
    if (ordine !== "id") ordinata = ordinata.order("id", { ascending: true });

    const { data, error } = await ordinata.range(da, da + PAGINA - 1);

    if (error) {
      // Mai un `error.message` all'utente (COD-02): il dettaglio si logga, la
      // route risponde con un messaggio applicativo.
      console.error("Esportazione: lettura tabella fallita", { tabella, da, error });
      throw new Error(`Lettura di "${tabella}" non riuscita.`);
    }

    const pagina = (data ?? []) as unknown as Riga[];
    righe.push(...pagina);
    if (pagina.length < PAGINA) return righe;
  }
}

/** Tabella con `condominio_id`: un filtro e via. */
function leggiPerCondominio(
  supabase: SupabaseClient,
  tabella: Tabella,
  condominioId: string
): Promise<Riga[]> {
  return leggiTutto(supabase, tabellaDi(tabella), tabella.colonne, tabella.ordine, {
    tipo: "eq",
    colonna: "condominio_id",
    valore: condominioId,
  });
}

/**
 * Tabella figlia: si legge per identificativi del padre, a blocchi.
 *
 * Gli identificativi arrivano da una lettura già filtrata per condominio,
 * quindi il filtro è stretto quanto quello del padre. A blocchi perché un
 * `in.(…)` con mille UUID produrrebbe un URL che PostgREST rifiuta.
 */
async function leggiPerPadre(
  supabase: SupabaseClient,
  tabella: Tabella & { colonnaPadre: string },
  idsPadre: readonly string[]
): Promise<Riga[]> {
  if (idsPadre.length === 0) return [];
  const righe: Riga[] = [];
  for (const blocco of aBlocchi(idsPadre)) {
    righe.push(
      ...(await leggiTutto(supabase, tabellaDi(tabella), tabella.colonne, tabella.ordine, {
        tipo: "in",
        colonna: tabella.colonnaPadre,
        valori: blocco,
      }))
    );
  }
  return righe;
}

/** Gli `id` di un elenco di righe, come stringhe. */
function identificativi(righe: readonly Riga[]): string[] {
  return righe.map((r) => String(r.id)).filter((id) => id && id !== "undefined");
}

/**
 * Esportazione completa di un condominio in un archivio ZIP.
 *
 * Restituisce `null` se il condominio non è leggibile con la sessione
 * corrente: non è il caso d'uso previsto (la route verifica la proprietà
 * prima), ma se succede si risponde 404 e non si prosegue.
 */
export async function esportaCondominio(
  condominioId: string,
  richiedente: { nome: string; cognome: string; email: string } | null
): Promise<EsportazioneCondominio | null> {
  const supabase = await createClient();

  const { data: condominio } = await supabase
    .from("condomini")
    .select("id, nome, indirizzo, codice_fiscale")
    .eq("id", condominioId)
    .maybeSingle();

  if (!condominio) return null;

  // --- 1) Tabelle con condominio_id --------------------------------------
  const lette = new Map<string, Riga[]>();
  const perCondominio = TABELLE_CONDOMINIO.filter((t) => t.nome !== "condominio");

  const risultati = await Promise.all(
    perCondominio.map((t) => leggiPerCondominio(supabase, t, condominioId))
  );
  perCondominio.forEach((t, i) => lette.set(t.nome, risultati[i]));

  // Il condominio stesso: una riga sola, già in mano, riletta con tutte le
  // colonne dichiarate (il `select` sopra ne prende solo quattro).
  const tabellaCondominio = TABELLE_CONDOMINIO.find((t) => t.nome === "condominio")!;
  lette.set(
    "condominio",
    await leggiTutto(
      supabase,
      tabellaDi(tabellaCondominio),
      tabellaCondominio.colonne,
      tabellaCondominio.ordine,
      { tipo: "eq", colonna: "id", valore: condominioId }
    )
  );

  // --- 2) Tabelle figlie --------------------------------------------------
  const idsPadre: Record<string, string[]> = {
    unita_id: identificativi(lette.get("unita") ?? []),
    tabella_id: identificativi(lette.get("tabelle_millesimali") ?? []),
    spesa_id: identificativi(lette.get("spese") ?? []),
    assemblea_id: identificativi(lette.get("assemblee") ?? []),
    segnalazione_id: identificativi(lette.get("segnalazioni") ?? []),
    sondaggio_id: identificativi(lette.get("sondaggi") ?? []),
    spazio_id: identificativi(lette.get("spazi_comuni") ?? []),
  };

  const figlie = await Promise.all(
    TABELLE_FIGLIE.map((t) => leggiPerPadre(supabase, t, idsPadre[t.colonnaPadre] ?? []))
  );
  TABELLE_FIGLIE.forEach((t, i) => lette.set(t.nome, figlie[i]));

  // --- 3) Documenti da scaricare ------------------------------------------
  const documenti: Documento[] = [];
  const nomiUsati = new Map<string, Set<string>>();

  function aggiungi(cartella: string, percorso: unknown, nomeProposto: string) {
    if (typeof percorso !== "string" || percorso.trim() === "") return;
    // I percorsi dei documenti di archivio e degli allegati sono relativi al
    // bucket. Un `documento_url` che è un indirizzo web (succede sulle
    // condizioni di sicurezza, dove il campo è un link) non è un file nello
    // storage: va lasciato nel CSV e non scaricato.
    if (/^https?:\/\//i.test(percorso)) return;
    const usati = nomiUsati.get(cartella) ?? new Set<string>();
    nomiUsati.set(cartella, usati);
    documenti.push({ percorso, cartella, nome: nomeUnico(nomeProposto, usati) });
  }

  for (const d of lette.get("documenti_condominio") ?? []) {
    const nomeFile = typeof d.nome_file === "string" ? d.nome_file : "documento";
    const punto = nomeFile.lastIndexOf(".");
    const radice = punto > 0 ? nomeFile.slice(0, punto) : nomeFile;
    aggiungi("archivio", d.percorso, `${slug(radice)}.${estensioneDa(nomeFile)}`);
  }

  for (const s of lette.get("spese") ?? []) {
    const data = String(s.data_spesa ?? "").slice(0, 10);
    const nome = `${data}-${slug(String(s.descrizione ?? "spesa"), 50)}`;
    aggiungi("spese", s.documento_url, `${nome}.${estensioneDa(String(s.documento_url ?? ""))}`);
  }

  for (const a of lette.get("assemblee") ?? []) {
    const data = String(a.data_assemblea ?? "").slice(0, 10);
    const nome = `${data}-verbale-${slug(String(a.tipo ?? "assemblea"), 20)}`;
    aggiungi("assemblee", a.verbale_url, `${nome}.${estensioneDa(String(a.verbale_url ?? ""))}`);
  }

  for (const s of lette.get("segnalazioni") ?? []) {
    const data = String(s.created_at ?? "").slice(0, 10);
    const nome = `${data}-${slug(String(s.titolo ?? "segnalazione"), 50)}`;
    aggiungi("segnalazioni", s.foto_url, `${nome}.${estensioneDa(String(s.foto_url ?? ""))}`);
  }

  const zip = new JSZip();

  // Un documento già compresso (PDF, JPEG) non guadagna nulla a passare dal
  // deflate e costa CPU in una Vercel Function: si archivia senza comprimere.
  // I CSV, al contrario, si riducono di molto.
  const mancanti: string[] = [];
  let scaricati = 0;

  for (const blocco of aBlocchi(documenti, DOCUMENTI_IN_PARALLELO)) {
    const esiti = await Promise.all(
      blocco.map(async (doc) => {
        const { data, error } = await supabase.storage
          .from("documenti-condominio")
          .download(doc.percorso);
        if (error || !data) {
          // Non si interrompe l'esportazione per un file illeggibile: il resto
          // dell'archivio serve comunque, e il LEGGIMI dirà quali file
          // mancano. Interrompere qui lascerebbe l'amministratore senza nulla.
          console.error("Esportazione: documento non scaricato", {
            condominioId,
            percorso: doc.percorso,
            error,
          });
          return { doc, contenuto: null };
        }
        return { doc, contenuto: new Uint8Array(await data.arrayBuffer()) };
      })
    );

    for (const esito of esiti) {
      if (!esito.contenuto) {
        mancanti.push(esito.doc.percorso);
        continue;
      }
      zip.file(`documenti/${esito.doc.cartella}/${esito.doc.nome}`, esito.contenuto, {
        compression: "STORE",
      });
      scaricati += 1;
    }
  }

  // --- 4) CSV --------------------------------------------------------------
  const vociTabella: VoceTabella[] = [];
  for (const t of [...TABELLE_CONDOMINIO, ...TABELLE_FIGLIE]) {
    const righe = lette.get(t.nome) ?? [];
    zip.file(`dati/${t.nome}.csv`, versoCsv(t.colonne, righe), {
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
    vociTabella.push({ nome: t.nome, descrizione: t.descrizione, righe: righe.length });
  }

  // --- 5) LEGGIMI ---------------------------------------------------------
  const perCartella = new Map<string, number>();
  for (const doc of documenti) {
    if (mancanti.includes(doc.percorso)) continue;
    perCartella.set(doc.cartella, (perCartella.get(doc.cartella) ?? 0) + 1);
  }
  const vociCartella: VoceCartella[] = [...perCartella.entries()].map(([cartella, file]) => ({
    cartella,
    descrizione: DESCRIZIONE_CARTELLA[cartella] ?? "Documenti",
    file,
  }));

  const data = oggiLocale();
  zip.file(
    "LEGGIMI.txt",
    testoLeggimi({
      condominio: {
        nome: condominio.nome as string,
        indirizzo: condominio.indirizzo as string,
        codiceFiscale: (condominio.codice_fiscale as string | null) ?? null,
      },
      amministratore: richiedente,
      data,
      ora: oraLocale(),
      tabelle: vociTabella,
      cartelle: vociCartella,
      documentiMancanti: mancanti,
    }),
    { compression: "DEFLATE", compressionOptions: { level: 6 } }
  );

  const contenuto = await zip.generateAsync({ type: "uint8array" });

  console.info("Esportazione condominio completata", {
    condominioId,
    tabelle: vociTabella.length,
    righe: vociTabella.reduce((somma, t) => somma + t.righe, 0),
    documenti: scaricati,
    documentiMancanti: mancanti.length,
    byte: contenuto.byteLength,
  });

  return {
    nomeFile: nomeArchivio(condominio.nome as string, data),
    contenuto,
  };
}
