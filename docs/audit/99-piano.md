# Piano — tutti i rilievi ordinati per impatto/sforzo

> Base: i 6 documenti di audit (`00-mappa.md` … `05-dipendenze-continuita-mercato.md`),
> **riletti per intero in questa fase** per riportare fedelmente ogni id e
> gravità, non ricostruiti a memoria. Non è stato toccato nessun file fuori
> da `docs/audit/`.
>
> **Stato alla data di questo piano**: `THREAT-01` (Fase 4 — impersonazione
> amministratore→condòmino senza verifica reale di appartenenza, con
> sessione impersonata non revocata), il rilievo più grave di tutto
> l'audit, **è già stato RISOLTO** in questa sessione dopo la pubblicazione
> della Fase 4, con un correttivo in `src/app/admin/utenti/actions.ts` e
> `src/lib/impersonazione.ts`, già deployato. Non rientra quindi nella
> sequenza di interventi da pianificare sotto — resta visibile qui solo per
> completezza dello storico e perché **THREAT-03** (assenza di test di
> isolamento tenant) è la ragione strutturale per cui quel bug non è stato
> intercettato prima, ed è tuttora aperto: il collegamento tra i due è
> trattato esplicitamente più sotto. **Tutti gli altri rilievi di tutte le
> fasi sono ancora aperti.**

---

## 1. Rilievi collegati — da trattare insieme, non come voci indipendenti

Prima di ordinare, i casi in cui due rilievi di fasi diverse sono in
realtà la stessa causa vista da due angoli, o l'uno è la ragione per cui
l'altro è potuto accadere:

1. **COD-01 (Fase 1) ≡ THREAT-04 (Fase 4)** — stesso identico rilievo
   (`src/lib/supabase/service.ts` senza `import "server-only"`), segnalato
   due volte perché la Fase 4 lo ha riverificato puntualmente dopo aver
   analizzato i 5 usi della service-role key. **Nel piano conta come una
   sola voce**, non due.
2. **THREAT-03 (Fase 4) + COD-10 (Fase 1)** — COD-10 è il rilievo generale
   ("nessun test di integrazione/e2e, solo logica pura testata"); THREAT-03
   è la sua istanza più grave e specifica ("nessun test dimostra
   l'isolamento tra tenant"). **THREAT-01 (risolto) è la prova concreta che
   quel gap ha lasciato passare un buco reale**: senza quel genere di test,
   un domani una modifica a una policy RLS — che nello storico di
   `schema.sql` sono già state riscritte più volte — potrebbe reintrodurre
   un problema simile senza che nulla lo segnali prima della produzione.
   Trattati insieme, con THREAT-03 che guida la priorità (più specifico e
   più urgente) e COD-10 come suo naturale completamento.
3. **COD-09 (Fase 1, nessun logging) + FEAT-09 (Fase 3, nessuna data
   certa/audit trail per i documenti legali)** — FEAT-09 richiama
   esplicitamente COD-09 come causa comune: senza logging/audit trail
   applicativo, non solo manca l'osservabilità operativa, manca anche la
   base minima su cui costruire una qualsiasi forma di tracciabilità delle
   modifiche ai documenti ufficiali (verbali, rendiconti, convocazioni).
4. **FEAT-01 (Fase 3) + il rilievo di mercato "registro anagrafe
   incompleto" (Fase 5)** — stesso gap (campi minimi dell'art. 1130 n. 6
   c.c. assenti dal modello dati), scoperto due volte in modo indipendente:
   una volta leggendo lo schema, una volta leggendo cosa i concorrenti
   dichiarano come standard. La seconda non aggiunge un difetto nuovo, ma
   **alza la priorità** della prima: è un gap competitivo, non solo
   normativo.
5. **FEAT-02 + FEAT-03 (Fase 3) + CONT-02 (Fase 5)** — stessa famiglia:
   documenti che il condòmino ha diritto di consultare/estrarre (rendiconto,
   tabelle millesimali, stato patrimoniale) o che l'amministratore deve
   poter esportare in blocco alla cessazione del servizio. Tecnicamente
   condividono la stessa RLS già pronta e lo stesso pattern di generazione
   documenti: ha senso disegnarli come un unico intervento sull'area
   riservata del condòmino e sull'export, non come tre task scollegati.
