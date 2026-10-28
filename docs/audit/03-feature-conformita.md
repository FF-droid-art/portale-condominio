# Fase 3 — Feature, contenuti e conformità

> Metodologia: ogni rilievo è verificato leggendo il file citato — inclusi,
> come richiesto, `legale/privacy-policy-BOZZA.md`, `legale/cookie-policy-BOZZA.md`
> e `legale/dpa-BOZZA.md` letti per intero in questa fase (non dati per
> scontati da fasi precedenti). Questi tre documenti sono bozze con dati
> d'esempio esplicitamente dichiarati come tali nel testo stesso
> ("Portale Condominio Demo S.r.l.", P.IVA `00000000000`, placeholder
> `[...]`): li ho valutati come bozze, non come documenti legali definitivi
> né come se non esistessero. Dove la questione è di competenza legale e non
> tecnica, lo segnalo esplicitamente come **"verifica legale necessaria"**
> invece di dare una risposta. Nessun file del progetto è stato modificato:
> output solo in `docs/audit/03-feature-conformita.md`.
>
> Gravità: **bloccante** / **alta** / **media** / **bassa**.

---

## Cose fatte bene (verificate leggendo i documenti e il codice corrispondente)

1. **Le bozze legali sono tecnicamente sofisticate e in gran parte coerenti
   con il codice reale**, non testo generico incollato. La `privacy-policy-BOZZA.md`
   distingue correttamente titolare (l'amministratore, per i dati dei suoi
   condòmini) da responsabile del trattamento (il gestore della
   piattaforma), individua correttamente che **il voto in assemblea non è
   anonimo** (§3.4, coerente con l'art. 1137 c.c. sull'impugnazione), e
   descrive la gestione della morosità con invii individuali e BCC per le
   comunicazioni collettive — **verificato che è proprio così nel codice**
   (coerente con quanto già riscontrato in Fase 0 per `src/lib/notifiche-invio.ts`
   e gli invii dei solleciti).
2. **La `cookie-policy-BOZZA.md` argomenta correttamente l'esenzione dal
   consenso per i cookie tecnici** citando l'art. 122, comma 1, d.lgs.
   196/2003 e le Linee guida del Garante del 10 giugno 2021, e **l'elenco dei
   cookie dichiarati corrisponde a quelli effettivamente impostati**:
   verificato in Fase 0 che il cookie di sessione passa da `@supabase/ssr`
   e che `admin_return_session` (`src/lib/impersonazione.ts`) è
   effettivamente `HttpOnly`/`Secure` in produzione/`SameSite=Lax` con durata
   massima un'ora, esattamente come descritto nella bozza. Coerentemente,
   **non esiste nel codice alcun banner di consenso** (ricerca esaustiva,
   zero risultati): la scelta dichiarata di non mostrarne uno è applicata,
   non solo annunciata.
3. **La `dpa-BOZZA.md` è onesta sui limiti reali del prodotto**, non
   un'autocelebrazione: l'art. 3.9 dichiara esplicitamente l'assenza di un
   registro di audit applicativo, l'assenza di autenticazione a più fattori
   e il mittente email non ancora verificato sul dominio proprio — **tutti
   fatti che ho verificato indipendentemente essere veri** nelle Fasi 0-1
   (rispettivamente: nessun logging trovato, nessun MFA nel flusso di login,
   `MITTENTE_EMAIL = "Portale Condominio <onboarding@resend.dev>"` in
   `src/lib/resend.ts`). È un buon segnale di trasparenza del documento, che
   however rende ancora più importante segnalare dove invece una cifra
   riportata non corrisponde al codice (FEAT-06).
4. **Le funzioni di autorizzazione RLS citate nella DPA esistono
   davvero con quei nomi**: ho verificato con una ricerca in
   `supabase/schema.sql` che `appartiene_condominio`, `possiede_unita`,
   `admin_possiede_condominio`, `admin_gestisce_spesa`,
   `admin_gestisce_assemblea`, `segnalazione_visibile` sono funzioni
   effettivamente definite, non nomi di fantasia.
