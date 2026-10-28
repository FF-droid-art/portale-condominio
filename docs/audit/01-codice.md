# Fase 1 — Codice e architettura

> Metodologia: ogni rilievo è stato verificato leggendo il file citato (non
> inferito dal nome). Per i pattern ripetitivi (server action, pagine admin
> con lo stesso schema fetch→form) ho **campionato** un sottoinsieme
> rappresentativo invece di leggere ogni singolo file — indicato esplicitamente
> dove rilevante — per rispettare il vincolo di budget della sessione. Nessun
> file del progetto è stato modificato: output solo in `docs/audit/01-codice.md`.
>
> Gravità: **bloccante** / **alta** / **media** / **bassa**.

---

## Cose fatte bene (verificate, da non toccare in Fase successive senza motivo)

Prima dei rilievi, alcuni punti che il codice fa correttamente e che vale la
pena segnalare esplicitamente, come richiesto:

1. **Separazione logica pura / data access è reale e costante.** Ogni feature
   ha un modulo in `src/lib/*` con sole funzioni pure (testate) e lascia l'I/O
   (query Supabase, invio email, generazione file) ad actions/route handler.
   Esempi verificati: `src/lib/quorum.ts`, `src/lib/solleciti.ts`,
   `src/lib/riconciliazione.ts`, `src/lib/firma-otp.ts`,
   `src/lib/documenti/modello.ts` + `pdf.ts`. Questo è esattamente il
   confine che rende testabile la logica senza un database.
2. **Nessun `any`, nessun `@ts-ignore`/`@ts-expect-error` in tutto `src/`**
   (verificato con ricerca esaustiva). `strict: true` in `tsconfig.json`.
3. **Nessuna superficie di SQL injection identificata.** Tutto l'accesso dati
   passa per il query builder parametrico di `@supabase/supabase-js`
   (`.eq()`, `.insert()`, `.update()`, `.select()`) o per funzioni `plpgsql`
   con parametri tipizzati; in `supabase/schema.sql` non esiste un solo
   `execute format(...)` o concatenazione di stringhe in SQL dinamico
   (verificato con ricerca su tutto il file, 3105 righe).
4. **Nessun `dangerouslySetInnerHTML`** in tutto `src/`. Il rendering Markdown
   passa da `react-markdown` (`src/components/documento-legale.tsx`), non da
   HTML iniettato. Nel flusso OTP (`src/app/firma-verbale/[token]/actions.ts`,
   funzione `escapeHtml`) il testo libero inserito nell'email HTML viene
   escapato a mano prima dell'interpolazione.
5. **Gestione del fuso orario centralizzata e corretta**: `src/lib/fuso.ts`
   usa `Intl.DateTimeFormat` con `timeZone: "Europe/Rome"` per ogni nozione di
   "oggi"/"ora", invece di `new Date().getHours()` (che su un server UTC come
   Vercel sfaserebbe di 1-2 ore e talvolta di un giorno intero). Lo stesso
   principio (date come stringhe di calendario, mai ricostruite da `Date`)
   è applicato in modo coerente in `manutenzioni.ts`, `solleciti.ts`,
   `prenotazioni.ts`, `calendario.ts`. È una classe di bug molto comune nei
   software gestionali italiani ed è stata evitata sistematicamente.
6. **Pattern N+1 non trovato nei punti campionati.** Le pagine elenco lette
   per intero (`src/app/admin/spese/page.tsx`, `src/app/admin/condomini/page.tsx`)
   fanno un numero fisso di query in `Promise.all` e aggregano in memoria con
   `Map`, invece di interrogare per ogni riga. Nessun `for…await` o
   `.map(async …)` su query Supabase trovato in una ricerca su tutto `src/`.
   Campione: 2 pagine elenco lette per intero + ricerca pattern su tutto il
   repo; non è un controllo esaustivo di ogni pagina.
7. **Upload file con controlli reali**: limite di dimensione lato server
   (`DOCUMENTO_MAX_BYTES`, verificato in `src/app/admin/documenti/actions.ts`
   righe 47-49), sanificazione del nome file contro path traversal
   (`nomeSicuro`, righe 17-23), e pulizia del file orfano se l'insert della
   riga fallisce (righe 82-85).