6. **DEP-03 (`pdf-lib` abbandonato) è l'infrastruttura comune dietro
   FEAT-02, FEAT-04, FEAT-09** — rendiconto, convocazione, verbale e
   sollecito sono tutti generati dalla stessa libreria PDF ferma da 4 anni:
   non è un rilievo isolato di dipendenze, è un rischio di continuità per
   l'intera famiglia di feature "documenti legali".
7. **COD-02 (errori DB grezzi) viene richiamato nella nota Nielsen #9 di
   Fase 2** — non è un rilievo duplicato, ma la stessa causa tecnica incide
   sia sulla sicurezza/information disclosure (Fase 1) sia sulla qualità
   percepita dei messaggi d'errore (Fase 2): un solo intervento (COD-02)
   risolve entrambi gli aspetti.
8. **SITO-05 (Fase 2, nessuna dichiarazione di accessibilità) dipende da
   una valutazione legale non ancora fatta**, esplicitamente rimandata
   dalla stessa Fase 2 alla Fase 3, che a sua volta l'ha rimandata senza
   deciderla (vedi "Fuori perimetro" di Fase 3): resta un'azione bloccata
   su una decisione legale esterna, non su un intervento tecnico.

---

## 2. Tutti i rilievi aperti, elencati per fase (riferimento rapido)

| Fase | ID | Titolo sintetico | Gravità |
|---|---|---|---|
| 1 | COD-01 / THREAT-04 | `service.ts` senza guardrail `server-only` | alta |
| 1 | COD-02 | Errori DB grezzi esposti all'utente | media |
| 1 | COD-03 | Nessun tipo `Database` generato per Supabase | media |
| 1 | COD-04 | Incoerenza controlli applicativi di ruolo | bassa |
| 1 | COD-05 | Nessun rate limiting | media |
| 1 | COD-06 | Nessuna validazione MIME upload | media |
| 1 | COD-07 | FK senza indice dedicato | bassa |
| 1 | COD-08 | ExcelJS/PapaParse lato client | bassa |
| 1 | COD-09 | Nessun logging/observability | media |
| 1 | COD-10 | Copertura test limitata a logica pura | bassa |
| 2 | SITO-01 | Pagine auth senza titolo proprio (WCAG 2.4.2, livello A) | media |
| 2 | SITO-02 | Nessun robots.txt/sitemap.xml | media |
| 2 | SITO-03 | Nessun Open Graph/dato strutturato | bassa |
| 2 | SITO-04 | Asset scaffold Next.js inutilizzati | bassa |
| 2 | SITO-05 | Nessuna dichiarazione di accessibilità | bassa |
| 2 | SITO-06 | `iconOnly` non vincolato a `aria-label` a livello di tipo | bassa |
| 3 | FEAT-01 | Registro anagrafe condominiale incompleto (art. 1130 n. 6 c.c.) | alta |
| 3 | FEAT-02 | Rendiconto non accessibile al condòmino | alta |
| 3 | FEAT-03 | Tabelle millesimali/stato patrimoniale non accessibili al condòmino | bassa |
| 3 | FEAT-04 | Email convocazione incompleta, nessun riscontro di consegna | media |
| 3 | FEAT-05 | Registrazione senza link all'informativa privacy (art. 13 GDPR) | media |
| 3 | FEAT-06 | DPA sovrastima tabelle/policy RLS | media |
| 3 | FEAT-07 | Nessuna pagina "Termini e condizioni d'uso" | media |
| 3 | FEAT-08 | Riferimento a file inesistente nelle bozze legali | bassa |
| 3 | FEAT-09 | Nessuna data certa per documenti legali | bassa |
| 3 | FEAT-10 | Pagamento con carta vs. tracciabilità fiscale | bassa (verifica legale) |
| 4 | THREAT-01 | Impersonazione senza verifica di appartenenza | **RISOLTO** |
| 4 | THREAT-02 | Rassegna service-role key | informativa (chiuso con THREAT-01) |
| 4 | THREAT-03 | Nessun test di isolamento tenant | alta |
| 4 | THREAT-04 | = COD-01 | alta (vedi sopra) |
| 5 | DEP-01 | `next`: vulnerabilità critica, fix disponibile | alta |
| 5 | DEP-02 | `exceljs`→`uuid` vulnerabile, nessun fix diretto | media |
| 5 | DEP-03 | `pdf-lib` abbandonato (4 anni) | alta |
| 5 | DEP-04 | `exceljs` stagnante (2 anni) | media |
| 5 | CONT-01 | Nessuna strategia di backup/DR verificabile | alta |
| 5 | CONT-02 | Nessuna funzione di esportazione completa | media |
| 5 | (mercato) | Registro anagrafe — conferma esterna di FEAT-01 | vedi FEAT-01 |
| 5 | (mercato) | Nessuna app mobile nativa | iniziativa di prodotto, non bug |
| 5 | (mercato) | Nessuna firma digitale con valore legale pieno | vedi FEAT-09/IDEE-FUTURE |

