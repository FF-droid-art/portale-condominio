@AGENTS.md

# Portale Condominio — guida operativa

Fonte: `docs/audit/00-mappa.md` … `99-piano.md`. Per il contesto completo
di un rilievo, leggi lì; qui restano solo le regole da seguire scrivendo
codice nuovo.

## Stack e versioni (non cambiare senza motivo)

- Next.js **16.2.10**, App Router. Il middleware si chiama `src/proxy.ts`
  (non `middleware.ts` — vedi `AGENTS.md`).
- React **19.2.4**, TypeScript **5** (`strict: true`, non abbassarlo).
- Supabase: Postgres + Auth + Storage, via `@supabase/ssr@0.12.x` e
  `@supabase/supabase-js@2.110.x`. Nessun ORM: query builder diretto.
- Tailwind CSS **4** (design system unico in `src/app/globals.css`, non
  introdurre un secondo sistema di colori/spaziature).
- Stripe **22.x** (solo incasso quote, `mode: "payment"`), Resend **6.x**
  (email transazionali), `pdf-lib` **1.17.1** (generazione PDF, niente
  Chromium/Puppeteer — scelta deliberata per compatibilità serverless),
  `exceljs` + `papaparse` (import file).
- Test: Vitest. Nessun framework e2e/integrazione installato.

## Struttura delle cartelle — dove va cosa

```
src/app/admin/**            pagine e server action per l'amministratore
src/app/area-riservata/**   pagine e server action per il condòmino
src/app/api/**               SOLO route handler che non possono essere
                              server action (oggi: webhook Stripe).
                              Non aggiungerne altri senza motivo: preferire
                              sempre una server action o, per i download di
                              file, un Route Handler sotto src/app/admin|
                              area-riservata/.../route.ts (pattern già
                              usato per PDF: rendiconto, sollecito, ecc.)
src/components/ui/**         primitive di interfaccia condivise (Button,
                              Field/Input, Dialog, Table, PageHeader...).
                              USA QUESTE, non crearne varianti nuove:
                              Dialog incorpora già focus trap/aria/escape,
                              Field incorpora già label/aria-describedby/
                              aria-invalid. Una nuova modale o un nuovo
                              campo scritti da zero perdono quelle garanzie.
src/components/<feature>/**  componenti specifici di una sola feature
src/lib/supabase/            client.ts (browser), server.ts (SSR, RLS
                              attiva), service.ts (service-role, bypassa
                              RLS — vedi regola sotto), dal.ts
                              (richiedeUtente/richiedeAmministratore)
src/lib/documenti/           modello documenti + resa PDF (pdf-lib)
src/lib/import/              parsing/validazione file di importazione
src/lib/<nome-feature>.ts    UNA sola responsabilità: logica pura,
                              testabile senza database (quorum.ts,
                              solleciti.ts, riconciliazione.ts, ecc.),
                              con il suo `*.test.ts` affiancato. L'I/O
                              (query, email, file) resta nelle action/
                              pagine, non qui dentro.
supabase/schema.sql           UNICA fonte di verità dello schema — vedi
                              sezione dedicata sotto, non è un file come
                              gli altri.
supabase/seed-demo.sql         dati finti, eseguito a mano una volta
legale/*-BOZZA.md             bozze legali, non pubblicare modifiche di
                              sostanza senza far ripassare un legale
```

## Convenzioni di naming e stile

- **Tutto in italiano**: nomi di file, variabili, funzioni, commenti,
  messaggi utente. Non mescolare inglese per "sembrare più tecnico" — il
  resto della codebase non lo fa.
- Server action: `"use server"` in testa al file, firma
  `(stato: StatoForm, formData: FormData) => Promise<StatoForm>` con
  `type StatoForm = { errore?: string } | undefined` quando si usa
  `useActionState`; azioni senza stato di ritorno (redirect sempre)
  restituiscono `Promise<void>`.
- Date: mai `new Date().getHours()`/`.getDate()` per "oggi"/"ora" — usa
  `oggiLocale()`/`oraLocale()`/`adessoLocale()` da `src/lib/fuso.ts`
  (fuso `Europe/Rome` esplicito). Le date salvate sono stringhe di
  calendario (`aaaa-mm-gg`), non istanti — confrontale come stringhe.