8. **Flusso di conferma OTP del verbale ben progettato**
   (`src/lib/firma-otp.ts`, `src/app/firma-verbale/[token]/actions.ts`):
   hash SHA-256 del codice con `timingSafeEqual` (mai il codice in chiaro a
   DB), throttle di 60s tra due invii, contatore tentativi con lockout a 5,
   mascheramento dell'email nei messaggi (`mascheraEmail`), consumo del
   codice dopo l'uso. Il disclaimer "non è firma elettronica con valore
   legale" è esplicito sia nel codice che nell'interfaccia.
9. **Scelte di libreria motivate e documentate nel codice stesso**: `pdf-lib`
   invece di Puppeteer/Chromium per compatibilità serverless
   (`src/lib/documenti/pdf.ts`), ed esclusione deliberata della libreria
   `xlsx` (SheetJS) per CVE note di prototype pollution/ReDoS a favore di
   `exceljs` (`src/lib/import/analizza-file.ts`, righe 9-12).
10. **Error boundary a tre livelli coerenti** (`src/app/error.tsx`,
    `src/app/admin/error.tsx`, `src/app/area-riservata/error.tsx`), ognuno
    con messaggio contestuale in italiano e via di ritorno sensata.

---

## Rilievi

### COD-01 — Il modulo con la service-role key non ha il guardrail `server-only`
- **Gravità**: alta
- **File**: `src/lib/supabase/service.ts` (tutto il file, 12 righe)
- **Descrizione**: `createServiceClient()` costruisce un client Supabase con
  `SUPABASE_SERVICE_ROLE_KEY`, che bypassa interamente la RLS (commento nel
  file stesso: "Da usare SOLO in contesti senza sessione utente"). Altri
  moduli server-only del progetto (`src/lib/supabase/dal.ts` riga 1,
  `src/lib/documenti/pdf.ts` riga 1, `src/lib/notifiche-invio.ts` riga 1)
  importano il marcatore `"server-only"`, che fa fallire la build se il
  modulo finisce per errore nel bundle di un Client Component. `service.ts`
  non lo fa. Verificato oggi nessun import da un file `"use client"`
  (ricerca su tutto `src/`), quindi non c'è un incidente in corso — ma è
  proprio il file più sensibile del progetto a non avere la stessa rete di
  sicurezza che il progetto applica altrove.
- **Impatto concreto**: se in un refactor futuro qualcuno importasse per
  errore `createServiceClient` in un componente client (anche indirettamente,
  tramite un modulo condiviso), la chiave service-role finirebbe nel bundle
  JS inviato al browser — compromissione totale della RLS e di tutti i
  condomìni, non solo di uno. Oggi il rischio è "solo" l'assenza del
  guardrail, non un'esposizione reale.
- **Rimedio**:
  ```ts
  import "server-only";
  import { createClient } from "@supabase/supabase-js";
  // ...resto invariato
  ```
- **Riferimento**: pratica già applicata nel resto del progetto (coerenza
  interna); raccomandazione standard Next.js per moduli con segreti
  (pacchetto `server-only`, documentato in `node_modules/next/dist/docs/`
  secondo le convenzioni di questa versione).

### COD-02 — Messaggi di errore grezzi del database esposti all'utente finale
- **Gravità**: media
- **File**: pattern ripetuto in 85 punti su ~30 file (conteggio esaustivo via
  ricerca testuale); campione letto per intero: `src/app/admin/spese/actions.ts`
  riga 41, `src/app/admin/documenti/actions.ts` righe 68/84/115/137,
  `src/app/firma-verbale/[token]/actions.ts` righe 112/149 (quest'ultimo file
  è **pubblico, senza login**)
- **Descrizione**: il pattern costante è
  `if (error) return { errore: error.message };`, dove `error.message`
  arriva direttamente da PostgREST/Postgres (es. violazione di un vincolo
  `check`, errore di foreign key, messaggio della policy RLS) e viene
  mostrato tal quale nell'interfaccia.
- **Impatto concreto**: espone dettagli interni (nomi di colonne, nomi di
  vincoli, a volte frammenti della query) a chiunque possa invocare la
  server action — incluso un visitatore non autenticato nel flusso pubblico
  `firma-verbale`. Non è un bug che permette un attacco diretto, ma è
  information disclosure che facilita la ricognizione di uno schema altrimenti
  non visibile dal client, ed è un'esperienza utente scadente (un condòmino
  non deve leggere "violates foreign key constraint...").