5. **Nessun flusso di vendita del servizio stesso è ancora codificato**
   (nessuna tabella o integrazione di abbonamento/billing: ricerca esaustiva
   di "abbonamento"/"subscription"/"billing" senza risultati pertinenti).
   L'unico uso di Stripe è `mode: "payment"` per l'incasso di una quota
   condominiale già dovuta (non un acquisto di un bene/servizio dal gestore
   della piattaforma) — per questo gli obblighi B2C sulle vendite a distanza
   (informazioni precontrattuali, recesso ex artt. 45-67 Codice del
   Consumo) **non hanno oggi una funzione applicativa da verificare**: la
   questione tornerà rilevante se/quando verrà introdotto un abbonamento a
   pagamento per gli amministratori.
6. **Una DPIA non risulta necessaria allo stato attuale**: il trattamento
   (dati di un condominio di poche decine di unità, nessuna profilazione,
   nessun trattamento su larga scala ai sensi delle linee guida WP248/Garante)
   non rientra nei criteri dell'art. 35 GDPR per una valutazione d'impatto
   obbligatoria. Non è un gap, è una valutazione che fa parte di questa
   verifica.

---

## Rilievi

### FEAT-01 — Il registro di anagrafe condominiale non raccoglie i dati minimi richiesti dall'art. 1130, n. 6, c.c.
- **Gravità**: alta
- **File**: `supabase/schema.sql` righe 1568-1579 (tabella `anagrafiche`:
  `nominativo`, `email`, `telefono`, `tipo`, `utente_id`, `import_batch_id`),
  righe 37-44 (tabella `unita`: `identificativo`, `piano`,
  `millesimi_proprieta`, nessun campo catastale); confermato anche nella
  stessa `legale/privacy-policy-BOZZA.md` § 3.10, che dichiara
  esplicitamente: *"Dati catastali, codice fiscale dei singoli condòmini,
  documenti di identità. Lo schema attuale non prevede questi campi a
  livello di singola persona."*
- **Descrizione**: l'art. 1130, n. 6, c.c. impone all'amministratore di
  curare la tenuta del registro di anagrafe condominiale contenente, per
  ciascuna unità, **le generalità dei singoli proprietari e dei titolari di
  diritti reali e di godimento** (comprensive del **codice fiscale**), la
  **residenza o il domicilio**, i **dati catastali** di ciascuna unità
  immobiliare, e **ogni dato relativo alle condizioni di sicurezza delle
  parti comuni**. Il modello dati attuale copre nominativo, email, telefono,
  tipo di soggetto, titolo (proprietario/usufruttuario/conduttore/ecc.) e
  millesimi — ma **non ha una colonna per codice fiscale della singola
  persona, non ha dati catastali per unità (foglio/particella/subalterno/
  categoria), e non ha alcuna struttura per le condizioni di sicurezza delle
  parti comuni** (verificato: nessuna tabella o campo riconducibile a questo
  nel file completo). Il codice fiscale è previsto solo a livello di
  condominio (`condomini.codice_fiscale`), non di persona.
- **Impatto concreto**: un amministratore che usasse **solo** questo
  portale come registro di anagrafe non avrebbe, all'interno del sistema,
  un registro conforme al minimo di legge — dovrebbe tenere questi dati
  altrove (il che vanifica parte del valore del prodotto come strumento di
  compliance per l'amministratore, che è esplicitamente una delle finalità
  dichiarate nella Fase 4 del contratto/base giuridica della stessa
  `privacy-policy-BOZZA.md` § 4). Non è un rischio di sicurezza: è un gap di
  **completezza funzionale** rispetto allo scopo dichiarato della feature
  "anagrafica/registro".
- **Rimedio**: aggiungere a `anagrafiche` i campi `codice_fiscale text` e
  `residenza_domicilio text` (o struttura equivalente), e a `unita` i campi
  catastali (`foglio`, `particella`, `subalterno`, `categoria` o un unico
  campo `riferimenti_catastali text` se non si vuole strutturarli), più una
  sede per le condizioni di sicurezza delle parti comuni (può essere un
  campo libero sul condominio, o un collegamento ai documenti di
  certificazione già previsti in `documenti_condominio` con categoria
  `certificazione` — in tal caso andrebbe solo rese esplicito nel prodotto
  che quella categoria assolve anche questo obbligo, cosa che oggi non è
  comunicata da nessuna parte del codice o del testo).