- Moduli server-only (toccano segreti o non devono mai finire nel bundle
  client): prima riga `import "server-only";`. Tutti i moduli in
  `src/lib/supabase/` che non siano `client.ts` lo richiedono — compreso
  `service.ts` anche se oggi non lo ha ancora (vedi "Errori da non
  ripetere").
- Icone-sola (`<Button iconOnly>`): sempre con `aria-label` o `title`
  esplicito, mai senza.

## Modello di autorizzazione — la regola che non si negozia

**Ogni riga di ogni tabella deve restare filtrata per tenant a livello di
database (RLS), mai solo a livello di query applicativa o di filtro
client-side.** Il codice applicativo può (e in alcuni punti dovrebbe,
vedi sotto) aggiungere un controllo prima di una scrittura, ma quel
controllo è una **comodità per l'utente** (messaggio d'errore migliore),
non la barriera: la barriera reale è sempre la policy RLS sulla tabella.

- Due ruoli: `amministratore`, `condomino` (`utenti.ruolo`).
- Multi-tenancy tra amministratori: `condomini.amministratore_id`.
  Qualsiasi nuova tabella/policy per l'amministratore deve passare da
  `admin_possiede_condominio(condominio_id)` o da un `admin_gestisce_*`
  dedicato che risale a quella funzione — mai un controllo "sei
  amministratore" nudo, senza scoping al condominio.
- Isolamento tra condòmini dello stesso stabile: `appartiene_condominio()`
  (dati condivisi del condominio) o `possiede_unita()` (dati della propria
  unità). Qualsiasi dato individuale (voto, presenza, segnalazione
  personale, prenotazione) richiede `utente_id = auth.uid()` oltre al
  possesso dell'unità.
- Se una funzione deve restituire un aggregato cross-utente (es. un
  totale millesimi, un conteggio voti) senza esporre le righe singole:
  `security definer` + verifica interna di appartenenza prima di
  calcolare — pattern già usato in `condominio_millesimi_totali`,
  `assemblea_riepilogo_quorum`, `sondaggio_risultati`, ecc. Copialo da lì,
  non reinventarlo.
- `createServiceClient()` (service-role, bypassa RLS) **solo** quando non
  esiste una sessione utente (webhook Stripe, flusso `firma-verbale`
  pubblico, generazione di un magic link per un altro utente) **e solo**
  se la query che segue è comunque filtrata da qualcosa di stretto e non
  enumerabile (un id specifico già noto, un token ad alta entropia) — mai
  da un controllo di ruolo generico seguito da una select senza altro
  filtro.

### Caso di studio: THREAT-01 (già risolto, ma la lezione resta)

