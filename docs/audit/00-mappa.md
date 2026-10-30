# Fase 0 — Mappa della repository

> Ricognizione a scopo di audit. Ogni affermazione qui sotto è stata
> verificata leggendo il file indicato; dove non è stato possibile
> verificare (es. contenuto non ancora letto) è segnalato esplicitamente
> come "non verificato" invece di essere dato per scontato.
>
> Repo: `C:\dev\portale-condominio`, branch `restyling`. Stack dichiarato:
> Next.js 16 (App Router, middleware rinominato `src/proxy.ts`), React 19,
> Supabase (Postgres + Auth + RLS, via `@supabase/ssr` e
> `@supabase/supabase-js`), Tailwind CSS 4, Stripe, Resend, pdf-lib,
> ExcelJS/PapaParse per import/export.

---

## 1. Struttura delle cartelle

```
src/
  app/                      # App Router
    admin/                  # Area amministratore (protetta)
    area-riservata/         # Area condòmino (protetta)
    api/stripe/webhook/     # Unico endpoint /api (webhook Stripe)
    login/ logout/ registrazione/ recupera-password/ reimposta-password/
    cookie/ privacy/        # Pagine pubbliche informative
    firma-verbale/[token]/  # Flusso pubblico senza login (conferma verbale)
    layout.tsx, page.tsx, error.tsx, not-found.tsx, globals.css
  proxy.ts                  # Middleware (nome Next.js 16: non è middleware.ts)
  components/
    ui/                     # Componenti di base (button, card, dialog, table...)
    import/                 # Wizard di importazione (file, mappatura, anteprima)
    calendario/, segnalazioni/
    app-shell.tsx, auth-shell.tsx, logo.tsx, turnstile-widget.tsx, ...
  lib/
    supabase/               # client.ts (browser), server.ts (SSR/cookie), service.ts (service-role), dal.ts (data access layer: richiedeUtente/richiedeAmministratore)
    documenti/              # Modello documenti + generazione PDF (pdf-lib) + test
    import/                 # Parsing/validazione/coercizione file import + test
    *.ts + *.test.ts        # Un modulo di logica pura per feature (quorum, deleghe, solleciti, riconciliazione, segnalazioni, manutenzioni, prenotazioni, calendario, archivio, sondaggi, notifiche, firma-otp, fuso, format, ruoli, impersonazione, stripe, resend, types)
public/
supabase/
  schema.sql                # Unica fonte di verità dello schema (3105 righe)
  migrazioni-restyling.sql  # Estratto letterale di schema.sql (righe 1917->fine), per applicare manualmente il delta della wave B/C su un DB già esistente
  seed-demo.sql             # Dati finti per demo/test
legale/                     # Bozze privacy policy, cookie policy, DPA (GDPR) — tutte marcate "BOZZA, da revisione legale"
demo/                       # Istruzioni + CSV di prova per riconciliazione bancaria
.vercel/                    # Progetto Vercel collegato (project.json con projectId/orgId, nessun dato sensibile)
.claude/                    # settings.local.json
```

Osservazioni strutturali verificate:

- **Non esiste `supabase/migrations/` né `supabase/config.toml`**: non c'è Supabase CLI/migration runner. `supabase/schema.sql` è, per dichiarazione esplicita nei suoi stessi commenti (es. riga ~461: *"Questo file è solo un registro storico: modificarlo non ha alcun effetto sul database reale"*), un **log cumulativo di migrazioni applicate a mano** nel SQL Editor di Supabase, non uno schema dichiarativo pulito. Contiene più blocchi `drop policy [if exists] ... create policy ...` che ridefiniscono la stessa policy in punti successivi del file (es. `voti_insert_condomino` ridefinita 3 volte, `utenti_select_self_or_admin` 2 volte) — la definizione "vigente" è quella più in basso nel file. Questo va tenuto a mente in Fase 1 (manutenibilità) e Fase 4 (verificare che l'ultima versione sia davvero quella attiva sul DB reale).
- `supabase/migrazioni-restyling.sql` è letteralmente un sottoinsieme di `schema.sql` (confermato dal suo stesso commento di intestazione), creato per comodità di chi deve aggiornare un progetto Supabase già provisionato senza rilanciare tutto lo schema.
- Nella cartella `demo/` sono presenti 4 PDF (`demo/01 - Meridian Digital Services v Varosia - Bucerius.pdf` e analoghi) che per nome non hanno alcuna relazione apparente con un portale condominiale (sembrano materiale di moot court/causa legale). Sono file non tracciati da git (`??` nello stato Git iniziale) e il loro contenuto non è stato letto: segnalo solo la loro presenza anomala in questa cartella, senza ipotesi sul contenuto.
- `legale/*-BOZZA.md` sono bozze di privacy policy, cookie policy e DPA esplicitamente marcate "da sottoporre a verifica legale" — pertinenti per la Fase 3 (conformità).

---

## 2. Routing

### 2.1 Pubblico (nessuna sessione richiesta)

Verificato in `src/proxy.ts`: liste esplicite `ROUTE_ACCESSIBILI_SENZA_LOGIN` e `PREFISSI_ACCESSIBILI_SENZA_LOGIN`.

