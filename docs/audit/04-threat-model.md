# Fase 4 — Threat model e isolamento dei dati tra condomìni

> Metodologia per questa fase, diversa dalle precedenti su istruzione
> esplicita del coordinatore: **ho letto per intero `supabase/schema.sql`
> (3105 righe)**, ogni `create policy`, ogni funzione (comprese tutte le
> `security definer`), ogni trigger, e **ciascuno dei 5 punti del codice
> applicativo che importano `createServiceClient`** uno per uno (elencati
> in Fase 1 come lacuna del guardrail `server-only`). Nessun campionamento
> sulla superficie di autorizzazione. Ho poi ragionato in modo avversariale
> costruendo percorsi concreti (query/azioni specifiche, non solo "in
> teoria potrebbe"). Nessun file del progetto è stato modificato: output
> solo in `docs/audit/04-threat-model.md`.
>
> Gravità: **bloccante** / **alta** / **media** / **bassa**.

---

## Avviso prioritario

**THREAT-01, sotto, è sfruttabile ed è il rilievo più grave di tutto
l'audit finora: un utente anonimo che si auto-registra come
"amministratore" (operazione gratuita e senza verifica, già consentita
dal prodotto) può impersonare qualsiasi condòmino di QUALSIASI condominio
della piattaforma — non solo i propri — ogniqualvolta quel condòmino si
trovi, anche temporaneamente, senza un'unità collegata al proprio account.
La sessione ottenuta non viene mai revocata. Dettaglio completo sotto.**

---

## Modello di autorizzazione effettivo (ricostruito dalla lettura integrale)

- **Due ruoli applicativi**: `amministratore`, `condomino` (colonna
  `utenti.ruolo`, vincolata da `check` e protetta da auto-promozione dal
  trigger `blocca_cambio_ruolo_non_autorizzato`).
- **Multi-tenancy tra amministratori**: ogni `condomini` ha un
  `amministratore_id`. Le funzioni `security definer`
  `admin_possiede_condominio`, `admin_gestisce_unita`,
  `admin_gestisce_assemblea`, `admin_gestisce_spesa`, `admin_gestisce_utente`,
  `admin_gestisce_sondaggio`, `admin_gestisce_fornitore`,
  `admin_gestisce_segnalazione`, `admin_gestisce_spazio` sono i soli punti
  in cui si decide se un amministratore ha competenza su una risorsa, e
  **ogni** policy `*_write_admin` di ogni tabella le richiama — verificato
  che non esiste una sola policy di scrittura che usi ancora il vecchio
  controllo "`ruolo_corrente() = 'amministratore'`" da solo, senza scoping
  al condominio (quel pattern esisteva nella prima stesura dello schema ma
  è stato **sovrascritto ovunque** dalla migrazione "multi-tenancy tra
  amministratori", righe 858-1220).
- **Lato condòmino**: `appartiene_condominio` e `possiede_unita`
  (entrambe `security definer`, basate su `unita_proprietari.utente_id =
  auth.uid()`) sono i soli punti che decidono l'appartenenza. Ogni policy
  `*_select` rivolta al condòmino le richiama.
- **29 tabelle, tutte con RLS abilitata** (nessuna eccezione — verificato
  contando `create table` e `enable row level security`: 29 e 29).
- **Nessuna select o funzione, tra quelle lette, perde il filtro di
  tenant tramite un join**: ogni `join` dentro una funzione `security
  definer` o dentro una condizione di policy porta con sé
  `admin_possiede_condominio`/`appartiene_condominio`/`possiede_unita` fino
  in fondo. Non ho trovato un solo caso di join che "perde" il filtro.
- **Le funzioni `security definer` che restituiscono dati aggregati**
  (`condominio_millesimi_totali`, `condominio_conteggio_unita`,
  `deleghe_riepilogo_delegato`, `candidati_delega`,
  `assemblea_riepilogo_quorum`, `firme_verbale_pubbliche`,
  `sondaggio_risultati`) **verificano tutte, internamente, l'appartenenza
  del chiamante** prima di restituire qualcosa (tipicamente
  `admin_possiede_condominio(...) or appartiene_condominio(...)`), e
  restituiscono solo somme/conteggi o booleani, mai righe individuali
  altrui. Questo è un pattern **corretto e consistente**, applicato senza
  eccezioni in tutte le 7 funzioni di questo tipo che ho trovato.
- **I trigger `security definer`** (`aggiorna_tally_punto`,
  `tocca_segnalazione`, `tocca_segnalazione_su_update`,
  `verifica_disponibilita_spazio`, `verifica_abbinamento_movimento`,
  `handle_new_user`, `blocca_cambio_ruolo_non_autorizzato`) scrivono solo
  dati aggregati o di servizio (contatori, timestamp) o effettuano un
  controllo e falliscono con eccezione: **nessuno di essi legge e
  restituisce al chiamante righe individuali di un altro tenant**.
- **5 punti di codice usano `createServiceClient()`** (bypassa
  interamente la RLS): analizzati uno per uno più sotto (THREAT-02).

---

## Rilievi

### THREAT-01 — L'impersonazione amministratore→condòmino permette a QUALSIASI amministratore (anche auto-registrato, senza vetting) di impersonare condòmini non di sua competenza, con sessione non revocabile
- **Gravità**: **bloccante**
- **File**: `src/app/admin/utenti/actions.ts` righe 43-97
  (`visualizzaComeCondomino`, `terminaImpersonazione`); policy coinvolta:
  `supabase/schema.sql` righe 1239-1249 (`utenti_select_self_or_admin`,
  versione vigente — l'ultima del file); `src/app/registrazione/actions.ts`
  righe 16-17 (chiunque può auto-registrarsi con `ruolo = 'amministratore'`)
- **Descrizione, passo per passo, verificata leggendo entrambi i file**:
  1. **Chiunque** può registrarsi su `/registrazione` scegliendo
     `ruolo=amministratore`: non è richiesta alcuna verifica, pagamento o
     approvazione (`src/app/registrazione/actions.ts`, confermato anche in
     Fase 0/3). L'attaccante ottiene così un account amministratore
     "vuoto" (zero condomìni), che per la RLS su `condomini`/`unita`/ecc.
     non vede nulla di nessuno — **fin qui il disegno è corretto e
     deliberato** (commento in `registrazione/actions.ts`: "parte con
     un'area isolata e senza alcun condominio assegnato").
  2. L'attaccante chiama `visualizzaComeCondomino` con l'`utente_id` di una
     persona a sua scelta. La funzione verifica solo
     `richiedeAmministratore()` (qualunque amministratore, verificato
     leggendo `src/lib/supabase/dal.ts`) e poi esegue
     `supabase.from("utenti").select(...).eq("id", utenteId).eq("ruolo", "condomino").single()`
     — una select con il client **anon-key**, quindi filtrata dalla RLS
     della tabella `utenti`.
  3. La policy `utenti_select_self_or_admin` **vigente** (quella più in
     basso nel file, righe 1239-1249) ha tre clausole in `or`:
     `id = auth.uid()` · `admin_gestisce_utente(id)` ·
     **`ruolo_corrente() = 'amministratore' and ruolo = 'condomino' and
     not exists (select 1 from unita_proprietari up where up.utente_id =
     utenti.id)`**.
     La terza clausola — introdotta (commento riga 1226-1233) per
     permettere a un amministratore di "trovare" un condòmino non ancora
     assegnato a nessuna unità, al solo scopo di collegarlo — **rende quella
     riga visibile a QUALSIASI amministratore della piattaforma**, non solo
     a quello che gestirà in futuro la persona in questione. Non esiste
     alcuna condizione che lo riduca all'amministratore "giusto", perché a
     quel punto nel tempo non esiste ancora un "giusto": l'unità non è
     stata ancora assegnata a nessun condominio.
  4. Se la select ha successo (cioè: il condòmino scelto dall'attaccante
     **non è, in questo momento, collegato a nessuna unità** — condizione
     realistica e non rara: vale per chiunque si sia appena registrato e
     non sia ancora stato "agganciato" dal proprio amministratore reale, e
     **vale anche per chiunque sia stato temporaneamente scollegato** da
     un'unità con il pulsante
     `src/app/admin/unita/[id]/rimuovi-proprietario-button.tsx`, es. per
     una correzione dati o un passaggio di proprietà in corso), l'azione
     procede: genera un magic link per l'email del target
     (`service.auth.admin.generateLink`, client **service-role**, che
     bypassa del tutto la RLS — qui è l'unico uso corretto del privilegio,
     perché serve proprio a emettere un token per conto di un altro utente)
     e lo consuma immediatamente (`supabase.auth.verifyOtp`) **sulla
     sessione del browser dell'attaccante**, che diventa autenticato come
     il condòmino target.
  5. **Cosa può vedere l'attaccante da questo punto**: tutto ciò che le
     policy concedono a `auth.uid() = <id del target>`. Se il target è
     davvero "vuoto" (mai stato collegato a nulla), non c'è nulla da
     vedere. **Ma se il target è stato scollegato di recente** (caso del
     punto 3), le sue righe storiche in `voti`
     (`voti_select`: `... or utente_id = auth.uid() or ...`),
     `presenze`, `sondaggio_risposte`, `prenotazioni_spazi`,
     `segnalazioni` (`aperta_da = auth.uid()`) **restano leggibili
     tramite `utente_id = auth.uid()`, indipendentemente dal fatto che
     possieda ancora l'unità**: l'attaccante vede così come ha votato
     quella persona in assemblee reali, le sue segnalazioni, le sue
     prenotazioni — dati concreti di un condominio con cui l'attaccante
     non ha alcuna relazione.
  6. **La sessione non viene mai revocata.** `terminaImpersonazione`
     (righe 99-114) **non chiama alcuna funzione di revoca** sul lato
     Supabase Auth: si limita a rimettere nei cookie del browser i token
     dell'amministratore salvati prima (`setSession` con i token salvati).
     Il token di refresh emesso per il condòmino al passo 4 **resta
     valido** (non risulta alcuna chiamata a `signOut`/`admin.signOut`
     nel codice, verificato con ricerca su tutto `src/`) finché non scade o
     non viene usato altrove in modo da farlo ruotare. L'attaccante, in
     quanto controlla il proprio browser, può leggere quel token dai
     cookie di sessione (che pur essendo `HttpOnly` per il JavaScript della
     pagina sono comunque ispezionabili da chi ha accesso agli strumenti
     di sviluppo del proprio stesso browser) e riusarlo in futuro, anche
     dopo aver premuto "Torna amministratore".
  7. **Conseguenza aggravante**: se in futuro quella stessa persona
     (identificata dalla sua email, univoca a livello di piattaforma:
     `utenti.email text not null unique`) viene collegata a un'unità da un
     amministratore **reale e legittimo** (magari settimane dopo), il
     token precedentemente sottratto dall'attaccante continua a
     corrispondere al medesimo `auth.uid()`: se non ancora scaduto/ruotato,
     consentirebbe di leggere anche i dati **nuovi** di quella persona nel
     condominio a cui è stata davvero assegnata — un bypass dell'isolamento
     multi-tenant che non richiede nemmeno un nuovo attacco al momento
     dell'assegnazione.
- **Impatto concreto**: isolamento tra condomìni e tra amministratori
  **non garantito** nel caso, realistico, di condòmini temporaneamente o
  permanentemente non collegati a un'unità. Raggiungibile da un account
  gratuito, auto-registrato, senza alcuna relazione con la vittima.
  Esposizione di dati personali concreti (voti nominativi, segnalazioni,
  prenotazioni) in violazione sia della separazione dei dati sia — se la
  persona target è un consumatore — del GDPR.
- **Rimedio**:
  1. Restringere `visualizzaComeCondomino` a verificare esplicitamente,
     **nel codice applicativo** (non solo fidandosi della select RLS), che
     il target sia effettivamente collegabile dall'amministratore
     chiamante al **proprio** condominio — ad esempio richiedendo che la
     chiamata avvenga da una pagina che già conosce sia `utente_id` sia
     un `condominio_id` di competenza dell'amministratore, e verificando
     server-side con `admin_possiede_condominio` quel condominio prima di
     procedere, oppure limitando l'impersonazione ai soli utenti con
     `admin_gestisce_utente(id) = true` (già collegati), **rimuovendo**
     l'uso della terza clausola di `utenti_select_self_or_admin` per
     questo scopo e fornendo una funzione RPC dedicata e più stretta per
     il caso d'uso "trova condòmino non assegnato" (che non deve implicare
     anche "posso impersonarlo").
  2. **Revocare esplicitamente** la sessione del condòmino impersonato al
     termine ("Torna amministratore"): Supabase espone
     `auth.admin.signOut(userId, scope)` (o equivalente) da invocare con il
     client service-role in `terminaImpersonazione` prima di ripristinare
     i token dell'amministratore.
  3. Valutare se la terza clausola di `utenti_select_self_or_admin` sia
     ancora necessaria dopo il punto 1, o se possa essere sostituita da una
     funzione `security definer` dedicata e non riutilizzabile per
     l'impersonazione.
- **Riferimento**: principio di minimizzazione/isolamento tenant (non da
  una norma specifica, ma dal modello stesso dichiarato dal progetto —
  README: "RLS... è la barriera 'vera'"); **art. 32 GDPR** (misure di
  sicurezza adeguate al rischio) per l'impatto sui dati personali reali
  esposti; **art. 5, par. 1, lett. f) GDPR** (integrità e riservatezza).

### THREAT-02 — Rassegna puntuale dei 5 punti che usano la service-role key
- **Gravità**: informativa/di verifica (non un nuovo rilievo per 4 dei 5
  punti, che risultano sicuri; il quinto è coperto da THREAT-01)
- **Descrizione**: come richiesto esplicitamente, ogni punto che importa
  `createServiceClient` (`src/lib/supabase/service.ts`, già segnalato in
  Fase 1 — COD-01 — per l'assenza del guardrail `server-only`) è stato
  verificato uno per uno:

  1. **`src/app/api/stripe/webhook/route.ts`** — il client service-role è
     usato **solo dopo** aver verificato la firma HMAC Stripe
     (`getStripe().webhooks.constructEvent`, righe 18-25): senza una firma
     valida la richiesta è respinta con 400 prima di toccare il database.
     L'unica query è un `update` su `ripartizioni` filtrato per `id =
     ripartizioneId`, dove `ripartizioneId` proviene da
     `session.metadata.ripartizione_id`, **impostato server-side** al
     momento della creazione della sessione Stripe
     (`src/app/area-riservata/actions.ts` riga 52) e non manipolabile dal
     webhook stesso. **Filtro di tenant implicito ma sufficiente**:
     l'update tocca una sola riga specifica per id, non un insieme
     filtrabile dall'esterno. **Verificato sicuro.**
  2. **`src/app/firma-verbale/[token]/actions.ts`** (`leggiFirma`,
     `richiediCodice`, `confermaFirma`) — ogni query filtra per
     `.eq("token", token)`, dove il token è generato da
     `randomBytes(24).toString("base64url")` (`src/lib/firma-otp.ts`,
     192 bit di entropia, non enumerabile in pratica). Il filtro di tenant
     qui è **il token stesso**, in luogo di una policy RLS, perché il
     chiamante non ha una sessione. **Verificato sicuro**, a condizione
     che il token non venga mai esposto in log o in un canale non
     cifrato — non ho trovato evidenza che lo sia (nessun logging
     applicativo esiste affatto, come già rilevato in Fase 1 COD-09, quindi
     non c'è nemmeno quel canale di fuga).
  3. **`src/app/firma-verbale/[token]/page.tsx`** — stesso schema del
     punto 2, stesso filtro per token. **Verificato sicuro.**
  4. **`src/app/admin/utenti/actions.ts`** — descritto in dettaglio in
     THREAT-01. Qui il client service-role è usato per
     `generateLink`/emissione del magic link, **dopo** un controllo di
     autorizzazione (la select RLS-backed sugli `utenti`) che però **non è
     sufficientemente stretto**, come spiegato sopra. Il problema non è
     l'uso della service-role key in sé (è l'unico modo per generare un
     link di accesso per conto di un altro utente), ma il controllo che lo
     precede.
  5. (per completezza, già citato: nessun quinto punto applicativo oltre
     ai 4 sopra — `src/lib/supabase/service.ts` stesso è la definizione, non
     un punto d'uso.)
- **Impatto / rimedio**: nessuna azione necessaria per i punti 1-3 oltre
  a quanto già raccomandato in Fase 1 (aggiungere `import "server-only"` a
  `service.ts` come guardrail preventivo, non perché oggi sia usato male);
  per il punto 4 vale il rimedio di THREAT-01.
- **Riferimento**: art. 32 GDPR; principio del minimo privilegio.

### THREAT-03 — Nessun test automatizzato dimostra l'isolamento tra tenant
- **Gravità**: alta
- **File**: `vitest.config.mts` (`include: ["src/**/*.test.ts"]`); nessun
  file in `supabase/` relativo a test (nessun pgTAP, nessuna cartella
  `supabase/tests`); i 22 file `*.test.ts` trovati in Fase 1 testano solo
  logica pura di `src/lib/**`, non le policy RLS
- **Descrizione**: non esiste alcun test — unitario, di integrazione o
  e2e — che esegua davvero una query contro un database Postgres/Supabase
  (locale o di test) impersonando due utenti diversi e verifichi che l'uno
  non veda i dati dell'altro. L'intera garanzia di isolamento multitenant,
  che è il cuore della sicurezza del prodotto, **non è verificata da
  nessuna pipeline automatica**: dipende dalla correttezza manuale di
  3105 righe di SQL scritte e modificate a mano nel tempo (vedi anche il
  rilievo su `schema.sql` come log di migrazioni in Fase 0/1).
- **Impatto concreto**: una futura modifica a una policy (ne sono già
  state riscritte più volte nello storico del file, vedi Fase 0) potrebbe
  introdurre una regressione di isolamento **senza che nulla la segnali**
  prima della produzione. Lo stesso THREAT-01 di questo documento è un
  esempio concreto di un gap che un test di isolamento mirato (anche un
  singolo test: "un amministratore senza condomìni non deve riuscire a
  impersonare un condòmino scollegato appartenente ad altri") avrebbe
  potuto far emergere prima.
- **Rimedio**: introdurre, anche solo per le tabelle/flussi più sensibili
  (voti, ripartizioni, movimenti bancari, impersonazione), test che usano
  un progetto Supabase locale (`supabase start`) o un Postgres di test con
  lo schema applicato, creano due utenti/condomìni distinti e verificano
  negativamente (l'utente B non vede le righe di A) oltre che
  positivamente.
- **Riferimento**: buona pratica di test per sistemi multi-tenant; nessuna
  norma specifica.

### THREAT-04 — `src/lib/supabase/service.ts` senza guardrail `server-only` (richiamo da Fase 1, approfondito qui)
- **Gravità**: alta (invariata da Fase 1, confermata dopo l'analisi
  puntuale di THREAT-02)
- **File**: `src/lib/supabase/service.ts` (12 righe)
- **Descrizione**: confermato in questa fase, punto per punto, che i 4
  usi reali della service-role key sono oggi tutti legittimi e
  circoscritti (THREAT-02), **ma nessuno di essi è protetto da un
  controllo statico** che impedirebbe un domani un quinto uso scorretto
  (es. import accidentale in un componente client o in un punto senza il
  filtro per token/id specifico che oggi rende sicuri i punti 1-3).
- **Rimedio**: come già indicato in Fase 1 — aggiungere `import
  "server-only";` come prima riga del file.
- **Riferimento**: coerenza con gli altri moduli server-only del progetto
  (`src/lib/supabase/dal.ts`, `src/lib/documenti/pdf.ts`,
  `src/lib/notifiche-invio.ts`).

---

## Percorsi di attacco verificati e il loro esito

Per ciascuno: ruolo dell'attaccante, obiettivo, esito **verificato
leggendo la policy/il codice indicato**, non ipotizzato.

| # | Attaccante | Tentativo | Esito | Bloccato da |
|---|---|---|---|---|
| 1 | Condòmino autenticato, condominio X | Leggere `spese`/`ripartizioni`/`unita` di un condominio Y a cui non appartiene, indovinando o enumerando un `id` | **Bloccato** | `spese_select`/`ripartizioni_select`/`unita_select`: richiedono `appartiene_condominio`/`possiede_unita`, valutate contro `auth.uid()`. UUID casuali (128 bit), non enumerabili comunque. |
| 2 | Condòmino X | Leggere il voto di un altro condòmino Y dello stesso condominio sullo stesso punto all'OdG | **Bloccato** | `voti_select`: `admin_gestisce_unita(unita_id) or utente_id = auth.uid() or possiede_unita(unita_id)` — X vede solo i voti della propria unità/se stesso, mai quelli di Y su un'unità che non possiede. Il risultato aggregato (quanti favorevoli/contrari) arriva invece dalle colonne `tally_*` su `punti_odg`, visibili a tutti (per quello sono state introdotte: vedi commento riga 510-515), ma senza nominativi. |
| 3 | Condòmino X | Votare due volte sullo stesso punto, o votare a nome di un'unità che non possiede e senza delega | **Bloccato** | `voti_insert_condomino`: richiede `utente_id = auth.uid()` e (`possiede_unita(unita_id)` o una delega verificata via `exists (select 1 from deleghe ...)`), più `unique(punto_id, unita_id)` a livello di tabella. |
| 4 | Condòmino X | Leggere `movimenti_bancari` (chi ha pagato e chi no, dell'intero condominio) | **Bloccato** | `movimenti_bancari_admin` è l'**unica** policy sulla tabella ed è `for all using (ruolo_corrente() = 'amministratore' and admin_possiede_condominio(...))`: nessuna clausola per condòmini, nemmeno per le proprie righe. |
| 5 | Condòmino X | Leggere le note interne dell'amministratore su una segnalazione | **Bloccato** | `segnalazione_note_select`: `admin_gestisce_segnalazione(...) or (interna = false and segnalazione_visibile(...))` — le note con `interna = true` non soddisfano mai la seconda clausola. |
| 6 | Condòmino X | Caricare un file in `documenti-condominio/condomini/{altro_condominio}/...` o `.../spese/{altra_spesa}/...` | **Bloccato** | Policy `documenti_insert_admin` su `storage.objects`: per i prefissi `condomini`/`spese`/`assemblee` richiede `ruolo_corrente() = 'amministratore'`, che X non ha. Per `segnalazioni/` richiede `segnalazione_gestibile` (autore della segnalazione o amministratore del condominio), quindi X non può scrivere nella cartella di una segnalazione che non è sua. |
| 7 | Amministratore A (gestisce condominio 1) | Leggere/scrivere `condomini`/`unita`/`spese`/`assemblee` del condominio 2 (di un amministratore B) indovinando l'id | **Bloccato** | Tutte le policy `*_select`/`*_write_admin` di queste tabelle richiedono `admin_possiede_condominio(condominio_id)` (o equivalenti `admin_gestisce_*`), valutate su `amministratore_id = auth.uid()`. |
| 8 | Amministratore A | Importare condomìni/unità con `importa_condomini_unita`/`importa_condomini_unita_persone` passando un `nome`/`indirizzo` coincidente con un condominio dell'amministratore B, per dirottare le unità importate nel condominio di B | **Bloccato** | Le versioni **vigenti** di queste funzioni (righe 1150-1220 e 1767-1915) abbinano i condomìni esistenti filtrando esplicitamente `and c.amministratore_id = auth.uid()`: un condominio di B con lo stesso nome non viene mai scelto come destinazione, ne viene creato uno nuovo per A. (La primissima versione della funzione, righe 769-839, **non** aveva questo filtro ed era vulnerabile: è stata sovrascritta dalla migrazione successiva, il cui stesso commento, righe 1144-1149, descrive esattamente questo problema come motivo della riscrittura — verificato che la versione corretta è quella effettivamente in vigore, essendo la più recente nel file.) |
| 9 | Amministratore A | Eseguire `importa_spese_storiche`/`importa_condomini_unita*` passando il `p_condominio_id`/i dati di un condominio di B | **Bloccato** (verificato in dettaglio) | Nessuna delle funzioni di import è `security definer`: girano con i privilegi (e quindi sotto la RLS) del chiamante. Il passo che risolve le unità per `identificativo` dentro `p_condominio_id` passa da un semplice `select … from unita where condominio_id = p_condominio_id`, che **la RLS filtra comunque** secondo `unita_select` — se A non possiede quel condominio, la select non trova nessuna unità e la funzione solleva eccezione ("Unità non trovate"). Anche se qualche riga passasse, l'`insert into spese/ripartizioni` finale è comunque filtrato dal `with check` di `spese_write_admin`/`ripartizioni_write_admin`, che richiede `admin_possiede_condominio`. Doppia barriera, nessuna delle due manca. |
| 10 | Amministratore A | Impersonare un condòmino per vedere dati del condominio 2 (di B) | **Parzialmente riuscito — vedi THREAT-01** | Bloccato se il condòmino target è già collegato a un'unità di B (`utenti_select_self_or_admin` non lo rende visibile ad A). **Non bloccato** se il target non è (ancora, o più) collegato a nessuna unità: in quel caso A lo vede e lo impersona, ed eredita l'accesso a tutte le righe storiche con `utente_id = auth.uid()` di quella persona. |
| 11 | Visitatore non autenticato | Richiedere qualsiasi pagina `/admin/*` o `/area-riservata/*` | **Bloccato** | `src/proxy.ts`: nessuna sessione → redirect a `/login` per ogni path non in whitelist (fail-closed, verificato in Fase 0). |
| 12 | Visitatore non autenticato | Chiamare direttamente una Server Action di una pagina protetta (bypassando la UI, es. con una richiesta POST diretta) | **Bloccato** | Ogni action che legge/scrive dati chiama `createClient()` (sessione cookie-based) e la RLS esige `auth.uid()` non nullo per qualunque clausola diversa da quelle pubbliche; senza sessione, `auth.uid()` è `null` e nessuna condizione `= auth.uid()` o `security definer` basata su di esso risulta vera. Le poche action che non chiamano esplicitamente `richiedeUtente()` prima di operare (già rilevato in Fase 1, COD-04) sono comunque coperte da questo meccanismo. |
| 13 | Visitatore non autenticato | Indovinare un token di `firma-verbale` o forzare l'OTP | **Bloccato in pratica** | Token da 192 bit non enumerabile; OTP a 6 cifre con lockout a 5 tentativi e necessità di richiedere un nuovo codice (nuovo valore casuale) per sbloccarsi — vedi analisi positiva già fatta in Fase 2 (il meccanismo è ben progettato). |
| 14 | Visitatore non autenticato | Leggere un file del bucket privato `documenti-condominio` conoscendo il percorso | **Bloccato** | Bucket creato con `public = false`; ogni lettura richiede una Signed URL generata server-side dopo un controllo di autorizzazione (verificato per `firma-verbale`: `createSignedUrl` con scadenza 900s, generata solo dopo il match sul token) oppure, per i file scaricati dall'app, le policy `documenti_select` su `storage.objects` che richiedono comunque `auth.uid()` e appartenenza. |

---

## Matrice ruolo × risorsa × operazione

Esito **atteso** (quello che il prodotto dichiara di voler fare) vs
**reale** (quello verificato nel codice). Dove coincidono: ✅. Dove
**non** coincidono: ⚠️ con rinvio al rilievo.

| Risorsa | Operazione | Amministratore (proprio condominio) | Amministratore (altro condominio) | Condòmino (proprio condominio, propri dati) | Condòmino (dati di un altro condòmino, stesso condominio) | Condòmino (altro condominio) | Non autenticato |
|---|---|---|---|---|---|---|---|
| `condomini`, `unita`, `spese`, `assemblee`, `fornitori`, `manutenzioni_programmate`, `documenti_condominio`, `spazi_comuni`, `tabelle_millesimali` | Lettura | Atteso: sì — Reale: ✅ | Atteso: no — Reale: ✅ (bloccato) | Atteso: sì — Reale: ✅ | Atteso: sì (dati condivisi del condominio, non individuali) — Reale: ✅ | Atteso: no — Reale: ✅ | Atteso: no — Reale: ✅ |
| idem | Scrittura | Atteso: sì — Reale: ✅ | Atteso: no — Reale: ✅ | Atteso: no — Reale: ✅ | — | — | Atteso: no — Reale: ✅ |
| `voti`, `presenze`, `ripartizioni`, `sondaggio_risposte`, `prenotazioni_spazi` (dati individuali) | Lettura propria riga | Atteso: sì (per chi gestisce) — Reale: ✅ | Atteso: no — Reale: ✅ | Atteso: sì — Reale: ✅ | **Atteso: no** — Reale: ✅ (bloccato) | Atteso: no — Reale: ✅ | Atteso: no — Reale: ✅ |
| `movimenti_bancari` | Lettura | Atteso: sì — Reale: ✅ | Atteso: no — Reale: ✅ | **Atteso: no (nessuno)** — Reale: ✅ | — | — | Atteso: no — Reale: ✅ |
| `segnalazione_note` con `interna = true` | Lettura | Atteso: sì (per chi gestisce) — Reale: ✅ | Atteso: no — Reale: ✅ | **Atteso: no** — Reale: ✅ | — | — | Atteso: no — Reale: ✅ |
| `firme_verbale` (token/otp_hash) | Lettura | Atteso: sì (per chi gestisce) — Reale: ✅ | Atteso: no — Reale: ✅ | Atteso: no (solo via `firme_verbale_pubbliche`, aggregato) — Reale: ✅ | — | — | Atteso: no (solo tramite token proprio, via service-role) — Reale: ✅ |
| **Identità/sessione di un condòmino scollegato da unità** (tramite "visualizza come") | Impersonazione | Atteso: sì, solo per i propri condòmini — **Reale: ⚠️ THREAT-01: anche per condòmini di altri amministratori, se scollegati** | Atteso: no — **Reale: ⚠️ THREAT-01** | — | — | — | Atteso: no — Reale: ✅ (richiede comunque un account amministratore, anche se gratuito) |
| `utenti` (riga di un condòmino non collegato a nessuna unità) | Lettura (nome/cognome/email) | Atteso: sì, per poterlo assegnare — Reale: ✅ (voluto) | **Atteso: no** — **Reale: ⚠️ THREAT-01: visibile a qualunque amministratore** | — | — | — | Atteso: no — Reale: ✅ |
| `ruolo` in fase di registrazione | Auto-assegnazione a `amministratore` | — | — | — | — | — | **Atteso: discutibile per progetto — Reale: ✅ consentito senza verifica (precondizione di THREAT-01)** |

---

## Nota di correzione a un'affermazione delle Fasi precedenti

La `legale/privacy-policy-BOZZA.md` (§ 6.3, letta in Fase 3) descrive la
sessione di "visualizza come" come "temporanea (massimo un'ora)". Ho
verificato in questa fase che quell'affermazione è **imprecisa**: il
limite di un'ora si applica solo al cookie `admin_return_session` che
permette all'amministratore di **tornare** alla propria identità — non
limita in alcun modo la durata della sessione/del token di refresh emessi
per il condòmino impersonato, che restano validi secondo le regole
ordinarie di Supabase Auth (tipicamente molto più di un'ora) e non vengono
mai revocati esplicitamente (vedi THREAT-01, punto 6). Segnalo la
correzione qui perché incide direttamente sulla valutazione di rischio di
questa fase; il testo della bozza privacy andrà aggiornato di conseguenza
una volta corretto il codice (o, se non corretto, resta un'affermazione
contrattuale non veritiera).

---

## Cose verificate come corrette (da non confondere con THREAT-01)

Per bilanciare il quadro: a parte il gap specifico di THREAT-01, il resto
del modello di autorizzazione **letto per intero** risulta solido:

- Separazione tra amministratori (multi-tenancy) applicata in modo
  **uniforme** su tutte le 29 tabelle con RLS, senza eccezioni trovate.
- Separazione tra condòmini dello stesso condominio sui dati individuali
  (voti, presenze, ripartizioni, sondaggi, prenotazioni, segnalazioni)
  applicata correttamente ovunque.
- I dati più sensibili per la reputazione (morosità/`movimenti_bancari`)
  hanno la policy più restrittiva di tutte (solo amministratore, nessuna
  eccezione per il condòmino stesso).
- Le funzioni di import, pur non essendo `security definer`, sono protette
  da una doppia barriera (RLS in lettura sulle righe esistenti + `with
  check` in scrittura) che le rende sicure anche quando l'input
  (`p_condominio_id`, nomi, ecc.) è completamente sotto controllo di chi
  chiama.
- Lo storage dei documenti è privato di default, con policy che
  rispecchiano esattamente il modello delle tabelle corrispondenti, e le
  uniche letture pubbliche (flusso firma-verbale) passano per URL firmati
  a scadenza breve generati solo dopo un'autenticazione debole ma non
  nulla (token + OTP).

---

Nessun file del progetto è stato modificato in questa fase, a parte la
creazione di questo stesso documento in `docs/audit/04-threat-model.md`.