- **Riferimento**: **art. 1130, n. 6, c.c.** (testo risultante dalla L.
  220/2012). Non richiede verifica legale aggiuntiva: il testo della norma è
  puntuale sui campi minimi, la verifica è stata fatta direttamente sullo
  schema.

### FEAT-02 — Il rendiconto annuale non è consultabile né scaricabile dal condòmino
- **Gravità**: alta
- **File**: `src/app/admin/condomini/[id]/rendiconto/route.ts` righe 18-22
  (`if (!utente || utente.ruolo !== "amministratore") return 403`); nessun
  file equivalente trovato sotto `src/app/area-riservata/**` (ricerca
  esaustiva di "rendiconto" in quell'albero: zero risultati)
- **Descrizione**: il rendiconto (registro di contabilità + riepilogo
  finanziario + nota sintetica, generato da `src/lib/documenti/rendiconto.ts`)
  è scaricabile **solo** dall'amministratore, tramite una route protetta da
  un controllo di ruolo che respinge chiunque non sia amministratore. Non
  esiste, nell'area riservata del condòmino, alcuna pagina o collegamento
  per visualizzare o scaricare il rendiconto del proprio condominio. Il
  condòmino vede solo l'elenco delle proprie ripartizioni
  (`src/app/area-riservata/elenco-ripartizioni.tsx`), non il documento di
  rendiconto nel suo complesso.
- **Impatto concreto**: l'art. 1130-bis c.c. attribuisce a ogni condòmino il
  diritto di prendere visione ed estrarre copia del rendiconto (ed è anche
  uno dei documenti esplicitamente previsti dal **sito internet del
  condominio** ex **art. 71-ter disp. att. c.c.**, quando l'assemblea ne
  delibera l'istituzione). Oggi, se il portale fosse adottato come "sito del
  condominio" ai sensi di quella norma, **mancherebbe esattamente il
  documento più citato dalla norma stessa**: il condòmino dovrebbe comunque
  chiederlo all'amministratore con un altro mezzo, il che svuota parte dello
  scopo dichiarato della feature.
- **Rimedio**: aggiungere una route equivalente sotto
  `src/app/area-riservata/condominio/rendiconto/route.ts` (o percorso
  analogo) che verifichi — tramite `richiedeUtente()` più il controllo che
  l'unità dell'utente appartenga al condominio richiesto (la RLS lo farebbe
  comunque a valle, ma andrebbe replicata la stessa logica di
  `costruisciDocumentoRendiconto` già esistente) — e generi lo stesso PDF.
  Minore se si preferisce: anche solo un collegamento nella pagina
  `/area-riservata` o `/area-riservata/documenti` che punti a un rendiconto
  già approvato e caricato come documento (categoria `bilancio`, già
  prevista in `documenti_condominio`) risolverebbe il problema senza nuovo
  codice di generazione, a condizione che l'amministratore lo carichi
  effettivamente lì — oggi nulla nel prodotto lo richiede o lo suggerisce.
- **Riferimento**: **art. 1130-bis c.c.**; **art. 71-ter disp. att. c.c.**
  (sito internet del condominio, elenco dei documenti da rendere disponibili).

### FEAT-03 — Le tabelle millesimali e lo stato patrimoniale non sono consultabili dal condòmino
- **Gravità**: bassa
- **File**: ricerca esaustiva di "tabelle_millesimali"/"stato-patrimoniale" in
  `src/app/area-riservata/**`: zero risultati, a fronte delle pagine admin
  `src/app/admin/condomini/[id]/page.tsx` (tabelle millesimali) e
  `src/app/admin/unita/[id]/stato-patrimoniale/route.ts`
- **Descrizione**: come il rendiconto (FEAT-02) ma con impatto minore: le
  tabelle millesimali sono allegate al regolamento ex art. 1138 c.c. e
  dovrebbero essere accessibili ai condòmini (spesso come parte del
  regolamento stesso, che se caricato come documento in archivio sarebbe già
  visibile); lo stato patrimoniale di una singola unità (art. 63 disp. att.
  c.c.) è invece tipicamente richiesto da chi vende o acquista, quindi è
  meno strettamente un diritto di consultazione permanente del condòmino —
  per questo la gravità è bassa e non alta come FEAT-02.
- **Impatto concreto**: minore rispetto a FEAT-02; principalmente una
  questione di trasparenza verso il condòmino sui criteri di riparto.
- **Rimedio**: esporre almeno la tabella millesimale corrente in lettura
  nell'area riservata (es. come parte della pagina del proprio condominio,
  se/quando ne esisterà una lato condòmino).
- **Riferimento**: art. 1138 c.c.; art. 63 disp. att. c.c. (quest'ultimo per
  lo stato patrimoniale, dove l'accesso primario è comunque
  dell'amministratore/notaio, non del condòmino stesso).

### FEAT-04 — La notifica email di convocazione assemblea non contiene l'ordine del giorno né i contenuti minimi richiesti, ed è inviata senza riscontro di consegna
- **Gravità**: media (con una componente da **verificare legalmente**,
  segnalata esplicitamente sotto)
- **File**: `src/app/admin/assemblee/actions.ts` righe 37-73
  (funzione `notificaNuovaAssemblea`)
- **Descrizione**: alla creazione di un'assemblea, il sistema invia
  un'email a tutti i proprietari con questo contenuto fisso:
  `"È stata convocata una nuova assemblea {tipo} per il {data}. Accedi al
  portale per i dettagli."` — **verificato leggendo il codice**: non contiene
  l'ordine del giorno (che peraltro a quel punto del flusso applicativo
  potrebbe non esistere ancora, perché i punti all'ordine del giorno si
  aggiungono in un passo successivo sulla pagina di dettaglio, non alla
  creazione), non contiene il luogo, non contiene un allegato o un link al
  documento di convocazione formale generato da
  `src/app/admin/assemblee/[id]/documenti/route.ts` (quella route è comunque
  riservata all'amministratore). L'invio è avvolto in un `try { } catch { }`
  che **ignora silenziosamente** ogni errore (commento nel codice: "ignorato
  di proposito") — coerente con la scelta "best effort" già rilevata in
  Fase 1 (COD-09, assenza di logging), ma qui con una conseguenza specifica:
  **nessuno saprebbe se la convocazione non è arrivata a un condòmino**, e
  l'amministratore non ha alcun segnale per rispedirla con un altro mezzo.
- **Impatto concreto, distinguendo fatto da interpretazione legale**:
  - **Fatto verificato**: il contenuto dell'email non riporta l'ordine del
    giorno né il luogo, elementi che l'art. 66, comma 3, disp. att. c.c.
    richiede nella convocazione.
  - **Da verificare legalmente**: se si ritenga che "rendere disponibile
    l'ordine del giorno nel portale, con un'email di avviso che non lo
    riporta" soddisfi comunque l'onere di convocazione (per analogia con un
    sito del condominio ex art. 71-ter disp. att. c.c., se attivato con
    delibera assembleare) oppure no. È un punto di incertezza
    giurisprudenziale/dottrinale che **non decido qui**: segnalo solo che,
    a oggi, l'email di per sé non trasmette quei contenuti.
  - **Da verificare legalmente**: se l'invio tramite email ordinaria (non
    PEC, non raccomandata) sia sufficiente a provare l'avvenuta convocazione
    in caso di contestazione, anche quando il condòmino abbia in passato
    accettato comunicazioni via email (prassi generalmente ammessa se
    risulta un'indicazione dell'indirizzo da parte del condòmino stesso, ma
    con margini di contestazione se la consegna non è mai confermata — qui
    non lo è, per via del `catch` silenzioso).
- **Rimedio**: includere nell'email almeno luogo, data, tipo e un
  riepilogo testuale dell'ordine del giorno quando già presente al momento
  dell'invio (o re-inviare/integrare l'email quando i punti vengono
  aggiunti); registrare da qualche parte il successo/fallimento dell'invio
  per singolo destinatario (anche solo un campo "ultimo invio riuscito" in
  una tabella, non necessariamente un sistema di log completo) così
  l'amministratore può accorgersene e intervenire con un altro mezzo.