| Route | File | Note |
|---|---|---|
| `/` | `src/app/page.tsx` | Landing page; se l'utente è già loggato fa `redirect` server-side verso `/admin` o `/area-riservata` in base al ruolo (letto da `getUtenteCorrente()`) |
| `/login` | `src/app/login/page.tsx`, `actions.ts` | Route "pubblica" in senso stretto (redirige via se già loggato) |
| `/registrazione` | `src/app/registrazione/page.tsx`, `actions.ts` | Crea sempre utenti `condomino` (il ruolo richiesto è ri-validato dal trigger DB `handle_new_user`); widget Cloudflare Turnstile opzionale (si disattiva da sola se `NEXT_PUBLIC_TURNSTILE_SITE_KEY` non è impostata); il captcha token è passato a `supabase.auth.signUp` e verificato da Supabase stesso, non da codice applicativo |
| `/recupera-password` | `page.tsx`, `actions.ts` | |
| `/reimposta-password` | `page.tsx` | Esclusa da `ROUTE_PUBBLICHE` di proposito: il link dalla email porta i token nel fragment URL (invisibile al server), quindi deve restare accessibile sia prima che dopo che il client stabilisce la sessione di recupero |
| `/logout` | `actions.ts` | |
| `/privacy`, `/cookie` | `src/app/privacy/page.tsx`, `src/app/cookie/page.tsx` | Pagine informative statiche |
| `/firma-verbale/[token]` | `page.tsx`, `modulo-conferma.tsx`, `actions.ts` | Prefisso pubblico dedicato: destinatari (presidente/segretario) senza account, identificati dal token nell'URL + OTP via email. Legge con `createServiceClient()` (service-role) perché non c'è sessione utente |
| webhook Stripe | `src/app/api/stripe/webhook/route.ts` | Non autenticato via sessione: verificato tramite firma HMAC Stripe (`stripe-signature` + `STRIPE_WEBHOOK_SECRET`) |

Qualsiasi altra route, se non autenticata, viene rediretta a `/login` dal proxy (fail-closed: default "serve login" salvo whitelist esplicita).

### 2.2 `/admin/*` (ruolo amministratore)

Protezione a due livelli verificata: (1) `src/proxy.ts` richiede una sessione Supabase valida; (2) `src/app/admin/layout.tsx` chiama `richiedeAmministratore()` (`src/lib/supabase/dal.ts`), che fa `redirect("/area-riservata")` se `utente.ruolo !== "amministratore"`. L'isolamento tra condomìni diversi gestiti da amministratori diversi è delegato alla RLS (colonna `condomini.amministratore_id`), non a un controllo applicativo nel layout — verificato nello schema, dettaglio in Fase 4.

Sezioni (pagina indice + dettaglio dove presente):

- `/admin` — dashboard (`page.tsx`)
- `/admin/condomini`, `/admin/condomini/[id]` — anagrafica condomìni, conto corrente, rendiconto PDF (`rendiconto/route.ts`), esportazione completa dei dati in ZIP (`esportazione/route.ts`), trasferimento/eliminazione condominio
- `/admin/unita/[id]` — unità, proprietari, millesimi, stato patrimoniale PDF (`stato-patrimoniale/route.ts`)
- `/admin/spese`, `/admin/spese/[id]` — spese e ripartizioni
- `/admin/assemblee`, `/admin/assemblee/[id]` — convocazione, punti OdG, presenze, firme verbale, documenti PDF (`documenti/route.ts`)
- `/admin/sondaggi`, `/admin/sondaggi/[id]` — consultazioni rapide
- `/admin/segnalazioni`, `/admin/segnalazioni/[id]` — ticket di manutenzione
- `/admin/manutenzioni` — fornitori + scadenzario manutenzioni programmate
- `/admin/spazi` — spazi comuni e prenotazioni (vista admin)
- `/admin/riconciliazione` — import CSV estratto conto + abbinamento
- `/admin/solleciti`, `/admin/solleciti/[unitaId]` — morosità + lettere PDF
- `/admin/calendario` — vista aggregata eventi
- `/admin/documenti` — archivio documenti condominio
- `/admin/importa`, `/admin/importa/{condomini-unita,unita,spese}` — wizard di import massivo
- `/admin/utenti` — gestione utenti, cambio ruolo, impersonazione ("Visualizza come")
- `error.tsx`, `loading.tsx` a vari livelli

### 2.3 `/area-riservata/*` (condòmino autenticato, incluso l'amministratore quando "impersona")

Protezione verificata: `src/app/area-riservata/layout.tsx` chiama `richiedeUtente()` (qualsiasi ruolo autenticato va bene qui).

- `/area-riservata` — dashboard personale, ripartizioni (`elenco-ripartizioni.tsx`), pulsante pagamento Stripe (`pagamento-button.tsx` + `actions.ts`)
- `/area-riservata/assemblee`, `/area-riservata/assemblee/[id]` — partecipazione, voto, delega/revoca delega
- `/area-riservata/sondaggi`, `/area-riservata/sondaggi/[id]` — risposta a consultazioni
- `/area-riservata/segnalazioni`, `/area-riservata/segnalazioni/[id]` — apertura/ritiro ticket
- `/area-riservata/spazi` — prenotazione spazi comuni
- `/area-riservata/calendario` — vista eventi personale
- `/area-riservata/condominio` — "Il mio condominio": dati dello stabile e dell'amministratore, rendiconto annuale in PDF (`condominio/[id]/rendiconto/route.ts`), tabelle millesimali in lettura, stato patrimoniale delle proprie unità (`unita/[id]/stato-patrimoniale/route.ts`)
- `/area-riservata/documenti` — consultazione archivio
- `/area-riservata/notifiche` — preferenze di notifica (opt-out per tipo evento)
- `ImpersonazioneBanner` (`impersonazione-banner.tsx`) mostrato quando un amministratore sta "visualizzando come" un condòmino, con pulsante di ripristino sessione

---

## 3. Schema del database (`supabase/schema.sql`)

### 3.1 Tabelle principali e relazioni (verificate riga per riga)