---

## 3. Sequenza di interventi proposta

Criterio: rapporto impatto/sforzo, con i collegamenti della sezione 1
applicati (un blocco unico quando ha senso farlo insieme). Non è una lista
piatta: è organizzata in blocchi di lavoro coerenti, pensati come
iterazioni successive.

### Blocco A — Correzioni immediate a costo quasi nullo (1-3 giorni di lavoro)

Il criterio qui è puramente lo sforzo: sono modifiche di poche righe, a
basso rischio di regressione, che vale la pena fare prima di qualsiasi
altra pianificazione.

1. **COD-01 / THREAT-04** — aggiungere `import "server-only";` a
   `src/lib/supabase/service.ts`. Impatto potenziale altissimo (è il
   guardrail sul modulo più sensibile del progetto), sforzo di una riga.
   Il rapporto impatto/sforzo più favorevole di tutto l'audit dopo
   THREAT-01, e va fatto prima di qualunque refactor che tocchi quell'area.
2. **DEP-01** — aggiornare `next` a `16.4.3`. Fix minor non-breaking per
   una vulnerabilità critica su una dipendenza di produzione: non c'è
   motivo di rimandarlo. Da fare insieme a un giro di `npm test`/smoke test
   manuale prima del deploy, non alla cieca.
3. **SITO-01** — aggiungere `metadata` a `/login`, `/registrazione`,
   `/recupera-password`, `/reimposta-password`. Quattro `export const
   metadata` da 2 righe ciascuno; risolve una violazione WCAG di **livello
   A** (il più basso della scala, quindi il più "ovvio" da avere a posto).
4. **FEAT-05** — una riga con link a `/privacy` nella pagina di
   registrazione. Risolve un obbligo GDPR puntuale (art. 13) con lo sforzo
   minimo possibile.
5. **FEAT-06** — correggere la cifra sbagliata in `legale/dpa-BOZZA.md`
   ("29 tabelle, circa 70 politiche" invece di "oltre 40"/"più di 140").
   Un numero in un file Markdown; l'impatto è sulla credibilità di un
   documento contrattuale, quindi vale la pena non lasciarlo sbagliato
   anche solo per un giorno in più del necessario.
6. **SITO-04** — rimuovere i 5 SVG di scaffolding inutilizzati da
   `public/`. Zero rischio, zero impatto funzionale, pura pulizia che non
   merita un intervento dedicato più avanti.
7. **COD-07** — aggiungere gli indici FK oggi mancanti
   (`idx_deleghe_delegante`, `idx_deleghe_delegataria`, `idx_voti_utente`,
   ecc.). Non urgente per volume di dati, ma sono `create index` isolate,
   a basso rischio: conviene farle ora, non quando la tabella sarà già
   grande e l'indice richiederà una finestra di manutenzione.
8. **DEP-02** — aggiungere un `overrides` su `uuid` (≥11.1.1) in
   `package.json` per chiudere la vulnerabilità in `exceljs`, verificando
   con i test di import esistenti (`src/lib/import/*.test.ts`) che
   `exceljs` continui a funzionare. Sforzo basso, ma richiede una verifica
   funzionale dopo il cambio, per questo non è in cima al blocco.

### Blocco B — La rete di sicurezza che manca (THREAT-01 non si ripeta)