- **Riferimento**: **art. 66, comma 3, disp. att. c.c.**; applicabilità di
  canali non certificati — **verifica legale necessaria**, non assunta qui
  in un senso o nell'altro.

### FEAT-05 — La pagina di registrazione non rimanda all'informativa privacy al momento della raccolta dei dati
- **Gravità**: media
- **File**: `src/app/registrazione/page.tsx` (ricerca di "privacy"/"cookie"
  nel file: zero risultati)
- **Descrizione**: il modulo di registrazione raccoglie nome, cognome,
  email, password e ruolo — i primi dati personali raccolti direttamente
  dall'interessato — senza alcun link o riferimento all'informativa privacy
  (`/privacy`, che pure esiste come pagina, verificato in questa stessa
  fase) né alla cookie policy. Il link a `/privacy` compare solo nel footer
  della home page pubblica (`src/app/page.tsx` righe 230-233), non nel punto
  in cui i dati vengono effettivamente raccolti.
- **Impatto concreto**: l'art. 13 GDPR richiede che l'informativa sia
  fornita **al momento della raccolta** dei dati. Un utente che si registra
  partendo da un link diretto a `/registrazione` (es. un invito inviato
  dall'amministratore) potrebbe non passare mai dalla home page e quindi non
  vedere mai il link all'informativa prima di sottomettere i propri dati.
- **Rimedio**: aggiungere nella pagina di registrazione un testo breve del
  tipo *"Proseguendo, dichiari di aver letto l'informativa sul trattamento
  dei dati"* con link a `/privacy`, prima del pulsante di invio.
- **Riferimento**: **art. 13 GDPR**.

### FEAT-06 — La bozza di DPA sovrastima il numero di tabelle e politiche RLS effettivamente implementate
- **Gravità**: media
- **File**: `legale/dpa-BOZZA.md` riga 77 (*"attive su tutte le tabelle che
  contengono dati personali (oltre 40 tabelle, con più di 140 politiche di
  accesso)"*); confrontato con `supabase/schema.sql`, dove ho contato
  esattamente **29 tabelle** con `enable row level security` (corrispondenti
  a 29 `create table`) e **110** istruzioni `create policy` totali nel file
  — di cui una parte sono ridefinizioni storiche della stessa policy (già
  rilevato in Fase 0/1): le policy effettivamente distinte per nome sono
  circa **73**.
- **Descrizione**: l'affermazione qualitativa — "tutte le tabelle con dati
  personali hanno RLS" — **è verificata e corretta** (29 tabelle create, 29
  con RLS attiva: nessuna eccezione trovata). Il numero riportato, però, è
  impreciso in entrambe le cifre, sia contando le sole policy attive sia
  contando anche quelle storiche sovrascritte.
- **Impatto concreto**: la DPA è un documento contrattuale su cui
  l'amministratore-cliente (titolare del trattamento) può fare affidamento
  per la propria valutazione del rischio ex art. 32 GDPR e per un'eventuale
  DPIA. Una cifra verificabile e sbagliata in un documento che si presenta
  come tecnicamente accurato (a differenza delle clausole volutamente
  generiche su responsabilità/foro, già segnalate come da negoziare) mina
  la credibilità delle altre affermazioni tecniche del documento, che
  invece ho verificato essere corrette (FEAT-nota positiva 3-4).
- **Rimedio**: correggere la cifra a "29 tabelle, circa 70 politiche di
  accesso attive" (o rigenerare automaticamente questa riga da una query
  reale su `pg_policies`/`pg_tables` prima di ogni firma, per evitare che il
  numero si disallinei di nuovo a ogni futura migrazione).