| Tabella | Scopo | Relazioni chiave |
|---|---|---|
| `condomini` | Anagrafica stabile | `amministratore_id → utenti.id` (aggiunta con `alter table` più avanti nel file, non nella `create table` iniziale: multi-tenancy per amministratore) |
| `utenti` | Estende `auth.users` | `id → auth.users.id` (cascade); `ruolo` check `amministratore`/`condomino`; riga creata dal trigger `handle_new_user` |
| `unita` | Unità immobiliari | `condominio_id → condomini`; `millesimi_proprieta`; dati catastali `catasto_foglio`/`catasto_particella`/`catasto_subalterno`/`catasto_categoria` (nullable, art. 1130 n. 6 c.c.) |
| `unita_proprietari` | Join unità↔persona (comproprietà) | `unita_id`, `utente_id` (nullable dopo l'introduzione di `anagrafiche`), `anagrafica_id`, `quota_possesso` |
| `assemblee` | Assemblee condominiali | `condominio_id`; `tipo` (ordinaria/straordinaria); `stato`; `verbale_url` |
| `punti_odg` | Punti all'ordine del giorno | `assemblea_id`; `tipo_maggioranza`; `esito` |
| `voti` | Voto per unità/punto | `punto_id`, `unita_id`, `utente_id`; `millesimi_rappresentati` **snapshot** al momento del voto |
| `spese` | Spese del condominio | `condominio_id`; `import_batch_id` (opzionale) |
| `ripartizioni` | Riparto spesa→unità | `spesa_id`, `unita_id`; `stato_pagamento`; `stripe_checkout_session_id` (aggiunta successiva) |
| `presenze` | Presenza in assemblea (per quorum live) | `assemblea_id`, `unita_id`, `utente_id`; `millesimi_rappresentati` |
| `deleghe` | Delega di voto | `unita_delegante_id` ≠ `unita_delegataria_id` (check); limite di legge (art. 67 disp. att. c.c.) applicato in `src/lib/deleghe.ts`, non nel DB |
| `import_batches` | Lotti di importazione | `condominio_id`; referenziata da `unita.import_batch_id`, `spese.import_batch_id`, `anagrafiche.import_batch_id` |
| `tabelle_millesimali` / `valori_millesimali` | Tabelle millesimali multiple per condominio | `condominio_id` → `tabelle_millesimali` → `valori_millesimali(unita_id, valore)` |
| `anagrafiche` | Persone/società non necessariamente utenti registrati | `condominio_id`; `utente_id` opzionale (collegamento "reclama la tua anagrafica" non ancora implementato, vedi `IDEE-FUTURE.md`); `codice_fiscale`, `residenza_domicilio` (nullable, art. 1130 n. 6 c.c.) |
| `firme_verbale` | Conferma OTP del verbale da presidente/segretario | `assemblea_id`; `token` univoco; `otp_hash` (mai in chiaro), scadenza, tentativi |
| `sondaggi` / `sondaggio_opzioni` / `sondaggio_risposte` | Consultazioni rapide non vincolanti | `condominio_id`; risposta unica per unità finché aperto |
| `fornitori` | Anagrafica fornitori/manutentori | `condominio_id`; `categoria` enum |
| `manutenzioni_programmate` | Scadenzario manutenzioni | `condominio_id`, `fornitore_id?`, `spesa_id?`; `periodicita` |
| `segnalazioni` / `segnalazione_note` | Ticket di manutenzione | `condominio_id`, `unita_id?` (null = parti comuni), `fornitore_id?`; note con flag `interna` (non visibile al condòmino) |
| `documenti_condominio` | Archivio documentale | `condominio_id`; `percorso` storage, `mime_type`, `dimensione_byte` |
| `spazi_comuni` / `prenotazioni_spazi` | Spazi comuni prenotabili | `condominio_id` → `spazi_comuni` → `prenotazioni_spazi(unita_id, utente_id, inizio, fine)`; check `fine > inizio`; vincolo di non sovrapposizione duplicato in codice + trigger DB |
| `preferenze_notifiche` | Opt-out notifiche email per tipo evento | `utente_id`, `tipo_evento` (testo libero, non enum) |
| `solleciti` | Storico lettere di morosità inviate | `condominio_id`, `unita_id`; `livello` 1/2/3 |
| `movimenti_bancari` | Righe di estratto conto importate | `condominio_id`; `ripartizione_id?`; `import_hash` univoco per condominio (idempotenza import) |
| `condizioni_sicurezza_parti_comuni` | Registro delle condizioni di sicurezza delle parti comuni (art. 1130 n. 6 c.c.) | `condominio_id`; `parte`, `data_ultima_verifica?`, `documento_url?` (link, nessun upload proprio) |
| `tentativi_autenticazione` | Contatore dei tentativi su login, recupero password e richiesta del codice di firma (COD-05) | nessuna relazione: `azione`, `chiave` (impronta SHA-256 di azione+email+IP, mai il dato in chiaro), `avvenuto_il`. Scritta e letta solo da `service_role` attraverso `registra_tentativo_autenticazione` / `azzera_tentativi_autenticazione` |

Funzioni/trigger rilevanti verificati: `handle_new_user` (provisioning riga `utenti` alla registrazione, forza ruolo a `condomino` salvo richiesta esplicita `amministratore`), `blocca_cambio_ruolo_non_autorizzato` (trigger `before update` su `utenti` che impedisce auto-promozione), `ruolo_corrente()`, `possiede_unita()`, `appartiene_condominio()` (helper `security definer` usati nelle policy), `importa_spese_storiche` (funzione di import bulk, **non** `security definer` — gira con i privilegi del chiamante, quindi dipende dalle policy RLS di `spese`/`ripartizioni`); `condominio_amministratore`, `condominio_rendiconto_quote`, `condominio_rendiconto_segnalazioni`, `condominio_unita_millesimi`, `condominio_valori_millesimali` (helper `security definer` con verifica interna `admin_possiede_condominio() or appartiene_condominio()`, aggiunti per dare al condòmino rendiconto e tabelle millesimali completi senza allargare le policy di riga) e `unita_soggetti` (stesso schema, perimetro `possiede_unita()`); `registra_tentativo_autenticazione` e `azzera_tentativi_autenticazione` (`security definer` con `execute` concesso **solo a `service_role`**: contatore del rate limiter, serializzato per chiave con `pg_advisory_xact_lock` perché "conta poi scrivi" non è atomico).

### 3.2 Tabelle con RLS attiva e nomi delle policy (dettaglio comportamentale rimandato a Fase 4)

Tutte le tabelle applicative hanno RLS abilitata (verificato: ogni `create table` ha un corrispondente `alter table ... enable row level security`, nessuna tabella applicativa ne è priva).

| Tabella | Policy (nomi) |
|---|---|
| `utenti` | `utenti_select_self_or_admin`, `utenti_update_self_or_admin` |
| `condomini` | `condomini_select`, `condomini_write_admin` |
| `unita` | `unita_select`, `unita_write_admin` |
| `unita_proprietari` | `unita_proprietari_select`, `unita_proprietari_write_admin` |
| `assemblee` | `assemblee_select`, `assemblee_write_admin` |
| `punti_odg` | `punti_odg_select`, `punti_odg_write_admin` |
| `voti` | `voti_select`, `voti_insert_condomino` (ridefinita più volte), `voti_update_admin`, `voti_update_condomino` (aggiunta dopo), `voti_delete_admin` |
| `spese` | `spese_select`, `spese_write_admin` |
| `ripartizioni` | `ripartizioni_select`, `ripartizioni_write_admin` |
| `presenze` | `presenze_select`, `presenze_insert_condomino`, `presenze_update_admin`, `presenze_delete_admin` |
| `deleghe` | `deleghe_select`, `deleghe_insert_condomino`, `deleghe_write_admin`, `deleghe_delete` |
| `import_batches` | `import_batches_select`, `import_batches_write_admin` |
| `tabelle_millesimali` | `tabelle_millesimali_select`, `tabelle_millesimali_write_admin` |
| `valori_millesimali` | `valori_millesimali_select`, `valori_millesimali_write_admin` |
| `anagrafiche` | `anagrafiche_select`, `anagrafiche_write_admin` |
| `firme_verbale` | `firme_verbale_admin` (unica policy: il flusso pubblico di conferma passa sempre dal client service-role, mai dalla sessione anonima) |
| `sondaggi` | `sondaggi_select`, `sondaggi_write_admin` |
| `sondaggio_opzioni` | `sondaggio_opzioni_select`, `sondaggio_opzioni_write_admin` |
| `sondaggio_risposte` | `sondaggio_risposte_select`, `sondaggio_risposte_insert`, `sondaggio_risposte_update`, `sondaggio_risposte_delete` |
| `fornitori` | `fornitori_select`, `fornitori_write_admin` |
| `manutenzioni_programmate` | `manutenzioni_select`, `manutenzioni_write_admin` |
| `segnalazioni` | `segnalazioni_select`, `segnalazioni_insert`, `segnalazioni_update_admin`, `segnalazioni_delete` |
| `segnalazione_note` | `segnalazione_note_select`, `segnalazione_note_insert`, `segnalazione_note_delete` |
| `documenti_condominio` | `documenti_condominio_select`, `documenti_condominio_write_admin` |
| `spazi_comuni` | `spazi_comuni_select`, `spazi_comuni_write_admin` |
| `prenotazioni_spazi` | `prenotazioni_select`, `prenotazioni_insert`, `prenotazioni_update`, `prenotazioni_delete` |
| `preferenze_notifiche` | `preferenze_notifiche_select`, `preferenze_notifiche_write` |
| `solleciti` | `solleciti_select`, `solleciti_write_admin` |
| `movimenti_bancari` | `movimenti_bancari_admin` (unica policy) |
| `condizioni_sicurezza_parti_comuni` | `condizioni_sicurezza_select` (admin del condominio + condòmini dello stabile), `condizioni_sicurezza_write_admin` |
| `tentativi_autenticazione` | **nessuna policy, di proposito**: RLS attiva e zero policy = tabella irraggiungibile da `anon` e `authenticated` (privilegi anche revocati esplicitamente). È l'unico modo per un contatore che deve funzionare dove una sessione utente non esiste ancora; un utente che potesse scriverla azzererebbe il proprio rate limiter. Verificato in `tests/isolamento-tenant.test.ts` |
| `storage.objects` (bucket documenti) | `documenti_select`, `documenti_insert_admin`, `documenti_delete_admin` (definite due volte nel file, in due migrazioni successive) |

Nota metodologica per la Fase 4: diverse policy (es. `voti_insert_condomino`, `utenti_select_self_or_admin`) sono **ridefinite più volte** nel file via `drop policy [if exists]` + `create policy`. La mappa sopra elenca i nomi distinti; la verifica di *quale condizione sia effettivamente in vigore* richiede di seguire l'ordine delle righe nel file (l'ultima definizione vince) — lavoro da fare in Fase 4, non anticipato qui.