Priorità alta non perché urgente in sé, ma perché **THREAT-01 ha appena
dimostrato cosa succede senza**. Va aperto subito dopo il Blocco A.

9. **THREAT-03 + COD-10** — introdurre test automatizzati che dimostrino
   l'isolamento tra tenant, almeno sui flussi più sensibili (voti,
   ripartizioni, movimenti bancari, e **specificamente un test per il
   correttivo di THREAT-01**: un amministratore senza condomìni non deve
   poter impersonare un condòmino non suo). Sforzo medio (serve un
   Postgres/Supabase di test), ma è l'unico intervento di questo piano che
   riduce la probabilità di **future** vulnerabilità invece di correggerne
   una già trovata — motivo per cui lo metto immediatamente dopo i quick
   win, non in fondo alla lista.
10. **COD-09** — introdurre logging strutturato minimo e, se possibile,
    un servizio di error tracking sui flussi critici (pagamenti, webhook
    Stripe, firma OTP). Sforzo medio, ma è il prerequisito sia per
    rispondere a un incidente in tempi ragionevoli sia per FEAT-09 (vedi
    sotto) — non ha senso rimandarlo oltre questo blocco.
11. **CONT-01** — verificare (pannello Supabase/Vercel) e documentare la
    strategia di backup/PITR realmente attiva, sostituendo il placeholder
    `[DA VERIFICARE E DOCUMENTARE]` in `legale/dpa-BOZZA.md`. La parte di
    *verifica e documentazione* è a sforzo bassissimo (è solo guardare un
    pannello e scrivere una riga); la aggrego qui, non nel Blocco A, perché
    il suo esito concreto (il piano Supabase ha davvero un PITR adeguato?)
    condiziona se serva anche un `pg_dump` indipendente schedulato — quella
    seconda parte è a sforzo medio e va pianificata solo dopo aver saputo
    cosa manca davvero.

### Blocco C — Conformità normativa delle feature già esistenti

Impatto alto sul piano legale/competitivo, sforzo medio: qui si lavora su
feature che già esistono e già funzionano, ma non coprono tutto ciò che la
legge (e il mercato) si aspetta da loro.

