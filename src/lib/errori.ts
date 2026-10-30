/**
 * Traduzione errore→messaggio per l'utente (COD-02).
 *
 * Prima di questo modulo il pattern `if (error) return { errore: error.message }`
 * si ripeteva in oltre ottanta punti: il testo che arrivava all'interfaccia era
 * quello di Postgres/PostgREST, con nomi di colonna, nomi di vincolo e a volte
 * frammenti di query. Era information disclosure gratuita (nel flusso pubblico
 * di firma del verbale verso chiunque) e, soprattutto, un messaggio inutile: un
 * condòmino non sa che fare con «violates foreign key constraint
 * ripartizioni_unita_id_fkey».
 *
 * Qui dentro c'è solo logica pura — nessuna query, nessun I/O — quindi è
 * testabile senza database e importabile anche da un componente client (la
 * pagina di reimpostazione password è l'unico punto in cui la traduzione
 * serve nel browser, perché i token di recupero vivono nel frammento dell'URL
 * e non arrivano mai al server).
 *
 * ## Come si usa
 *
 * ```ts
 * const { error } = await supabase.from("spese").insert({ ... });
 * if (error) return { errore: messaggioErrore(error, "spese/creaSpesa") };
 * ```
 *
 * `messaggioErrore` **logga sempre** l'errore originale prima di restituire il
 * messaggio tradotto (CLAUDE.md, punto 7 / COD-09): senza quel log il dettaglio
 * tecnico non sarebbe più visibile da nessuna parte e un fallimento ricorrente
 * diventerebbe impossibile da diagnosticare. Il `contesto` è l'etichetta del log
 * nella forma `area/azione`, coerente con i `console.error` già presenti nel
 * progetto (`[archivio] …`, `[limite-tentativi] …`).
 *
 * `traduciErrore`/`traduciErroreAuth` sono le funzioni pure corrispondenti,
 * senza log: esistono per i test e per i rari casi in cui l'errore è già stato
 * loggato altrove.
 *
 * ## Perché due tabelle di codici
 *
 * Gli errori che il portale incontra arrivano da tre posti diversi con tre
 * convenzioni diverse: Postgres via PostgREST (`code` = SQLSTATE di cinque
 * caratteri), Supabase Auth (`code` = stringa simbolica tipo
 * `invalid_credentials`) e Supabase Storage (nessun `code`, solo uno
 * `statusCode` HTTP). Un'unica tabella mescolerebbe cose non confrontabili:
 * `traduciErrore` copre database e storage, `traduciErroreAuth` copre
 * l'autenticazione, ed entrambe cadono sullo stesso messaggio generico.
 */

/**
 * Forma minima comune a `PostgrestError`, `AuthError`, `StorageError` e
 * `Error`. Non si importano i tipi di `@supabase/supabase-js` perché questo
 * modulo deve restare importabile da un componente client senza trascinarsi
 * dietro il client Supabase, e perché gli errori arrivano qui anche da un
 * `catch` (dove TypeScript li tipizza `unknown`).
 */
export type ErroreGrezzo = {
  message?: string | null;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  status?: number | null;
  statusCode?: string | number | null;
  name?: string | null;
};

/**
 * Il messaggio di riserva: dice che l'operazione non è andata a buon fine, che
 * si può riprovare e che c'è un modo di farsi sentire. Non promette una causa
 * che non conosciamo e non mostra quella che conosciamo.
 */
export const MESSAGGIO_GENERICO =
  "Operazione non riuscita. Riprova; se il problema persiste, contattaci.";

const SESSIONE_SCADUTA = "La sessione è scaduta: effettua di nuovo l'accesso.";
const NON_AUTORIZZATO = "Non hai i permessi per eseguire questa operazione.";
const TROPPE_RICHIESTE = "Troppe richieste in poco tempo: riprova tra qualche minuto.";