---

## 4. Dipendenze (`package.json`)

**Produzione**: `@supabase/ssr` ^0.12.1, `@supabase/supabase-js` ^2.110.3, `exceljs` ^4.4.0, `lucide-react` ^1.24.0, `next` 16.2.10, `papaparse` ^5.5.4, `pdf-lib` ^1.17.1, `react`/`react-dom` 19.2.4, `react-markdown` ^10.1.0, `remark-gfm` ^4.0.1, `resend` ^6.18.1, `stripe` ^22.4.0.

**Sviluppo**: `@tailwindcss/postcss` ^4, `@types/node` ^20, `@types/papaparse` ^5.5.2, `@types/react` ^19, `@types/react-dom` ^19, `eslint` ^9, `eslint-config-next` 16.2.10, `tailwindcss` ^4, `typescript` ^5, `vitest` ^4.1.11.

Nota: secondo `AGENTS.md` questa installazione di Next.js/React/ecosistema è volutamente diversa da quella nota (versioni e convenzioni possono non corrispondere a quanto mi aspetterei normalmente). Non segnalo quindi come "anomalia" il fatto che i numeri di versione risultino più avanzati di quanto mi aspetterei: verificarne il comportamento reale leggendo `node_modules/next/dist/docs/` è compito delle fasi successive dove il comportamento di una API specifica sia rilevante, non di questa ricognizione. Nessuna dipendenza con vulnerabilità note è stata verificata in questa fase (nessun audit di sicurezza eseguito: rimandato, se richiesto, a Fase 1/5).