12. **FEAT-01** (+ conferma di mercato in Fase 5) — aggiungere a
    `anagrafiche` i campi `codice_fiscale`/residenza e a `unita` i
    riferimenti catastali, più un punto per le condizioni di sicurezza
    delle parti comuni. Va per primo in questo blocco perché tocca
    direttamente la conformità di una feature che il prodotto presenta
    come "registro di anagrafe condominiale" — ed è anche, secondo la
    ricerca di mercato di Fase 5, un elemento che almeno un concorrente
    gratuito usa come argomento di vendita diretto ("100% conforme
    all'art. 1130-bis c.c.").
13. **FEAT-02 + FEAT-03** — esporre al condòmino, in lettura, il rendiconto
    e (a seguire, sforzo marginale aggiuntivo) le tabelle millesimali/lo
    stato patrimoniale della propria unità, riusando la logica di
    generazione PDF e le policy RLS già pronte. Raggruppati perché la
    seconda parte (FEAT-03) è quasi gratuita una volta fatta la prima.
14. **CONT-02** — funzione di esportazione completa di un condominio (zip
    con CSV + documenti). Segue FEAT-02/03 perché condivide lo stesso tipo
    di logica di raccolta dati per condominio, e assolve contemporaneamente
    un obbligo normativo (conservazione decennale a carico
    dell'amministratore) e una promessa contrattuale già scritta nella
    bozza di DPA.

### Blocco D — Sicurezza applicativa restante

Impatto medio, nessuno di questi è urgente come i blocchi precedenti, ma
sono interventi di sicurezza reali, non solo igiene del codice.

15. **COD-05** — rate limiting su login, recupero password, richiesta OTP.
16. **COD-06** — allowlist del tipo MIME sugli upload (documenti,
    verbali, foto segnalazioni).
17. **COD-02** — centralizzare la traduzione errore→messaggio invece del
    pattern `{ errore: error.message }` ripetuto in 85 punti. Sforzo
    maggiore di quanto sembri (è meccanico ma tocca ~30 file), per questo
    non è nel Blocco A nonostante la semplicità concettuale della
    soluzione.
18. **COD-04** — standardizzare i controlli applicativi di ruolo nelle
    server action. Nessun rischio di sicurezza reale (la RLS copre
    comunque), quindi va fatto quando si è già dentro quei file per il
    punto 17, non come intervento a parte.

### Blocco E — Pagine e contenuti mancanti/da rivedere

Impatto medio, sforzo basso-medio; alcuni punti richiedono input non
tecnico (contenuto legale) prima di poter essere chiusi dal lato codice.

19. **SITO-02** — `robots.ts`/`sitemap.ts`.
20. **SITO-03** — Open Graph sulla home page pubblica.
21. **FEAT-07** — pagina "Termini e condizioni d'uso" (richiede contenuto
    legale da un professionista, non solo codice: lo sforzo tecnico è
    basso, il tempo complessivo dipende da quanto impiega la stesura del
    contenuto).
22. **FEAT-04** — arricchire l'email di convocazione (luogo, ordine del
    giorno quando disponibile) e registrare l'esito dell'invio per
    destinatario. La componente "l'email ordinaria basta legalmente?" resta
    una **verifica legale esplicitamente non risolta da questo piano**:
    l'intervento tecnico può procedere indipendentemente da quella
    risposta (migliorare il contenuto dell'email è comunque corretto),
    ma non la sostituisce.
23. **SITO-05** — dichiarazione di accessibilità: **bloccata** su una
    decisione legale (applicabilità EAA/AgID a questo prodotto, mai presa
    in nessuna delle fasi precedenti). Nessuna azione tecnica fino a quella
    decisione.
24. **FEAT-10** — eventuale avviso contestuale sul pagamento con carta per
    spese potenzialmente detraibili: **bloccato** su una verifica
    fiscale/legale allo stesso modo di SITO-05, sforzo tecnico comunque
    basso una volta decisa la sostanza.

### Blocco F — Manutenibilità e debito tecnico (non urgente, pianificabile con calma)

25. **COD-03** — generare il tipo `Database` di Supabase e passarlo ai
    client. Beneficio progressivo, non un singolo intervento chiuso.
26. **DEP-03** — nessuna azione immediata possibile (non esiste una
    versione più recente di `pdf-lib`): da **monitorare** (se emergesse una
    CVE, o se un fork mantenuto diventasse disponibile) e da tenere
    presente come rischio di continuità per tutta la famiglia di feature
    collegata (vedi sezione 1, punto 6), non da "risolvere" oggi.
27. **DEP-04** — stesso trattamento di monitoraggio per `exceljs`.
28. **COD-08** — spostare il parsing `.xlsx`/`.csv` lato server, solo se
    una misurazione reale del bundle (mai fatta in questo audit) la
    giustifica.
29. **SITO-06** — irrigidire a livello di tipo l'obbligo di `aria-label`
    su `Button iconOnly`.
30. **FEAT-08** — creare `legale/COSA-RESTA-DA-DECIDERE.md` aggregando i
    punti già marcati inline nei tre documenti legali.

### Fuori da questo piano tecnico — iniziative di prodotto (Fase 5, mercato)

Non sono "rilievi" nel senso delle fasi 1-4 (nessun difetto, nessuna
violazione): sono scelte di prodotto, con sforzo che va oltre un singolo
intervento tecnico e richiede una decisione commerciale a monte. Le elenco
per completezza, senza includerle nella numerazione sopra:

- App mobile nativa (iOS/Android) per il condòmino — standard di mercato,
  ma sviluppo ampio.
- Firma digitale con valore legale pieno (FEA/eIDAS tramite provider
  esterno) — già annotato come scelta deliberata e rimandata in
  `IDEE-FUTURE.md`, coerente con FEAT-09.
- Fatturazione elettronica/conservazione sostitutiva, pagamento fornitori
  in uscita, generazione IA dei verbali — gap competitivi reali ma di
  portata (e costo) paragonabile a una nuova feature maggiore ciascuno, non
  a una correzione.

---

Nessun file del progetto è stato modificato in questa fase, a parte la
creazione di questo stesso documento in `docs/audit/99-piano.md`. Il
`CLAUDE.md` alla radice del progetto, ultimo output previsto dall'incarico
completo, non è stato scritto: va richiesto separatamente.