- **Riferimento**: **art. 28, par. 3, lett. c) e art. 32 GDPR** (accuratezza
  della descrizione delle misure tecniche in un accordo di nomina a
  responsabile).

### FEAT-07 — Manca una pagina di "Termini e condizioni d'uso"
- **Gravità**: media
- **File**: nessuno trovato (ricerca di `termini`/`condizioni` sotto
  `src/app`: zero risultati); esistono solo `/privacy` e `/cookie`
- **Descrizione**: non esiste alcuna pagina che definisca le condizioni
  contrattuali d'uso del servizio (durata, modalità di recesso dal servizio
  stesso da parte dell'amministratore cliente, limitazioni di
  responsabilità, livello di servizio) — distinta dal trattamento dei dati
  personali, di cui si occupano `/privacy` e `/cookie`.
- **Impatto concreto**: per un servizio erogato a un professionista
  (l'amministratore) e, indirettamente, usato da consumatori (i condòmini),
  l'assenza di condizioni d'uso pubblicate lascia il rapporto contrattuale
  non documentato pubblicamente — rilevante anche perché la stessa
  `dpa-BOZZA.md` fa riferimento a un "contratto di fornitura del Servizio"
  mai reso visibile come documento pubblico collegato dal sito.
- **Rimedio**: pubblicare una pagina `/termini` (o `/condizioni`) con le
  condizioni contrattuali di base, collegata dal footer insieme a privacy e
  cookie.
- **Riferimento**: art. 7 d.lgs. 70/2003 (informazioni generali obbligatorie
  per i servizi della società dell'informazione); da integrare con gli
  obblighi B2B/B2C applicabili una volta definito il modello commerciale —
  **verifica legale necessaria** sul contenuto specifico, qui si segnala solo
  l'assenza della pagina.

### FEAT-08 — Riferimento a un file inesistente (`COSA-RESTA-DA-DECIDERE.md`) nelle bozze legali
- **Gravità**: bassa
- **File**: `legale/privacy-policy-BOZZA.md` riga 213 (*"vedi il file
  `COSA-RESTA-DA-DECIDERE.md` in questa cartella (è comune ai tre
  documenti)"*); verificato con `find` su tutta la repository: **il file non
  esiste**, né in `legale/` né altrove
- **Descrizione**: il documento rimanda esplicitamente a un file che
  dovrebbe raccogliere le decisioni ancora aperte comuni a privacy policy,
  cookie policy e DPA (ne ho contate diverse segnalate inline come "scelta
  aperta", "da confermare", "`[DA VERIFICARE]`" nei tre documenti: DPO non
  nominato, termini di conservazione di segnalazioni/prenotazioni/sondaggi,
  regione di hosting Supabase da confermare, piano Vercel da verificare,
  periodo di conservazione transitoria post-cessazione, foro competente,
  clausole di responsabilità) — ma il file che dovrebbe centralizzarle per
  il passaggio in revisione legale non è stato creato.
- **Impatto concreto**: chi deve far verificare questi documenti da un
  legale (come i documenti stessi raccomandano) non ha un punto d'accesso
  unico alle domande aperte; deve ricostruirle spulciando i tre file.
- **Rimedio**: creare `legale/COSA-RESTA-DA-DECIDERE.md` raccogliendo i punti
  già marcati inline nei tre documenti (sono già scritti, vanno solo
  aggregati), oppure correggere il riferimento se la scelta è di tenerli
  solo inline.
- **Riferimento**: nessuna norma; igiene documentale.

### FEAT-09 — Nessun meccanismo di integrità/data certa per verbali, rendiconto e convocazioni oltre al timestamp applicativo
- **Gravità**: bassa (richiamo incrociato a COD-09, non un nuovo rilievo
  tecnico separato)
- **File**: coerente con quanto già verificato in Fase 1 (`docs/audit/01-codice.md`,
  COD-09) e ammesso esplicitamente in `legale/dpa-BOZZA.md` § 3.9 ("non è
  implementato un registro di audit applicativo")
- **Descrizione**: `created_at`/`confermato_il`/`data_voto` ecc. sono
  timestamp applicativi ordinari, non un meccanismo di data certa in senso
  tecnico-legale (marcatura temporale qualificata, PEC, hash ancorato).
  Per il verbale questo è già esplicitamente disclosurato come "non firma
  elettronica con valore legale" (`src/lib/firma-otp.ts`, verificato in
  Fase 1/2); qui si segnala che lo stesso limite si estende a rendiconto e
  convocazione, che non hanno alcuna conferma OTP né altro meccanismo.
- **Impatto concreto**: per contestazioni formali su *quando* un documento è
  stato effettivamente prodotto o modificato, oggi l'unica evidenza è quanto
  risulta dal database applicativo, modificabile da un amministratore con
  accesso al proprio tenant senza che resti una traccia immutabile.
- **Rimedio**: non necessariamente una soluzione crittografica complessa;
  anche una tabella di log append-only per le operazioni sui documenti
  "ufficiali" (verbale, rendiconto, convocazione) ridurrebbe il gap a costo
  contenuto.
- **Riferimento**: nessuna norma specifica impone una "data certa"
  qualificata per questi documenti in generale; rilevante soprattutto in
  sede di eventuale contenzioso (**valutazione di opportunità, non obbligo
  di legge certo — verifica legale se rilevante per il mercato di
  riferimento**).

### FEAT-10 — Pagamento delle quote con carta: possibile incompatibilità con la tracciabilità richiesta per alcune detrazioni fiscali edilizie
- **Gravità**: bassa, segnalata esplicitamente come **verifica legale/fiscale
  necessaria**, non come difetto accertato
- **File**: `src/app/area-riservata/actions.ts` (`avviaPagamento`, Stripe
  Checkout `mode: "payment"`, metodo carta)
- **Descrizione**: alcune detrazioni fiscali per interventi edilizi sul
  condominio (es. le note agevolazioni per ristrutturazioni/efficientamento,
  nei limiti e condizioni vigenti di volta in volta) richiedono, per
  determinate categorie di spesa, il pagamento tramite **bonifico "parlante"**
  con causale e dati specifici richiesti dall'Agenzia delle Entrate. Un
  pagamento con carta tramite Stripe Checkout non produce quel tipo di
  bonifico.
- **Impatto concreto**: **non verificato se e quando questo rilevi davvero**
  — dipende dalla categoria di spesa, dalla normativa fiscale vigente al
  momento del pagamento (che cambia nel tempo) e dal fatto che il
  condòmino abbia effettivamente interesse a portare quella specifica quota
  in detrazione. Non è un problema per le spese ordinarie. Segnalo il punto
  perché è un rischio reale e non ovvio per chi sceglie di pagare con carta
  una quota legata a un intervento potenzialmente detraibile, non perché
  abbia verificato che accada in pratica in questo prodotto.
- **Rimedio**: se rilevante per il mercato di riferimento, aggiungere un
  avviso contestuale al pulsante di pagamento quando la spesa collegata
  rientra in categorie potenzialmente detraibili ("straordinaria"), che
  inviti a verificare con il proprio consulente fiscale se convenga pagare
  con altro mezzo per quella specifica quota.
- **Riferimento**: normativa fiscale sulle detrazioni edilizie (variabile
  nel tempo) — **verifica legale/fiscale necessaria**, esplicitamente non
  risolta qui.

---

## Fuori perimetro in questa fase

- Non ho valutato se "Portale Condominio" rientri tra i soggetti destinatari
  degli obblighi EAA/AgID (già segnalato come apertura in Fase 2, SITO-05):
  resta una valutazione legale, non tecnica.
- Non ho verificato la configurazione reale della regione di hosting
  Supabase né il piano Vercel attivo (entrambi i documenti legali li
  segnalano come "da verificare nel pannello", correttamente, e non ho
  accesso a quei pannelli da questa fase di audit del codice).
- La classificazione del rapporto Stripe/condòmino rispetto al Codice del
  Consumo (FEAT non apribile per assenza di un flusso di vendita del
  servizio) andrà ripresa se/quando verrà introdotto un modello di
  abbonamento a pagamento per gli amministratori.

---

Nessun file del progetto è stato modificato in questa fase, a parte la
creazione di questo stesso documento in `docs/audit/03-feature-conformita.md`.