Non ci sono librerie di validazione schema (es. zod) né ORM: l'accesso dati passa per il client `@supabase/supabase-js` con query builder e, per i file PDF, `pdf-lib` puro (nessun Chromium/Puppeteer — scelta motivata esplicitamente nel commento di `src/lib/documenti/pdf.ts` per compatibilità con l'ambiente serverless Vercel).

---

## 5. Variabili d'ambiente

Da `.env.local.example` + ricerca esaustiva di `process.env.*` in `src/` e `supabase/`:

| Variabile | Uso verificato | Pubblica (`NEXT_PUBLIC_*`) |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client Supabase (browser, server, proxy) | sì |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client Supabase (browser, server, proxy) — soggetto a RLS | sì |
| `SUPABASE_SERVICE_ROLE_KEY` | `src/lib/supabase/service.ts`: bypassa RLS. Usato in `admin/utenti/actions.ts` (impersonazione), webhook Stripe, flusso `firma-verbale` | no (server-only) |
| `STRIPE_SECRET_KEY` | `src/lib/stripe.ts` (creazione client Stripe, lazy) | no |
| `STRIPE_WEBHOOK_SECRET` | Verifica firma webhook Stripe | no |
| `RESEND_API_KEY` | `src/lib/resend.ts` (invio email transazionali) | no |
| `AVVISI_EMAIL_TEST` | Trovata in uso ma non documentata in `.env.local.example`; non ancora letto il punto esatto d'uso — da verificare in Fase 1/3 | non verificato se pubblica |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | `src/components/turnstile-widget.tsx`, `src/app/registrazione/page.tsx`: captcha opzionale in registrazione, **non presente in `.env.local.example`** | sì |
| `NODE_ENV` | Standard Next.js | — |