/**
 * SQLSTATE che i flussi di scrittura del portale incontrano davvero, letti
 * dai vincoli dichiarati in `supabase/schema.sql`:
 *
 * - `23505` unique: `unita(condominio_id, identificativo)`,
 *   `voti(punto_id, unita_id)`, `ripartizioni(spesa_id, unita_id)`,
 *   `presenze`, `deleghe`, `firme_verbale(assemblea_id, email)`,
 *   `sondaggio_risposte`, `preferenze_notifiche(utente_id, tipo_evento)`,
 *   `movimenti_bancari(condominio_id, import_hash)`, oltre al trigger di
 *   disponibilità degli spazi comuni che alza di proposito questo codice.
 * - `23503` foreign key: tutte le `on delete cascade/restrict` tra condominio,
 *   unità, spesa, assemblea e anagrafica — tipicamente quando due schede
 *   aperte lavorano sullo stesso dato e una lo ha già eliminato.
 * - `23514` check: i molti `check (x in (...))` su ruolo, stato, tipo,
 *   modalità, qualifica del soggetto, oltre a `millesimi >= 0`,
 *   `quota_possesso > 0 and <= 100`, `convocazione in (1, 2)`.
 * - `23502` not null: una colonna obbligatoria arrivata vuota.
 * - `22003` numeric out of range: i millesimi sono `numeric(6,3)` e gli importi
 *   `numeric(10,2)`, quindi un valore incollato da un foglio di calcolo può
 *   sforare il campo senza violare nessun check.
 * - `22P02` sintassi non valida: un id che non è un uuid, o un numero con la
 *   virgola arrivato dove il campo è numerico.
 * - `42501` RLS: la barriera vera del progetto. Qui diventa un messaggio sui
 *   permessi, non un errore di database.
 */
const MESSAGGI_POSTGRES: Record<string, string> = {
  "23505": "Questi dati risultano già registrati: esiste già una voce con gli stessi valori.",
  "23503":
    "Un dato collegato non esiste più: potrebbe essere stato eliminato nel frattempo. Ricarica la pagina e riprova.",
  "23502": "Manca un dato obbligatorio: controlla i campi e riprova.",
  "23514": "Uno dei valori inseriti non è ammesso: controlla i campi e riprova.",
  "22003": "Un numero inserito è troppo grande per questo campo: controllalo e riprova.",
  "22P02": "Uno dei valori inviati non ha un formato valido: ricarica la pagina e riprova.",
  "42501": NON_AUTORIZZATO,
  // Codici di PostgREST, non di Postgres: il primo è il `.single()` che non
  // trova (o trova più di) una riga, il secondo è il token scaduto.
  PGRST116: "Il dato cercato non esiste più: ricarica la pagina.",
  PGRST301: SESSIONE_SCADUTA,
};

/**
 * Codici di Supabase Auth. Sono stringhe simboliche, non SQLSTATE.
 *
 * `user_already_exists`/`email_exists` NON diventano «questa email è già
 * registrata»: sarebbe un modo per sapere chi ha un account sul portale, ed è
 * esattamente ciò che COD-05 ha evitato nel login e nel recupero password. Il
 * messaggio indica la via d'uscita (accedi, oppure recupera la password) senza
 * confermare né negare l'esistenza dell'account.
 */
const MESSAGGI_AUTH: Record<string, string> = {
  invalid_credentials: "Email o password non corrette.",
  email_not_confirmed: "Devi prima confermare l'indirizzo email: controlla la posta.",
  user_already_exists:
    "Non è stato possibile completare la registrazione con questi dati. Se hai già un account, accedi oppure usa «Password dimenticata».",
  email_exists:
    "Non è stato possibile completare la registrazione con questi dati. Se hai già un account, accedi oppure usa «Password dimenticata».",
  weak_password: "La password scelta è troppo debole: allungala o aggiungi numeri e simboli.",
  same_password: "La nuova password deve essere diversa da quella attuale.",
  email_address_invalid: "Indirizzo email non valido.",
  validation_failed: "Alcuni dati inseriti non sono validi: controllali e riprova.",
  captcha_failed: "Verifica anti-bot non riuscita. Ricarica la pagina e riprova.",
  over_email_send_rate_limit: TROPPE_RICHIESTE,
  over_request_rate_limit: TROPPE_RICHIESTE,
  session_expired: SESSIONE_SCADUTA,
  session_not_found: SESSIONE_SCADUTA,
  refresh_token_not_found: SESSIONE_SCADUTA,
  otp_expired: "Il codice o il link è scaduto: richiedine uno nuovo.",
};

/**
 * Lunghezza massima di un messaggio `raise exception` ripassato all'utente.
 * Oltre questa soglia non è più una frase scritta per essere letta: è un dump,
 * e va nel log come tutto il resto.
 */
const MAX_LUNGHEZZA_P0001 = 200;

function comeErrore(errore: unknown): ErroreGrezzo | null {
  if (!errore || typeof errore !== "object") return null;
  return errore as ErroreGrezzo;
}