- **Rimedio**: centralizzare la traduzione errore→messaggio in una funzione
  condivisa che riconosce i codici Postgres noti (es. `23505` unique
  violation, `23514` check violation, `42501` RLS) e restituisce un testo
  italiano generico per tutto il resto, loggando internamente il messaggio
  originale (vedi anche COD-10 sull'assenza di logging):
  ```ts
  // src/lib/errori-db.ts
  export function messaggioErroreUtente(error: { code?: string; message: string }): string {
    if (error.code === "23505") return "Esiste già un elemento con questi dati.";
    if (error.code === "23514") return "Uno dei valori inseriti non è valido.";
    // logga error.message internamente (Sentry/log strutturato), non mostrarlo
    return "Operazione non riuscita. Riprova o contatta l'assistenza.";
  }
  ```
- **Riferimento**: OWASP ASVS 7.4 (gestione degli errori: non esporre dettagli
  interni all'utente).

### COD-03 — Nessun tipo `Database` generato per Supabase: le query non sono verificate dal compilatore
- **Gravità**: media
- **File**: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`,
  `src/lib/supabase/service.ts` (nessuno passa un generic `Database` a
  `createBrowserClient`/`createServerClient`/`createClient`); conseguenza
  visibile in 68 occorrenze di `as unknown as <Tipo>` sparse su 30 file,
  campione: `src/app/area-riservata/actions.ts` righe 30-31,
  `src/app/area-riservata/segnalazioni/page.tsx` righe 56/72
- **Descrizione**: senza il tipo generato dallo schema (`supabase gen types
  typescript`), ogni `.select()` con join annidati (es.
  `"id, importo_dovuto, spesa:spesa_id(descrizione)"`) restituisce un tipo
  che TypeScript non può legare alla stringa di select: il progetto
  compensa scrivendo a mano l'interfaccia del risultato e forzando con
  `as unknown as`. Il compilatore non verifica più che i nomi di colonna
  nella stringa `.select()` corrispondano ai campi del tipo scritto a mano.
- **Impatto concreto**: una rinomina di colonna nello schema, o un typo nella
  stringa di `.select()`, compila senza errori e fallisce solo a runtime
  (campo `undefined` dove si aspettava un valore) — esattamente il tipo di
  bug che TypeScript dovrebbe prevenire. È un problema di manutenibilità più
  che una vulnerabilità.
- **Rimedio**: generare `src/lib/supabase/database.types.ts` con la CLI
  Supabase (`supabase gen types typescript --project-id … > src/lib/supabase/database.types.ts`,
  da integrare come script `npm run db:types` e idealmente in CI quando ce ne
  sarà una, vedi Fase 5) e passarlo come generic:
  ```ts
  import type { Database } from "./database.types";
  export function createClient() {
    return createBrowserClient<Database>(/* ... */);
  }
  ```
  Questo non elimina da solo tutti i cast (i join annidati restano un punto
  debole noto di PostgREST/Supabase-js), ma riduce drasticamente la
  superficie non verificata e rende i cast residui un'eccezione invece della
  norma.
- **Riferimento**: pratica raccomandata nella documentazione Supabase/`@supabase/ssr`.

### COD-04 — Incoerenza nei controlli applicativi di ruolo prima della scrittura
- **Gravità**: bassa
- **File**: confronto tra `src/app/admin/spese/actions.ts` (nessuna chiamata
  a `richiedeAmministratore()`/`richiedeUtente()` prima dell'`insert`) e
  `src/app/admin/documenti/actions.ts` riga 59 / `src/app/admin/utenti/actions.ts`
  (chiamano `richiedeAmministratore()` esplicitamente)
- **Descrizione**: alcune server action verificano il ruolo applicativo
  prima di operare, altre si affidano solo alla policy RLS lato Postgres
  (`spese_write_admin`). **La barriera reale c'è in entrambi i casi** — è
  verificato che la RLS blocca comunque un non-amministratore — quindi questo
  non è un buco di autorizzazione. È un'incoerenza di stile che rende più
  difficile l'audit: per sapere se un'azione è protetta bisogna sempre andare
  a controllare la policy nello schema invece di poterlo leggere nel file
  dell'azione stessa, e produce messaggi d'errore meno chiari per l'utente
  (vedi COD-02: chi non è autorizzato riceve l'errore grezzo di Postgres
  invece di un reindirizzamento/messaggio applicativo).
- **Impatto concreto**: nessuno a livello di sicurezza (verificato); impatto
  sulla leggibilità/manutenibilità e sulla qualità del messaggio d'errore per
  l'utente non autorizzato.
- **Rimedio**: standardizzare — ogni server action inizia con
  `await richiedeAmministratore()` o `await richiedeUtente()` secondo il
  caso, anche quando la RLS da sola basterebbe, per avere un solo posto da
  leggere per capire chi può chiamare cosa (RLS resta comunque la barriera
  "vera" e va mantenuta).
- **Riferimento**: principio di defense-in-depth esplicitamente citato nel
  `README.md` del progetto stesso ("Row Level Security... è la barriera
  'vera'"), qui applicato in modo non uniforme nel livello applicativo.

### COD-05 — Nessun rate limiting applicativo su login, recupero password e richiesta OTP
- **Gravità**: media
- **File**: `src/app/login/actions.ts` (nessun throttling proprio),
  `src/app/recupera-password/actions.ts` (non ancora letto riga per riga in
  questa fase, verificato solo che non importa alcuna libreria di rate
  limiting — ricerca esaustiva `rate.limit|ratelimit|Ratelimit` su tutto
  `src/`, zero risultati), `src/app/firma-verbale/[token]/actions.ts`
  (`richiediCodice`, righe 61-73: solo un cooldown di 60s per singola riga
  `firme_verbale`, nessun limite per IP/dispositivo)
- **Descrizione**: non esiste nel codice applicativo alcuna libreria o
  meccanismo di rate limiting (né in-memory né esterno tipo Upstash/Vercel
  Firewall configurato via codice). Login e recupero password si affidano
  interamente ai limiti di default della piattaforma Supabase Auth (non
  verificabili da questo repo, quindi non do per scontato che siano
  sufficienti). Il captcha Cloudflare Turnstile protegge solo
  `/registrazione`, e solo se la chiave pubblica è configurata (altrimenti il
  componente non renderizza nulla, verificato in
  `src/components/turnstile-widget.tsx`).
- **Impatto concreto**: un attaccante può tentare credential stuffing sul
  login o spam di richieste di reset password senza che l'applicazione
  stessa opponga resistenza; per la richiesta di codice OTP, il cooldown di
  60s è per-riga (per singolo `token` di firma), quindi non limita un
  attaccante che provi `richiediCodice` su token diversi in parallelo (ogni
  token individualmente resta comunque innocuo per il motivo descritto nel
  punto positivo 8, ma il costo di invio email non è limitato a livello
  applicativo e potrebbe essere usato per generare traffico Resend non
  voluto).
- **Rimedio**: introdurre un rate limiter leggero (es. Vercel Firewall /
  `@upstash/ratelimit` con Redis, o un contatore in una tabella Postgres
  dedicata) almeno su: `login`, `recupera-password`, `richiediCodice`. Per
  login/registrazione, estendere il controllo Turnstile anche al login se i
  tentativi falliti superano una soglia.
- **Riferimento**: OWASP ASVS 2.2 (protezione da attacchi automatizzati su
  autenticazione).

### COD-06 — Nessuna validazione server-side del tipo MIME dei file caricati
- **Gravità**: media
- **File**: `src/app/admin/documenti/actions.ts` riga 66
  (`.upload(percorso, file, { contentType: file.type || undefined })`);
  pattern simile non riverificato riga-per-riga in
  `src/app/admin/assemblee/[id]/verbale-upload.tsx` e nell'upload foto di
  `src/app/area-riservata/segnalazioni/actions.ts` (solo verificata la
  presenza di un controllo su `.size`, non un allowlist di tipo — da
  approfondire se richiesto in una fase successiva)
  — segnalo questo come **campione**, non come verifica esaustiva di tutti i
  punti di upload.
- **Descrizione**: `file.type` è un valore dichiarato dal client (header
  `Content-Type` del browser, manipolabile), e viene scritto senza alcun
  controllo server-side su un allowlist (es. solo `application/pdf`,
  `image/jpeg`, `image/png`) né verificato contro i magic bytes reali del
  file.
- **Impatto concreto**: un amministratore (o, nel caso delle segnalazioni, un
  condòmino) potrebbe caricare un file eseguibile o un HTML/SVG con script
  incorporato dichiarandolo come PDF o immagine. Il rischio concreto dipende
  da *come* il file viene servito in lettura (se il bucket Supabase Storage
  serve il contenuto con lo stesso `Content-Type` dichiarato e senza
  `Content-Disposition: attachment`, un HTML/SVG malevolo aperto nella stessa
  origine del portale sarebbe un vettore di stored XSS). Non ho verificato in
  questa fase la configurazione del bucket/CDN di storage, quindi qualifico
  questo come rischio plausibile da confermare, non come exploit dimostrato.
- **Rimedio**: validare `file.type` contro un allowlist esplicito lato
  server prima dell'upload (rifiutare tutto il resto), e verificare che il
  bucket `documenti-condominio` imponga `Content-Disposition: attachment` o
  serva da un'origine separata senza eseguire script.
- **Riferimento**: OWASP Unrestricted File Upload.

### COD-07 — Colonne FK senza indice dedicato
- **Gravità**: bassa
- **File**: `supabase/schema.sql`, es. `deleghe.unita_delegante_id` /
  `unita_delegataria_id` / `utente_delegato_id` (righe 181-183, solo
  `idx_deleghe_assemblea` su `assemblea_id` esiste), `voti.utente_id`
  (righe 103-112, solo `punto_id` e `unita_id` indicizzati),
  `segnalazioni.unita_id`/`fornitore_id`/`aperta_da`, `sondaggio_risposte.utente_id`/`opzione_id`,
  `prenotazioni_spazi.utente_id`, `documenti_condominio.caricato_da`,
  `solleciti.inviato_da`, e le colonne `import_batch_id` aggiunte via `alter
  table` su `unita`/`spese`/`anagrafiche`
- **Descrizione**: diverse foreign key usate nelle policy RLS (es.
  `possiede_unita()` chiamata per riga nelle policy di `voti`, `deleghe`,
  `presenze`) o in query applicative non hanno un indice proprio.
- **Impatto concreto**: **oggi probabilmente trascurabile**: il
  partizionamento per tenant passa sempre per `condominio_id`, che è
  indicizzato ovunque, e il volume di righe per singolo condominio (decine di
  unità, poche assemblee/anno) è piccolo — una scansione sequenziale su
  qualche decina o centinaio di righe non è un problema di performance reale
  alla scala attuale. Diventerebbe rilevante solo con condomìni molto grandi
  o con un numero di tenant/righe totali molto più alto di quanto il disegno
  attuale sembri prevedere.
- **Rimedio**: non urgente; da rivalutare se la Fase 5 (continuità/scala)
  evidenzia volumi attesi più alti. Se necessario:
  ```sql
  create index if not exists idx_deleghe_delegante on deleghe(unita_delegante_id);
  create index if not exists idx_deleghe_delegataria on deleghe(unita_delegataria_id);
  create index if not exists idx_voti_utente on voti(utente_id);
  ```
- **Riferimento**: nessuna linea guida specifica violata; osservazione di
  manutenibilità/performance preventiva.

### COD-08 — ExcelJS e PapaParse eseguiti lato client nel wizard di importazione
- **Gravità**: bassa
- **File**: `src/lib/import/analizza-file.ts` riga 1-2 (`import ExcelJS from
  "exceljs"; import Papa from "papaparse";`), chiamato da
  `src/components/import/passo-carica-file.tsx` riga 1 (`"use client"`) riga
  59 (`await analizzaFile(file)`)
- **Descrizione**: il parsing del file `.xlsx`/`.csv` nel wizard di
  importazione avviene nel browser, non in una server action: `exceljs` (che
  include un parser XML e la gestione dello zip del formato `.xlsx`) finisce
  quindi nel bundle JavaScript delle pagine `/admin/importa/*`. È
  comprensibile come scelta (anteprima istantanea senza round-trip al
  server, nessun limite di `bodySizeLimit` sul primo passo), ma ha un costo
  di bundle che non è stato verificato quantitativamente in questa fase (non
  ho eseguito `next build` con analisi bundle).
- **Impatto concreto**: tempo di caricamento maggiore delle sole pagine di
  importazione (non delle altre, essendo Next App Router a code-splitting
  per route) la prima volta che un amministratore le visita. Non è un
  problema per l'utente finale (condòmino): queste pagine sono solo
  `/admin/importa/*`.
- **Rimedio**: se la dimensione del bundle di queste pagine risultasse
  problematica (da misurare con `next build` + `@next/bundle-analyzer`,
  Fase 5/mercato può dare priorità), valutare lo spostamento del parsing in
  una server action che riceve il file via `FormData` — compatibile con il
  limite già impostato (`bodySizeLimit: "4mb"` in `next.config.ts`) per file
  di importazione tipici.
- **Riferimento**: nessuna violazione, nota di performance/bundle size.

### COD-09 — Nessun logging o servizio di error tracking applicativo
- **Gravità**: media
- **File**: intero `src/` (ricerca esaustiva: zero occorrenze di
  `console.log`/`console.error`/`console.warn`); `package.json` non elenca
  alcun SDK di observability (Sentry, Logtail, Axiom, ecc.)
- **Descrizione**: non un solo file del progetto scrive un log applicativo.
  Gli errori non gestiti arrivano all'`error.tsx` più vicino (che mostra solo
  un `digest` all'utente, generato da Next), mentre gli errori gestiti
  (`{ errore: error.message }`) vengono solo restituiti all'interfaccia, mai
  registrati da nessuna parte lato server.
- **Impatto concreto**: in produzione, l'unica fonte di diagnosi per un
  guasto è il log runtime grezzo di Vercel (se consultato in tempo: la
  retention dei log di funzione su Vercel è limitata nel piano usato, non
  verificato da qui) — nessuna ricerca per utente/condominio, nessun alert
  automatico su errori ripetuti, nessuna traccia storica per capire con
  quale frequenza un certo errore si verifica. Per un portale che gestisce
  dati legali/finanziari di più amministratori, questo rende lento e
  reattivo (mai proattivo) qualsiasi incident response.
- **Rimedio**: introdurre un logging minimo e strutturato lato server (anche
  solo `console.error` con un payload JSON coerente, dato che Vercel
  raccoglie stdout/stderr delle funzioni), e valutare un servizio di error
  tracking (Sentry ha un'integrazione diretta con Next.js App Router) almeno
  per i Server Action e i Route Handler più critici (pagamenti, webhook
  Stripe, firma OTP).
- **Riferimento**: OWASP ASVS 7 (Error Handling and Logging); assenza non
  compensata da alcun equivalente trovato nel codice.

### COD-10 — Copertura di test limitata alla logica pura, nessun test di integrazione/e2e
- **Gravità**: bassa
- **File**: 22 file `*.test.ts` sotto `src/lib/**` (verificato con `find`),
  a fronte di 41 moduli non-test in `src/lib/**`; zero file `*.test.tsx`;
  nessuna configurazione Playwright/Cypress/Vitest-browser trovata nel repo
- **Descrizione**: i test esistenti (es. `quorum.test.ts`, `riconciliazione.test.ts`,
  `firma-otp.test.ts`) sono di buona qualità su ciò che coprono — testano
  funzioni pure isolate dal database, coerentemente con la separazione
  descritta nel punto positivo 1. Non esiste però alcun test che eserciti una
  server action, una pagina, o un flusso end-to-end (login → voto, login →
  pagamento, upload → download PDF).
- **Impatto concreto**: un refactor che rompe l'integrazione tra la logica
  pura (testata) e il livello di accesso dati/RLS (non testato) passerebbe
  la suite attuale senza che nessun test se ne accorga. I bug più probabili
  in un'app di questo tipo (policy RLS troppo permissiva/restrittiva, query
  con nome colonna sbagliato dopo un refactor — vedi COD-03) non sono nella
  zona coperta dai test.
- **Rimedio**: non serve necessariamente e2e completo da subito; anche
  pochi test di integrazione contro un progetto Supabase locale/di test
  (es. via `supabase start` + service-role key di test) sui flussi critici
  (RLS su `voti`/`ripartizioni`/`firme_verbale`, webhook Stripe) coprirebbero
  il rischio più alto a costo contenuto.
- **Riferimento**: nessuna violazione; nota di maturità della suite di test.

---

## Fuori perimetro in questa fase (segnalato, non approfondito)

- Non ho eseguito `next build`/bundle analyzer: le affermazioni su bundle
  size (COD-08) sono qualitative, non misurate.
- Non ho verificato la configurazione reale del bucket Supabase Storage
  (header `Content-Type`/`Content-Disposition` effettivi in risposta) citata
  in COD-06: è segnalata come rischio da confermare, non come fatto
  verificato end-to-end.
- Il dettaglio comportamentale delle policy RLS (quale condizione sia
  effettivamente in vigore quando una policy è ridefinita più volte, già
  notato in Fase 0) è rimandato alla Fase 4, come previsto dall'incarico.

---

Nessun file del progetto è stato modificato in questa fase, a parte la
creazione di questo stesso documento in `docs/audit/01-codice.md`.