Un amministratore qualunque — anche auto-registrato, senza alcuna
verifica — poteva impersonare un condòmino non suo, perché la policy
`utenti_select_self_or_admin` aveva una clausola scritta per uno scopo
preciso ("un amministratore deve poter trovare un condòmino non ancora
assegnato a un'unità per collegarlo") che aveva anche un effetto
collaterale più ampio: rendeva quella riga visibile a **qualsiasi**
amministratore, non solo a quello giusto. La funzione di impersonazione
si fidava di quella select come prova di autorizzazione, ma la select era
stata scritta per un caso d'uso diverso.

**Regola che ne segue, da applicare sempre**: quando una nuova funzione,
azione o route deve decidere "posso fare X su questo utente/risorsa?",
non riusare una policy/funzione RLS esistente solo perché restituisce la
riga giusta — risali a **perché** quella policy esiste e verifica che il
suo scopo originale coincida con quello che stai per autorizzare. Se una
sessione viene creata per conto di un altro utente (magic link,
impersonazione, "visualizza come"), va anche **revocata esplicitamente**
quando l'operazione finisce, non solo scambiata nei cookie: un token non
revocato resta valido per conto proprio, indipendentemente da cosa
succede dopo nell'interfaccia.

## Comandi di sviluppo, test e deploy

```bash
npm run dev      # next dev
npm run build    # next build
npm run start    # next start
npm run lint      # eslint (preset eslint-config-next)
npm run test      # vitest run — SOLO src/**/*.test.ts, solo logica pura
```

- **Nessuna pipeline CI**: niente in `.github/workflows`. Lint e test non
  sono applicati automaticamente su push/PR — eseguili tu stesso prima di
  aprire una PR.
- **Nessun test di isolamento tenant esiste oggi** (né e2e, né di
  integrazione contro un Postgres vero): i test coprono solo funzioni pure
  di `src/lib/**`. Se aggiungi o modifichi una policy RLS o un flusso che
  agisce per conto di un altro utente (impersonazione, magic link,
  service-role), **non fidarti della sola lettura della policy**: se puoi,
  verificala con una query reale contro un progetto Supabase locale/di
  test prima di considerarla chiusa. Non è ancora automatizzato: finché
  non lo è, è responsabilità di chi scrive il codice.
- **Schema del database**: `supabase/schema.sql` non è un file che si
  modifica in place — è un **log cumulativo di migrazioni**, applicato a
  mano nel SQL Editor di Supabase (nessuna Supabase CLI, nessuna cartella
  `supabase/migrations/`). Per cambiare qualcosa:
  1. **Aggiungi sempre un nuovo blocco in fondo al file**, con un
     commento di intestazione che spiega cosa cambia e perché (segui lo
     stile dei blocchi già presenti). Non editare un blocco già scritto
     più in alto, anche per correggere un errore: la prassi del progetto è
     un nuovo `drop policy if exists` + `create policy` più in basso.
  2. La definizione **in vigore** di una policy/funzione con un certo nome
     è quella più in basso nel file, non la prima che trovi cercandola.
     Prima di modificare una policy, scorri il file per assicurarti di
     star leggendo l'ultima versione.
  3. Dopo aver scritto il blocco, applicalo manualmente in Supabase SQL
     Editor (è idempotente per convenzione: usa `if not exists`/`if
     exists` così può essere rieseguito senza danni).
  4. Se il cambio tocca una tabella/colonna nuova, aggiorna anche la
     sezione pertinente di `docs/audit/00-mappa.md` se è ancora la mappa
     di riferimento del progetto, o il tuo equivalente corrente.
- **Deploy**: integrazione Git↔Vercel, nessuno step manuale oltre al
  push. Verifica tu stesso `npm run build` in locale prima di un push su
  `main`/branch di produzione, dato che non c'è CI che lo faccia per te.

## Vincoli normativi da non violare

- **Art. 1129, 1130, 1130-bis c.c.**: obblighi dell'amministratore
  (registro anagrafe, rendiconto annuale con la tripartizione
  registro/riepilogo/nota, conservazione decennale). Qualsiasi feature che
  tocca questi dati deve restare coerente con quella struttura — non
  semplificarla per comodità di implementazione.
- **Art. 1130, n. 6, c.c.**: il registro di anagrafe condominiale richiede
  per legge anche codice fiscale della persona, dati catastali
  dell'unità, condizioni di sicurezza delle parti comuni — campi oggi
  assenti dal modello dati (`docs/audit/03-feature-conformita.md`,
  FEAT-01). Se estendi l'anagrafica, muoviti verso questi campi, non
  allontanartene.
- **Art. 1136, 1137 c.c.**: il voto in assemblea **non è anonimo** —
  non introdurre mai un meccanismo che lo renda tale (il verbale deve
  poter dar conto dei dissenzienti).
- **Art. 66/67 disp. att. c.c.**: contenuti minimi della convocazione
  (ordine del giorno, luogo) e limite alle deleghe cumulabili da un solo
  delegato. Il limite deleghe è verificato in `src/lib/deleghe.ts`, non
  nel database — se tocchi quel codice, non spostare il controllo altrove
  senza riportarlo.
- **Firma OTP del verbale** (`src/lib/firma-otp.ts`): non è, e non deve
  mai essere presentata come, una firma elettronica con valore legale
  (eIDAS/CAD). Mantieni il disclaimer ovunque questo meccanismo è
  usato/descritto.
- **Dati di morosità**: mai in comunicazioni collettive visibili tra
  condòmini. Solleciti e avvisi di morosità sempre individuali o in BCC,
  mai in copia visibile — è già così nel codice, non introdurre un nuovo
  canale di invio che lo violi.
- **GDPR**: art. 13 (informativa al momento della raccolta — collega
  sempre un nuovo punto di raccolta dati a `/privacy`), art. 32 (misure di
  sicurezza adeguate: ogni nuova funzionalità che tratta dati personali
  passa dal modello RLS sopra, non lo scavalca "per velocità").
- **Cookie**: solo cookie tecnici. Prima di introdurre un cookie non
  strettamente necessario (analytics, preferenze non essenziali, terze
  parti), serve prima una decisione su consenso/banner — oggi il prodotto
  non ne ha uno di proposito.

## Errori ricorrenti emersi dall'audit — non ripeterli

1. **Mai un modulo che usa `createServiceClient()` senza `import
   "server-only"` in testa.** `service.ts` stesso oggi non lo ha
   (`docs/audit/01-codice.md`, COD-01): è un difetto noto, non un
   esempio da seguire. Non replicarlo in nessun nuovo modulo con segreti.
2. **Mai restituire `error.message` di Postgres/PostgREST direttamente
   all'utente** (`{ errore: error.message }`). È successo in 85 punti
   (COD-02): espone dettagli interni e non è un messaggio utile. Traduci
   l'errore in un messaggio applicativo; se serve il dettaglio originale,
   loggalo (vedi punto 7), non mostrarlo.
3. **Mai aggiungere una `.select()` con join annidati senza verificare a
   mano che il tipo scritto per il cast (`as unknown as X`) corrisponda
   davvero ai nomi nella stringa `.select()`.** Non esiste ancora un tipo
   `Database` generato (COD-03): il compilatore non controlla questi
   cast, quindi un errore di nome compila ma fallisce solo a runtime.
   Se tocchi più volte lo stesso tipo di query, considera di generare
   finalmente `database.types.ts` invece di aggiungere altri cast a mano.
4. **Mai dare per buono il risultato di una policy/funzione RLS per uno
   scopo diverso da quello per cui è stata scritta** — vedi il caso di
   studio THREAT-01 sopra. Prima di autorizzare un'azione sensibile
   (specialmente qualunque forma di "agire per conto di un altro utente"),
   rileggi la policy che la rende possibile, non solo il suo esito.
5. **Mai lasciare un upload senza un allowlist di tipo file lato server.**
   Oggi si valida solo la dimensione (`file.size`), non il tipo reale
   (COD-06): `file.type` è dichiarato dal client e non va fidato.
6. **Mai introdurre una libreria di parsing pesante (Excel/CSV/grandi
   JSON) in un componente `"use client"` senza una ragione esplicita.**
   `exceljs`/`papaparse` girano oggi lato client nel wizard di import
   (COD-08): è stata una scelta deliberata per quel caso, non un default
   da ripetere altrove senza pensarci.
7. **Mai aggiungere un flusso critico (pagamenti, firma, impersonazione,
   import massivo) senza almeno un `console.error`/log strutturato sui
   suoi fallimenti.** Oggi non esiste logging applicativo da nessuna
   parte (COD-09): un `catch {}` silenzioso (vedi
   `notificaNuovaAssemblea`) significa che nessuno saprà mai se
   quell'operazione è fallita.
8. **Mai scrivere una nuova server action che manipola dati sensibili
   senza decidere esplicitamente se chiamare `richiedeUtente()`/
   `richiedeAmministratore()` prima di operare**, anche se la RLS
   basterebbe da sola (COD-04). Non è un rischio di sicurezza se lo salti
   (la RLS c'è comunque), ma rende l'audit del codice più lento e il
   messaggio d'errore peggiore per chi non è autorizzato: mettilo sempre,
   per coerenza con il resto del progetto.
9. **Mai presumere che un nuovo documento "ufficiale" (verbale, rendiconto,
   convocazione, tabella millesimale) sia accessibile al condòmino solo
   perché la RLS lo permetterebbe.** Rendiconto e tabelle millesimali oggi
   hanno la RLS pronta ma **nessuna pagina/route lato condòmino** che le
   usi (FEAT-02, FEAT-03): la RLS pronta non basta, serve anche
   l'interfaccia. Se generi un nuovo documento per l'amministratore,
   chiediti subito se il condòmino ha anche lui diritto di vederlo — e se
   sì, costruisci anche quella pagina nella stessa iterazione, non "poi".