/** Il codice dell'errore, quando c'è, normalizzato a stringa. */
export function codiceErrore(errore: unknown): string | null {
  const e = comeErrore(errore);
  if (!e?.code) return null;
  return String(e.code);
}

/**
 * Stato HTTP dell'errore. Lo Storage di Supabase non espone un `code` ma uno
 * `statusCode` (stringa), il resto del client usa `status` (numero).
 */
function statoHttp(errore: unknown): number | null {
  const e = comeErrore(errore);
  if (!e) return null;
  const grezzo = e.status ?? e.statusCode;
  if (grezzo == null) return null;
  const n = Number(grezzo);
  return Number.isFinite(n) ? n : null;
}

/**
 * Messaggio per l'utente a partire da un errore di database o di storage.
 * Funzione pura: non logga nulla — per quello c'è `messaggioErrore`.
 */
export function traduciErrore(errore: unknown): string {
  const codice = codiceErrore(errore);

  if (codice) {
    const noto = MESSAGGI_POSTGRES[codice];
    if (noto) return noto;

    /**
     * `P0001` è un `raise exception` scritto a mano nello schema di QUESTO
     * progetto: «Lo spazio risulta già prenotato in questa fascia oraria.»,
     * «La quota abbinata appartiene a un altro condominio.», «Solo un
     * amministratore può modificare il ruolo di un utente». Sono messaggi
     * applicativi in italiano, già pensati per essere letti da chi usa il
     * portale: nasconderli dietro al testo generico peggiorerebbe l'esperienza
     * invece di migliorarla, perché il messaggio generico non dice che cosa
     * fare. Non sono il caso che COD-02 denuncia (un testo generato da
     * Postgres sui propri interni), quindi passano — con un tetto di
     * lunghezza, perché un messaggio lungo non è una frase scritta per
     * l'utente.
     */
    if (codice === "P0001") {
      const testo = comeErrore(errore)?.message?.trim();
      if (testo && testo.length <= MAX_LUNGHEZZA_P0001) return testo;
    }
  }

  // Lo storage non manda codici: resta lo stato HTTP.
  const stato = statoHttp(errore);
  if (stato === 401 || stato === 403) return NON_AUTORIZZATO;
  if (stato === 409) return "Questi dati risultano già registrati: ricarica la pagina e riprova.";
  if (stato === 413) return "Il file è troppo grande per essere caricato.";
  if (stato === 429) return TROPPE_RICHIESTE;

  return MESSAGGIO_GENERICO;
}

/**
 * Messaggio per l'utente a partire da un errore di Supabase Auth.
 * Funzione pura: non logga nulla — per quello c'è `messaggioErroreAuth`.
 */
export function traduciErroreAuth(errore: unknown): string {
  const codice = codiceErrore(errore);
  if (codice) {
    const noto = MESSAGGI_AUTH[codice];
    if (noto) return noto;
  }

  const stato = statoHttp(errore);
  if (stato === 429) return TROPPE_RICHIESTE;
  if (stato === 401 || stato === 403) return SESSIONE_SCADUTA;

  return MESSAGGIO_GENERICO;
}

/**
 * Scrive nel log quello che all'utente non si mostra. Esportata perché serve
 * anche dove il messaggio tradotto non viene restituito (un invio
 * best-effort, una pulizia che può fallire senza conseguenze).
 */
export function registraErrore(contesto: string | undefined, errore: unknown): void {
  const e = comeErrore(errore);
  console.error(`[${contesto ?? "errore"}] operazione non riuscita`, {
    codice: e?.code ?? null,
    stato: e?.status ?? e?.statusCode ?? null,
    messaggio: e?.message ?? (typeof errore === "string" ? errore : null),
    dettagli: e?.details ?? null,
    suggerimento: e?.hint ?? null,
  });
}

/**
 * Logga l'errore originale e restituisce il messaggio da mostrare.
 * È la funzione da usare nelle server action al posto di `error.message`.
 */
export function messaggioErrore(errore: unknown, contesto?: string): string {
  registraErrore(contesto, errore);
  return traduciErrore(errore);
}

/** Come `messaggioErrore`, per gli errori di Supabase Auth. */
export function messaggioErroreAuth(errore: unknown, contesto?: string): string {
  registraErrore(contesto, errore);
  return traduciErroreAuth(errore);
}