Osservazione: due variabili usate nel codice (`AVVISI_EMAIL_TEST`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`) **non compaiono** in `.env.local.example`, che quindi non è completo rispetto a ciò che il codice legge davvero. Non risulta nel codice una variabile per il secret server-side di Cloudflare Turnstile (`TURNSTILE_SECRET_KEY` o simile): la verifica del captcha token è delegata interamente a Supabase Auth (il token viene passato come `captchaToken` a `supabase.auth.signUp`), quindi il secret, se esiste, è configurato nel progetto Supabase stesso e non in questa app — coerente con quanto letto in `src/app/registrazione/actions.ts`.

---

## 6. Script di build e deploy

Da `package.json`: `dev` (`next dev`), `build` (`next build`), `start` (`next start`), `lint` (`eslint`), `test` (`vitest run`).

- `next.config.ts`: imposta `turbopack.root` e `experimental.serverActions.bodySizeLimit = "4mb"` (coerente con upload di file nei wizard di import e negli allegati).
- `vitest.config.mts`: alias `@/*` → `src/*` e un alias dedicato per il marcatore `server-only` (altrimenti i moduli che lo importano non sarebbero testabili fuori da Next). Test limitati a `src/**/*.test.ts` (nessun test `.tsx`/componente rilevato).
- `eslint.config.mjs`: usa i preset `eslint-config-next` (core-web-vitals + typescript), nessuna regola custom aggiuntiva.
- **Nessuna pipeline CI** trovata: non esiste una cartella `.github/workflows`, né altri file YAML di CI a livello di repo (verificato con una ricerca che non ha prodotto risultati). Il deploy risulta quindi affidato all'integrazione Git↔Vercel (`.vercel/project.json` conferma un progetto Vercel collegato) senza check automatici (lint/test/build) eseguiti su push/PR a meno che non siano configurati lato dashboard Vercel (non verificabile da qui).
- **Nessuna migration pipeline per il database**: come già notato al punto 1, l'aggiornamento schema è manuale (copia-incolla in Supabase SQL Editor), non scriptato né versionato con un tool di migrazione (es. Supabase CLI `supabase migration`).
- `supabase/seed-demo.sql` è pensato per essere eseguito una sola volta (idempotente per presenza del condominio demo) via SQL Editor, non da uno script applicativo.

---

## 7. Mappa feature → file

Per ciascuna feature: pagine/route, server actions, componenti, logica di libreria, eventuali route API/route handler. Elenco basato sulla lettura effettiva dei file (header di commento + firme), non solo sui nomi.

### 7.1 Autenticazione, ruoli, sessione
- Pagine: `src/app/login/*`, `src/app/registrazione/*`, `src/app/recupera-password/*`, `src/app/reimposta-password/page.tsx`, `src/app/logout/actions.ts`
- Middleware: `src/proxy.ts` (refresh sessione + redirect in base a route pubbliche/private)
- DAL: `src/lib/supabase/dal.ts` (`getUtenteCorrente`, `richiedeUtente`, `richiedeAmministratore`)
- DB: trigger `handle_new_user`, `blocca_cambio_ruolo_non_autorizzato`; tabella `utenti`
- Captcha: `src/components/turnstile-widget.tsx`, verifica delegata a Supabase Auth

### 7.2 Multi-tenancy condomìni / unità / anagrafiche
- Pagine admin: `src/app/admin/condomini/**`, `src/app/admin/unita/[id]/**`
- Actions: `src/app/admin/condomini/actions.ts`, `src/app/admin/unita/[id]/actions.ts`
- DB: `condomini.amministratore_id`, helper RLS `appartiene_condominio`, `possiede_unita`; tabelle `anagrafiche`, `tabelle_millesimali`, `valori_millesimali`, `condizioni_sicurezza_parti_comuni`
- Lib: `src/lib/anagrafe.ts` (dati minimi del registro di anagrafe ex art. 1130 n. 6 c.c.: normalizzazione/validazione del codice fiscale, dati catastali)

### 7.3 Spese e ripartizioni
- Pagine: `src/app/admin/spese/**` (elenco ordinabile: `elenco-spese.tsx`)
- Actions: `src/app/admin/spese/actions.ts`, `src/app/admin/spese/[id]/actions.ts`
- Condòmino: `src/app/area-riservata/elenco-ripartizioni.tsx`
- DB: `spese`, `ripartizioni`

### 7.4 Pagamento online (Stripe)
- UI: `src/app/area-riservata/pagamento-button.tsx`
- Server action: `src/app/area-riservata/actions.ts` (`avviaPagamento`: crea Checkout Session, salva `stripe_checkout_session_id`)
- Webhook: `src/app/api/stripe/webhook/route.ts` (su `checkout.session.completed`, marca `ripartizioni.stato_pagamento = 'pagato'` via client service-role)
- Lib: `src/lib/stripe.ts`

### 7.5 Assemblee, ordine del giorno, voto, quorum, deleghe
- Admin: `src/app/admin/assemblee/**` (dettagli, punti OdG, presenze, firme verbale, link videoconferenza, stato assemblea, upload verbale, generazione documenti via `documenti/route.ts`)
- Condòmino: `src/app/area-riservata/assemblee/**` (voto, delega/revoca delega)
- Lib: `src/lib/quorum.ts` (soglie art. 1136 c.c.), `src/lib/deleghe.ts` (limite art. 67 disp. att. c.c., verificato via RPC `condominio_conteggio_unita`/`condominio_millesimi_totali`/`deleghe_riepilogo_delegato`)
- DB: `assemblee`, `punti_odg`, `voti`, `presenze`, `deleghe`

### 7.6 Firma OTP del verbale
- Pubblico: `src/app/firma-verbale/[token]/**` (page, `modulo-conferma.tsx`, `actions.ts`)
- Admin: `src/app/admin/assemblee/[id]/firme-verbale-card.tsx`
- Lib: `src/lib/firma-otp.ts` (hash SHA-256 di `token:codice`, `timingSafeEqual`, validità 15 minuti, max 5 tentativi; disclaimer esplicito: **non è una firma elettronica con valore legale FEA/eIDAS**, solo tracciamento)
- DB: `firme_verbale` (RLS: unica policy `firme_verbale_admin`, il flusso pubblico passa dal client service-role)

### 7.7 Documenti legali generati (convocazione, verbale, rendiconto, stato patrimoniale, sollecito)
- Lib modello: `src/lib/documenti/modello.ts` (blocchi tipizzati, indipendenti dal formato)
- Lib render PDF: `src/lib/documenti/pdf.ts` (pdf-lib, font standard Helvetica/WinAnsi)
- Rendiconto (art. 1130-bis c.c., tripartizione registro/riepilogo/nota + stato ripartizione): `src/lib/documenti/rendiconto.ts`, dati in `src/lib/documenti/rendiconto-dati.ts` (condivisi fra le due aree), download via `src/app/admin/condomini/[id]/rendiconto/route.ts` e `src/app/area-riservata/condominio/[id]/rendiconto/route.ts`
- Stato patrimoniale unità (art. 63 disp. att. c.c., tre fasce temporali): `src/lib/documenti/stato-patrimoniale.ts`, dati in `src/lib/documenti/stato-patrimoniale-dati.ts`, download via `src/app/admin/unita/[id]/stato-patrimoniale/route.ts` e `src/app/area-riservata/unita/[id]/stato-patrimoniale/route.ts`
- Sollecito (3 livelli): `src/lib/documenti/sollecito.ts`, dati in `src/app/admin/solleciti/sollecito-dati.ts`, download via `src/app/admin/solleciti/[unitaId]/route.ts`
- Convocazione/verbale assemblea: dati in `src/app/admin/assemblee/[id]/documenti-dati.ts`, download via `src/app/admin/assemblee/[id]/documenti/route.ts`
- I Route Handler di download lato admin verificano solo `ruolo === 'amministratore'`; l'isolamento per condominio/unità è delegato alla RLS sulle query a monte (documentato esplicitamente nei commenti dei singoli `route.ts`)
- I due Route Handler lato condòmino (rendiconto, stato patrimoniale) chiamano `richiedeUtente()` e poi verificano esplicitamente `appartiene_condominio()` / `possiede_unita()` con una query vera, oltre alla RLS e al controllo interno delle funzioni `security definer`: l'id sta nell'URL, e su quei documenti un controllo ridondante vale più di un commento

### 7.8 Morosità e solleciti
- Admin: `src/app/admin/solleciti/**` (`genera-sollecito-button.tsx`, `actions.ts`, pagina elenco)
- Lib: `src/lib/solleciti.ts` (3 livelli, calcolo ritardo su date-stringa per evitare bug di fuso orario, riferimento art. 1129 c.c. comma 9 per il decreto ingiuntivo)
- DB: `solleciti`

### 7.9 Riconciliazione bancaria (CSV)
- Admin: `src/app/admin/riconciliazione/**` (`carica-estratto.tsx`, `azioni-movimento.tsx`, `actions.ts`)
- Lib: `src/lib/riconciliazione.ts` (parsing CSV tollerante a formati italiani/inglesi, abbinamento automatico solo se univoco, nessuna scrittura automatica)
- DB: `movimenti_bancari` (RLS: unica policy `movimenti_bancari_admin`)
- Limite noto e documentato in `IDEE-FUTURE.md`: abbinamento solo 1:1, nessun pagamento parziale/cumulativo

### 7.10 Segnalazioni (ticket di manutenzione)
- Admin: `src/app/admin/segnalazioni/**` (`gestione-segnalazione.tsx`)
- Condòmino: `src/app/area-riservata/segnalazioni/**` (apertura, ritiro)
- Componenti condivisi: `src/components/segnalazioni/elenco-note.tsx`, `nota-form.tsx`
- Lib: `src/lib/segnalazioni.ts` (etichette, ordinamento per urgenza)
- DB: `segnalazioni`, `segnalazione_note` (flag `interna` per note non visibili al condòmino)

### 7.11 Fornitori e manutenzioni programmate
- Admin: `src/app/admin/manutenzioni/**` (`fornitore-form.tsx`, `manutenzione-form.tsx`, azioni dedicate)
- Lib: `src/lib/manutenzioni.ts` (scadenzario, rinnovo automatico se periodica, confronto date come stringhe calendario)
- DB: `fornitori`, `manutenzioni_programmate`

### 7.12 Sondaggi/consultazioni rapide
- Admin: `src/app/admin/sondaggi/**`
- Condòmino: `src/app/area-riservata/sondaggi/**`
- Componente: `src/components/risultati-sondaggio.tsx`
- Lib: `src/lib/sondaggi.ts` (risultato per teste o pesato sui millesimi, soglia max 8 opzioni, nessun valore legale)
- DB: `sondaggi`, `sondaggio_opzioni`, `sondaggio_risposte`

### 7.13 Spazi comuni e prenotazioni
- Admin: `src/app/admin/spazi/**`
- Condòmino: `src/app/area-riservata/spazi/**` (`prenota-form.tsx`, `annulla-button.tsx`)
- Lib: `src/lib/prenotazioni.ts` (orari come "orologio da parete", fuso condominio non fuso server; controllo sovrapposizione duplicato lato codice + trigger DB)
- DB: `spazi_comuni`, `prenotazioni_spazi`

### 7.14 Calendario condominiale
- Admin: `src/app/admin/calendario/page.tsx`
- Condòmino: `src/app/area-riservata/calendario/page.tsx`
- Componente: `src/components/calendario/vista-calendario.tsx`
- Lib: `src/lib/calendario.ts` (aggrega assemblee, manutenzioni, prenotazioni, scadenze pagamento — nessuna scrittura propria)

### 7.15 Archivio documenti condominio
- Admin: `src/app/admin/documenti/**`
- Condòmino: `src/app/area-riservata/documenti/page.tsx`
- Lib: `src/lib/archivio.ts`
- DB: `documenti_condominio` + storage bucket (policy `documenti_select/insert_admin/delete_admin` su `storage.objects`)

### 7.16 Notifiche (preferenze email)
- Condòmino: `src/app/area-riservata/notifiche/**` (`preferenze-form.tsx`, `actions.ts`)
- Lib decisionale: `src/lib/notifiche.ts` (modello opt-out, tipo evento come colonna testo libero non enum)
- Lib di invio: `src/lib/notifiche-invio.ts` (separazione esplicita tra "va spedita?" e invio vero tramite Resend)
- Mailer: `src/lib/resend.ts` (mittente attualmente `onboarding@resend.dev`, sandbox Resend — dominio mittente non ancora verificato, da riscontrare in Fase 3/5)
- DB: `preferenze_notifiche`

### 7.17 Import massivo (condomìni/unità, unità, spese storiche)
- Admin: `src/app/admin/importa/**` (pagina indice + tre wizard dedicati con step upload→mappatura→anteprima→conferma)
- Componenti condivisi: `src/components/import/*` (`guscio-wizard.tsx`, `indicatore-fasi.tsx`, `passo-carica-file.tsx`, `passo-mappatura.tsx`, `tabella-anteprima.tsx`, `annulla-importazione-button.tsx`)
- Lib: `src/lib/import/*` (analisi file con ExcelJS/PapaParse, mappatura campi, coercizione tipi, collasso righe, calcolo millesimi, qualifica soggetto, validazione — ciascuno con test dedicato)
- DB: `import_batches`, funzione `importa_spese_storiche` (non security-definer: gira con i privilegi/RLS del chiamante)
- Cronologia: `src/app/admin/importa/cronologia-actions.ts`

### 7.18 Gestione utenti e impersonazione ("Visualizza come")
- Admin: `src/app/admin/utenti/**` (`elenco-utenti.tsx`, `riga-utente.tsx`, `actions.ts`)
- Lib: `src/lib/impersonazione.ts` (tipo `SessioneImpersonazione`, cookie httpOnly `admin_return_session`)
- Banner: `src/app/area-riservata/impersonazione-banner.tsx`
- Meccanismo verificato: `visualizzaComeCondomino` genera una sessione reale per il condòmino target (necessaria perché molte policy RLS richiedono `utente_id = auth.uid()`, non simulabile restando autenticati come amministratore), salva la sessione admin originale in un cookie httpOnly per il ripristino

### 7.19 Esportazione completa dei dati di un condominio (CONT-02)
- Admin: pulsante in `src/app/admin/condomini/[id]/esporta-dati-button.tsx` (sezione "Gestione avanzata" della scheda condominio), download via `src/app/admin/condomini/[id]/esportazione/route.ts`
- Raccolta dati e ZIP: `src/app/admin/condomini/[id]/esportazione-dati.ts` (`jszip`, nessuna dipendenza nativa); parte pura (serializzazione CSV, nomi di file, testo del LEGGIMI, divisione in blocchi) in `src/lib/esportazione.ts` con `src/lib/esportazione.test.ts`
- Contenuto: 27 CSV (`dati/*.csv`, separatore `;` + BOM UTF-8), i documenti dello storage divisi in `documenti/{archivio,spese,assemblee,segnalazioni}/`, un `LEGGIMI.txt` con indice e disclaimer su art. 10.1.a DPA / art. 1130-bis c.c.
- Escluse di proposito: `utenti` e `preferenze_notifiche` (non sono dati del condominio); su `firme_verbale` sono escluse `token`/`otp_hash`/`otp_scadenza`/`otp_tentativi` (credenziali del link pubblico di firma)
- Nessuna RPC nuova e nessuna migrazione SQL: l'amministratore ha già accesso RLS diretto a tutte le tabelle del proprio condominio, si usano select dirette
- Autorizzazione: `ruolo === 'amministratore'` + **query vera** su `condomini` filtrata insieme su `id` e `amministratore_id = auth.uid()` prima di qualunque lettura, + RLS su ogni tabella e policy `documenti_select` sullo storage. Regressione in `tests/isolamento-tenant.test.ts` ("CONT-02: un amministratore non può esportare il condominio di un altro amministratore"), comprese le letture di storage

### 7.20 Limite ai tentativi di autenticazione (COD-05)
- Logica pura (soglie, finestre, messaggi, costruzione della chiave, lettura dell'IP dagli header): `src/lib/limite-tentativi.ts` con `src/lib/limite-tentativi.test.ts`
- Scrittura del contatore: `src/lib/limite-tentativi-registra.ts` (`server-only`, client service-role, due RPC); tabella `tentativi_autenticazione` + funzioni in fondo a `supabase/schema.sql`
- Applicato a: `src/app/login/actions.ts` (5 tentativi / 10 min per email+IP, azzerati da un accesso riuscito), `src/app/recupera-password/actions.ts` (3 / 10 min per email+IP), `src/app/firma-verbale/[token]/actions.ts` → `richiediCodice` (5 / 30 min per token+IP **e** 20 / 60 min per solo IP, che è il tetto al costo degli invii quando un attaccante gira fra token diversi). Il throttle di 60 s per riga `firme_verbale` e `OTP_MAX_TENTATIVI = 5` sulla *verifica* del codice restano dove erano: limitano cose diverse
- Comportamento in caso di guasto: **fail-open** con `console.error` — un contatore rotto non deve chiudere fuori dal portale tutti i condòmini (scelta dichiarata nel commento del modulo)
- Limite noto: la chiave email+IP non ferma un attacco distribuito su molti IP; la scelta è deliberata, perché un contatore sulla sola email permetterebbe a chiunque di tenere fuori dal portale un condòmino a comando

### 7.21 Validazione del tipo reale dei file caricati (COD-06)
- Logica pura (riconoscimento dai magic bytes, allowlist, MIME ed estensione canonici): `src/lib/tipi-file.ts` con `src/lib/tipi-file.test.ts`. Nessuna libreria nuova: sette firme scritte a mano invece di `file-type` (ESM-only, tre dipendenze transitive, cento formati inutili qui)
- Punti di upload coperti: archivio documenti (`src/app/admin/documenti/actions.ts`, PDF + immagini + documenti Office), verbale caricato a mano (`src/app/admin/assemblee/[id]/actions.ts`), documento di spesa (`src/app/admin/spese/[id]/actions.ts`), foto di una segnalazione (`src/app/area-riservata/segnalazioni/actions.ts`, solo immagini)
- In tutti e quattro: `contentType` dell'upload e `mime_type` salvato vengono dal contenuto, non da `file.type`; anche l'estensione del percorso nello storage è quella canonica del formato riconosciuto, non quella del nome caricato
- Non toccati di proposito: gli import .xlsx/.csv del wizard (il file non arriva al server, ci arrivano le righe già lette — COD-08) e l'estratto conto della riconciliazione, che arriva come testo e la cui struttura è già validata da `parseEstrattoContoCsv`; lì è stato aggiunto il solo controllo che mancava, il tetto di dimensione lato server (`MAX_CARATTERI_CSV`)

---

## Riepilogo per chi dà il via libera alla Fase 1

Repo coerente e ben documentata nei commenti (molti riferimenti normativi espliciti e verificabili: art. 1136, 1129, 1130-bis, 67/63 disp. att. c.c.). Due aspetti strutturali da tenere a mente già da ora, non ancora valutati in termini di gravità (lo saranno in Fase 1/4):

1. `supabase/schema.sql` è un log di migrazioni cumulativo con policy ridefinite più volte, non uno schema dichiarativo — la "versione vigente" di una policy è quella più in basso nel file.
2. Nessuna pipeline CI e nessun migration runner per il DB: sia il deploy applicativo (oltre a Vercel) sia l'aggiornamento schema sono processi manuali non scriptati/versionati in modo tracciabile.

Non sono stati modificati né creati altri file oltre a questo.
