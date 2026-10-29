# Fase 5 — Dipendenze, continuità e mercato

> Metodologia: l'audit delle dipendenze è stato **rieseguito direttamente in
> questa sessione** (`npm audit --json`, `npm ls`, `npm view ... time`
> contro il registro reale), non ripreso dal numero comunicato dal
> coordinatore. Il confronto competitivo usa **ricerche web eseguite ora**:
> ogni affermazione marcata "verificato" riporta la fonte consultata in
> coda al rilievo; ogni affermazione marcata "stima" è dichiarata come tale
> e non spacciata per fatto verificato. Per backup/DR ho cercato
> configurazione ed evidenza nel codice e nella documentazione del
> progetto stesso: dove non è verificabile da qui, lo dico esplicitamente
> invece di indovinare. Nessun file del progetto è stato modificato:
> output solo in `docs/audit/05-dipendenze-continuita-mercato.md`.
>
> Nota sullo stato del codice: tra la Fase 4 e questa è stato applicato,
> in questa stessa sessione, un correttivo per THREAT-01 (impersonazione)
> in `src/app/admin/utenti/actions.ts` e `src/lib/impersonazione.ts`. Non
> rientra nel perimetro di questa fase e non l'ho riverificato: dove
> rilevante more sotto, mi riferisco allo stato del codice così com'è ora,
> non a quello osservato in Fase 4.
>
> Gravità: **bloccante** / **alta** / **media** / **bassa**.

---

## 1. Dipendenze

### 1.1 Vulnerabilità note (`npm audit`, rieseguito ora)

Totale: **14 vulnerabilità** — 1 critica, 8 alte, 5 moderate, 0 basse
(numero confermato, coincide con quello comunicato dal coordinatore, ma
verificato qui con il dettaglio di ciascuna).

| Rilievo | Gravità | Pacchetto | Diretto? | Da produzione o solo da sviluppo? | Fix disponibile |
|---|---|---|---|---|---|
| DEP-01 | **alta/critica** | `next@16.2.10` → serve `16.4.3` | sì (dipendenza di produzione) | **Produzione** — è il framework stesso | sì, minor, non semver-major |
| DEP-02 | media | `exceljs@4.4.0` → `uuid@8.3.2` (bounds check mancante) | diretto (exceljs) / transitivo (uuid) | **Produzione** — exceljs è usato lato client per l'import wizard (già rilevato in Fase 1, COD-08) | **nessun fix diretto**: npm propone come unico percorso il downgrade a `exceljs@3.4.0` (semver-major, non praticabile senza riscrivere il codice che lo usa) |
| — | alta | `brace-expansion` (4 CWE di DoS) | transitivo | **In parte produzione**: una delle tre catene è `exceljs → archiver → readdir-glob → minimatch → brace-expansion@2.1.2` (dipendenza di produzione); le altre due arrivano da `eslint`/`eslint-config-next` (solo sviluppo) | sì |
| — | alta | `postcss@8.4.31` | transitivo | **Build-time**: viene da `next` stesso (elaborazione CSS in fase di build), non da una richiesta HTTP gestita a runtime | sì, upgrading `next` |
| — | alta | `sharp@0.34.5` | transitivo | **Potenzialmente produzione se si usa `next/image`**: viene da `next` per l'ottimizzazione immagini. Rilevante solo se le route che usano `next/image` sono raggiungibili — in Fase 1/2 abbiamo verificato che l'app **evita deliberatamente** `next/image` per le immagini da storage firmato, ma non ho verificato se esista un'altra route che lo usi davvero in produzione | sì, upgrading `next` |
| — | alta | `browserslist` / `baseline-browser-mapping` | transitivo (da `next` stesso e da `eslint-config-next`) | **Build-time** | sì |
| — | alta | `source-map-js` | transitivo (da `@tailwindcss/postcss` e da `next`) | **Build-time** (elaborazione CSS) | sì |
| — | alta | `js-yaml` | transitivo (da `eslint` → `@eslint/eslintrc`) | **Solo sviluppo** (lint) | sì |
| — | alta | `vite` (via `vitest`) | transitivo | **Solo sviluppo** (esecuzione test) | sì |
| — | moderata | `vitest@4.1.11` / `@vitest/mocker` | diretto / transitivo | **Solo sviluppo** | sì |
| — | alta | `zod` | transitivo, da `eslint-plugin-react-hooks` (dipendenza di `eslint-config-next`) | **Solo sviluppo** — **verificato** che il progetto non usa `zod` direttamente in nessun punto applicativo (ricerca già fatta in Fase 1: nessuna libreria di validazione schema in uso) | sì |

**DEP-01 (`next`)** è la più seria: tra le vulnerabilità elencate
dall'advisory per l'intervallo installato ci sono — testualmente dal
titolo dell'avviso ufficiale, non riformulato — *"Unauthenticated Remote
Code Execution on windows-hosted servers"*, *"Unauthenticated Remote Code
Execution in Image Optimization API when AVIF/SVG files are used"*,
*"Remote Code Execution in next/og ImageResponse"*,
*"Unauthenticated disclosure of internal Server Function endpoints"*,
oltre a diverse SSRF e cache-poisoning. Non ho verificato quali di queste
CVE specifiche si applichino davvero alla configurazione di deploy di
questo progetto (dipende da runtime Windows-hosted o Edge, da uso
dell'Image Optimization API, da `next/og`, nessuno dei quali ho
confermato essere in uso) — ma trattandosi di una dipendenza di
**produzione** con un fix minor non-breaking disponibile, l'aggiornamento
va fatto indipendentemente dall'esposizione specifica.

**DEP-02 (`exceljs`/`uuid`)** non ha un fix diretto compatibile: l'opzione
pragmatica è aggiungere un **override npm** (`overrides` in
`package.json`) che forzi `uuid` a una versione ≥11.1.1 indipendentemente
da cosa dichiara `exceljs`, verificando poi che `exceljs` continui a
funzionare con quella versione di `uuid` (compatibilità da testare, non
assunta).

### 1.2 Pacchetti non più mantenuti o fermi da tempo (verificato contro il registro npm reale)

| Rilievo | Gravità | Pacchetto | Stato verificato | Impatto |
|---|---|---|---|---|
| DEP-03 | **alta** | `pdf-lib@1.17.1` | **Ultima pubblicazione: 6 novembre 2021** (verificato con `npm view pdf-lib time`). Nessuna versione più recente esiste nel registro: non è "una versione vecchia che potremmo aggiornare", è **l'ultima versione mai pubblicata**, quattro anni fa. | È la libreria che genera **tutti** i documenti legali del portale (rendiconto, convocazione, verbale, sollecito, stato patrimoniale — vedi `src/lib/documenti/pdf.ts`). Un progetto fermo da 4 anni non riceverà patch se emergesse una vulnerabilità nel parsing/generazione PDF, e non segue gli sviluppi dello standard. Non ho trovato un fork attivamente mantenuto con compatibilità drop-in al momento di questa verifica (non ho cercato esaustivamente alternative: `pdf-lib` resta probabilmente la scelta pragmatica più semplice oggi, ma va monitorato). |
| DEP-04 | media | `exceljs@4.4.0` | Ultima versione **stabile** pubblicata il 19 ottobre 2023; esiste solo una prerelease (`4.4.1-prerelease.0`, dicembre 2024) mai promossa a stabile. Il progetto risulta a manutenzione molto rallentata (non "abbandonato" in senso stretto, ma stagnante da 2 anni sulla versione stabile), il che spiega anche perché la vulnerabilità `uuid` interna (DEP-02) non ha ancora un fix diretto. | Usato per il parsing `.xlsx` nei wizard di importazione (produzione, lato client — già rilevato in Fase 1 COD-08). |
| — | bassa | `@supabase/ssr@0.12.1` | Installata: 0.12.1; ultima pubblicata: 0.12.7 (verificato `npm view`). Solo patch, mantenimento attivo, nessun problema di fondo. | Minimo: aggiornamento di routine. |
| — | bassa | `stripe@22.4.0` | Installata: 22.4.0; ultima pubblicata: 23.0.1 (major). Pacchetto attivamente mantenuto (rilasci frequenti); un major dietro non è di per sé un problema di sicurezza, ma le major di Stripe talvolta deprecano comportamenti di API — da verificare al momento dell'aggiornamento, non ora. | Basso rischio immediato, ma da non lasciare accumulare troppo. |
| — | bassa | `lucide-react@1.24.0` | Installata: 1.24.0; ultima pubblicata: 1.63.0 (verificato — il progetto rilascia quasi ogni giorno). Molto indietro in termini di numero di versioni, ma trattandosi solo di icone SVG il rischio di sicurezza è trascurabile; l'aggiornamento è a basso rischio e a basso sforzo. | Nessun impatto di sicurezza plausibile; solo manutenzione. |
| — | bassa | `resend@6.18.1` | Installata: 6.18.1; ultima pubblicata: 6.35.0 (verificato, rilasci molto frequenti — segno di un servizio commerciale attivamente sviluppato, non di instabilità). | Basso rischio, aggiornamento di routine. |

### 1.3 Licenze

**Verificato leggendo il campo `license` nel `package.json` installato di
ciascuna libreria di produzione citata** (`next`, `react`, `react-dom`,
`@supabase/supabase-js`, `@supabase/ssr`, `stripe`, `resend`, `pdf-lib`,
`exceljs`, `papaparse`, `tailwindcss`, `react-markdown`, `remark-gfm`):
tutte **MIT**, tranne `lucide-react` che è **ISC**. Entrambe le licenze
sono permissive e pienamente compatibili con un uso commerciale,
proprietario e a codice chiuso, senza obblighi di copyleft o di
redistribuzione del codice sorgente. **Nessun rilievo**: non c'è alcuna
incompatibilità di licenza da segnalare.

### 1.4 Dimensione e necessità delle dipendenze pesanti

Già rilevato in Fase 1 (COD-08) e non riaperto qui come nuovo rilievo:
`exceljs` e `papaparse` vengono eseguiti **lato client** nel wizard di
importazione, appesantendo il bundle di quelle pagine specifiche.
`pdf-lib` è correttamente confinato lato server (`import "server-only"` in
`src/lib/documenti/pdf.ts`, verificato in Fase 1/2), quindi non pesa sul
bundle del browser nonostante generi tutti i PDF del prodotto. Nessuna
dipendenza di produzione risulta superflua rispetto allo scopo che serve.

---

## 2. Backup e continuità

### 2.1 Cosa è verificabile dal codice — e cosa non lo è

**Ricerca esaustiva** di configurazione di backup nel repository (parole
chiave: backup, disaster recovery, point-in-time, PITR, retention, cron)
su `src/`, `supabase/`, `.vercel/`, `README.md`, `IDEE-FUTURE.md`,
`legale/*.md`: **nessuna configurazione di backup esiste nel codice**.
Non c'è uno script di `pg_dump`, non c'è un cron job di esportazione, non
c'è un workflow CI (coerente con l'assenza di CI già rilevata in Fase 0),
non c'è una variabile d'ambiente dedicata.

**La stessa bozza di DPA del progetto ammette di non saperlo**: ho
verificato che `legale/dpa-BOZZA.md`, art. 3.8 (riga 115), riporta
testualmente *"Cifratura dei dati a riposo e procedure di backup gestite
dal fornitore di database secondo le proprie politiche:
`[DA VERIFICARE E DOCUMENTARE — vedi domande aperte]`"*. Questo conferma,
dalla viva voce del progetto stesso, che la strategia di backup effettiva
**non è stata ancora documentata nemmeno internamente**, non solo che non
è visibile da questo audit del codice.

### 2.2 Rilievo

### CONT-01 — Nessuna strategia di backup/DR documentata né verificabile per database e storage
- **Gravità**: alta
- **File**: nessuno (assenza), confermata in `legale/dpa-BOZZA.md` riga 115
- **Descrizione**: il database (Postgres via Supabase) e lo storage dei
  documenti (bucket Supabase Storage) sono gestiti da servizi di terzi che
  **offrono** backup automatici e, a seconda del piano, point-in-time
  recovery — ma **quale piano Supabase sia effettivamente attivo per
  questa installazione, se il PITR sia abilitato, e qual sia la frequenza
  e la retention effettiva dei backup non è determinabile da questo
  codice**. Non lo invento né lo stimo: va controllato direttamente nel
  pannello Supabase (Project Settings → Database → Backups) e, per gli
  asset serviti da Vercel, nelle impostazioni del progetto Vercel. Lo
  stesso vale per lo storage dei documenti: non risulta, né nel codice né
  nella documentazione, alcun meccanismo applicativo di backup/esportazione
  periodica indipendente dal fornitore.
- **Impatto concreto**: in caso di cancellazione accidentale, corruzione o
  incidente presso il fornitore, il recupero dipende **interamente** da
  cosa il piano Supabase/Vercel attivo prevede — che oggi nessuno
  all'interno del progetto (nemmeno i suoi stessi documenti legali) ha
  verificato e scritto da qualche parte.
- **Rimedio**: verificare e documentare (anche solo in una riga del
  `README.md` o in `legale/dpa-BOZZA.md` al posto del placeholder) il
  piano Supabase attivo, se il PITR è abilitato e per quanti giorni,
  la politica di backup di Vercel per eventuali asset statici, e valutare
  un'esportazione periodica indipendente (anche un semplice `pg_dump`
  schedulato) per non dipendere da un solo fornitore per il disaster
  recovery.
- **Riferimento**: art. 32, par. 1, lett. c), GDPR (capacità di ripristinare
  tempestivamente disponibilità e accesso in caso di incidente).

### 2.3 Integrità, versionamento e conservazione dei documenti

Richiamo (non riapro) quanto già accertato in Fase 3 (FEAT-09) e Fase 4
(nota sulla dichiarazione "sessione max un'ora" e sui `security definer`):
i documenti non hanno un meccanismo di data certa qualificata, solo
timestamp applicativi. Aggiungo qui, specificamente per questa fase, due
osservazioni di continuità **verificate nel codice**:

- **Nessun versionamento applicativo dei documenti**: ho verificato in
  Fase 1 che `aggiornaDocumento` (`src/app/admin/documenti/actions.ts`)
  modifica solo i metadati (titolo, descrizione, categoria), mai il file;
  per sostituire il file stesso l'unico percorso è `eliminaDocumento`
  (che rimuove la riga **e** il file dal bucket) seguito da un nuovo
  caricamento. **Non esiste quindi una cronologia delle versioni di un
  documento**: una volta eliminato un file, non resta traccia applicativa
  di quale fosse, salvo che per il verbale d'assemblea, dove
  `firme_verbale.verbale_url_confermato` registra specificamente quale
  versione del file era in vigore al momento di una conferma OTP (un
  meccanismo puntuale, non generale).
- **Cosa succede ai dati in caso di cessazione del servizio**: qui la
  bozza di DPA (art. 10, già letta in Fase 3) è esplicita e **coerente con
  quanto verificato nel codice**: alla cessazione il fornitore
  restituisce o cancella i dati a scelta del titolare (amministratore),
  con un periodo di conservazione transitoria la cui durata è però
  ancora un placeholder (`[30/60/90] giorni — DA DECIDERE`, già segnalato
  in Fase 3, FEAT-08). Non ho trovato nel codice applicativo alcuna
  funzione di esportazione massiva "un clic" dei dati di un condominio
  (es. uno zip con tutti i documenti + un export dei dati strutturati):
  l'export esiste solo implicitamente tramite i singoli download di
  documento e le funzioni di generazione PDF già censite in Fase 0,
  **non** come operazione unica.

### CONT-02 — Nessuna funzione di esportazione completa dei dati di un condominio
- **Gravità**: media
- **File**: nessuno trovato (ricerca di "esporta"/"export" lato admin
  oltre ai singoli download di documento e PDF già censiti in Fase 0:
  nessuna funzione di export massivo)
- **Descrizione**: la bozza di DPA promette (art. 10.1.a) la restituzione
  dei dati "in formato strutturato e di uso comune" alla cessazione del
  rapporto, ma **non esiste nel codice una funzione che lo faccia**: oggi
  un amministratore che lasciasse il servizio dovrebbe scaricare
  manualmente, documento per documento, spesa per spesa, tutto quanto
  serve per ricostruire l'archivio che per legge deve conservare per 10
  anni (art. 1130-bis c.c., già rilevato in Fase 3).
- **Impatto concreto**: rischio operativo concreto per l'amministratore in
  caso di cambio di fornitore o di cessazione del servizio, e promessa
  contrattuale (DPA art. 10.1.a) che il prodotto non è ancora in grado di
  assolvere con un'azione dedicata.
- **Rimedio**: una funzione di export per condominio (es. uno zip
  contenente: CSV di spese/ripartizioni/anagrafiche/assemblee + tutti i
  documenti del bucket per quel condominio) risolverebbe sia la promessa
  contrattuale sia l'onere di conservazione decennale dell'amministratore.
- **Riferimento**: art. 20 GDPR (portabilità, per la parte di dati
  personali); art. 1130-bis c.c. (onere di conservazione in capo
  all'amministratore, già approfondito in Fase 3); coerenza con
  `legale/dpa-BOZZA.md` art. 10.1.a.

---

## 3. Confronto competitivo

> Come richiesto: distinguo sempre ciò che ho verificato da fonti
> consultabili (con link in coda a ogni punto) da ciò che è una mia stima.
> Le ricerche sono state eseguite ora, nell'ottobre 2026.

### 3.1 Chi sono i concorrenti italiani (verificato)

Principali piattaforme di gestione condominiale rivolte al mercato
italiano, emerse dalle ricerche: **Danea Domustudio** (con l'app
condòmino **MioCondominio**), **TeamSystem** (piattaforma **TS Condomini**,
CRM **Multidomus**, integrazioni con Domustudio/Brainware/Arcadia/Ystabili),
**Millesimo** (ONE/TEN/FULL, uno dei gestionali più diffusi per numero di
installazioni), **Metodo Condomini** (con versione "Personal" gratuita per
piccoli amministratori), **Condomanager**, **Arcadia** (con app dedicata
per i condòmini), **Kipò Condominio** (cloud, con app gratuita), **Collega
Condominio** (gratuito fino a 5 appartamenti, dichiara conformità agli
artt. 1129/1130-bis c.c.), **Condexo**, **Eligo**, **VerbaliAI** (verbali
generati con IA da una registrazione audio).
*(Fonti: vedi i link citati nei punti sotto, dove le singole funzionalità
sono attribuite a ciascun prodotto.)*

### 3.2 Funzionalità presenti nei concorrenti e assenti (o diverse) in questo portale

| Funzionalità di mercato | Verificato in almeno un concorrente | Presente in questo portale? | Quanto pesa l'assenza |
|---|---|---|---|
| **App mobile nativa (iOS/Android)** per il condòmino | Sì — MioCondominio, Arcadia, Kipò, Collega Condominio, Resolvido Condominio offrono tutte un'app nativa per saldare le quote e consultare la propria posizione | **No**: solo web responsive (già annotato come idea futura in `IDEE-FUTURE.md`, verificato in Fase 0) | **Alto per l'adozione da parte del condòmino finale**: è oggi uno standard di fatto del mercato consumer, non un plus. Una web app responsive coperta bene (verificato in Fase 2: design accessibile e mobile-friendly) riduce ma non elimina lo svantaggio percepito rispetto a un'icona sulla home del telefono. |
| **Firma digitale qualificata/avanzata del verbale**, non solo tracciamento OTP | Sì — VerbaliAI applica "firma digitale automatica" prima della pubblicazione; Condexo genera il verbale con "firma digitale automatica" | No — disclaimer esplicito nel prodotto stesso: il meccanismo OTP "non è una firma elettronica con valore legale" (già verificato in Fase 2/3, e in `IDEE-FUTURE.md` come scelta deliberata e rimandata) | **Medio-alto**: per amministratori di studi più grandi o per assemblee contenziose, l'assenza di valore legale pieno può essere un motivo di scelta di un concorrente, anche se il meccanismo attuale è onestamente dichiarato e ben progettato per quello che è. |
| **Assemblea e voto interamente da remoto con valore legale pieno** | Sì — Condexo dichiara assemblee online "legalmente valide secondo la normativa italiana" con "televoto" | Parziale — il link di videoconferenza è "di cortesia" (già verificato in `IDEE-FUTURE.md`/Fase 0): il voto formale resta legato a presenza/delega, non a un collegamento da remoto come modalità di voto autonoma | Medio: dipende da quanto la clientela target tenga a questa modalità; la riforma italiana lo consente, non lo impone. |
| **Fatturazione elettronica** (ricezione/registrazione fatture fornitori via SDI) | Sì — TeamSystem offre "TS Condomini Fatture" con importazione automatica delle fatture elettroniche e conservazione sostitutiva | No — le spese si registrano manualmente con un giustificativo allegato (verificato in Fase 0/1: nessuna integrazione SDI trovata nel codice) | Medio: rilevante soprattutto per studi di amministrazione con grandi volumi di fornitori, meno per piccoli condomìni. |
| **Conservazione sostitutiva a norma** (valore legale di conservazione documentale, non solo storage privato) | Sì — citata esplicitamente da TeamSystem come parte del servizio fatture | No — lo storage è privato e sicuro (verificato in Fase 4) ma non è "conservazione sostitutiva" nel senso tecnico-normativo (nessuna marca temporale qualificata, nessun processo di conservazione a norma AgID) | Coerente con il gap già segnalato in Fase 3 (FEAT-09, data certa): qui trova conferma di mercato, non è solo un'osservazione interna. |
| **Adempimenti fiscali integrati** (F24, 770, CU) | Sì — TeamSystem "TS Condomini CAF" | No — fuori perimetro dichiarato del prodotto (nessuna evidenza nel codice, e nessuna sezione del sito lo promette) | Basso-medio: molti amministratori li gestiscono comunque tramite un commercialista/CAF esterno indipendentemente dal gestionale. |
| **Pagamento dei fornitori dall'app** (disposizioni di bonifico in uscita) | Sì — TeamSystem Pay | No — il portale gestisce solo l'incasso delle quote in entrata (Stripe), non i pagamenti in uscita verso i fornitori (verificato in Fase 0/1: nessuna funzione di questo tipo nel codice) | Medio: è un flusso di lavoro reale per l'amministratore, oggi totalmente fuori dal prodotto. |
| **Generazione IA dei verbali da audio** | Sì — VerbaliAI | No | Basso-medio: funzionalità emergente nel 2026, non ancora uno standard atteso da ogni prodotto. |
| **Gestione di molti condomìni per uno studio di amministrazione** (multi-tenant lato amministratore) | Sì — Millesimo FULL dichiara condomìni illimitati | **Sì** — verificato in Fase 4: il modello `amministratore_id` su `condomini` supporta nativamente più condomìni per amministratore, con isolamento RLS | Nessuna assenza: parità con il mercato. |
| **Registro di anagrafe condominiale conforme ai dati minimi di legge** | Sì — più fonti (incl. uno dei concorrenti gratuiti, Collega Condominio, che dichiara esplicitamente conformità agli artt. 1129/1130-bis c.c.) indicano che il registro deve contenere anche codice fiscale, dati catastali e condizioni di sicurezza delle parti comuni | **No** — gap già accertato in modo indipendente in Fase 3 (FEAT-01) leggendo il codice; questa ricerca di mercato lo conferma dall'esterno come uno standard atteso, non un dettaglio | Il gap più rilevante di tutta questa fase, perché tocca direttamente la conformità normativa di una feature già presente, non una feature mancante del tutto. |

### 3.3 Dove questo portale è alla pari o meglio posizionato (osservazione equilibrata, non solo gap)

- **Qualità dell'accessibilità e del design system**: nessuna delle fonti
  consultate in questa ricerca di mercato menziona l'accessibilità come
  punto di forza dei concorrenti citati; quanto verificato in Fase 2 per
  questo portale (contrasto, focus, dialoghi accessibili, componenti
  riusati in modo consistente) è **una mia osservazione interna basata
  sul codice**, non un confronto diretto — non ho elementi per affermare
  se i concorrenti siano migliori o peggiori su questo asse, perché
  richiederebbe testarli direttamente, fuori perimetro di questa fase.
- **Trasparenza sulle scelte e sui limiti**: il livello di onestà
  riscontrato nei commenti del codice e nelle bozze legali di questo
  progetto (dichiarare esplicitamente cosa NON è una firma legale, cosa
  NON è conservazione sostitutiva, quali limiti ha la riconciliazione) è
  **una mia impressione qualitativa** dalla lettura diretta, non un dato
  comparabile con la documentazione dei concorrenti, che non ho
  analizzato con lo stesso livello di detaglio.
- **Prezzo**: Fase 3 ha accertato che oggi non esiste alcun flusso di
  monetizzazione del servizio stesso nel codice (nessuna feature di
  abbonamento). Le fonti di questa fase riportano fasce di prezzo indicate
  per alcuni concorrenti (**stima/fonte terza, non verificata
  direttamente da un sito ufficiale del singolo fornitore in questa
  sessione**: Domustudio €5-8/unità/mese, TeamCondomi €4-7/unità/mese,
  Condomanager €3-6/unità/mese secondo una delle fonti aggregatrici
  consultate) — un termine di paragone utile per una futura decisione di
  pricing, ma da verificare direttamente sui siti dei singoli fornitori
  prima di usarlo in una decisione commerciale.

### Fonti consultate in questa fase (ricerche web del 2026-10-28)

- [I 7 Migliori Software Condominio con AI a Confronto [2026]](https://studioagent.it/blog/migliori-software-condominio-ai-confronto)
- [Software per Condominio in Italia — SystemForge Blog](https://systemforge.it/blog/software-condominio-gestione-amministratore-italia/)
- [Software amministratore condominio: prezzi e confronto](https://www.regimeminimi.com/software-amministratore-condominio/)
- [Piattaforma TS Condomini — Guida (PDF)](https://mktg.teamsystem.com/hubfs/Condomini/Guida_piattaforma_TS_Condomini.pdf)
- [Fatturazione elettronica per il condominio — TeamSystem](https://www.teamsystem.com/condomini/fattura-elettronica/)
- [CRM condominio Multidomus — TeamSystem](https://www.teamsystem.com/condomini/multidomus/)
- [TeamSystem Pay per Danea Domustudio (PDF)](https://www.teamsystem.com/media/files/1031_2_TeamSystem-Pay-per-Danea-Domustudio.pdf)
- [Millesimo ONE/TEN/FULL — FISCOeTASSE.com](https://www.fiscoetasse.com/BusinessCenter/scheda/22010-Millesimo-ONE-Software-per-l-amministrazione-di-Condominio.html)
- [Metodo Condomini](https://www.metodo.com/condomini)
- [Assemblea condominiale con Domustudio](https://www.danea.it/software/domustudio/assemblea-condominiale/)
- [VerbaliAI](https://www.verbaliai.it/)
- [Condexo — Assemblea condominiale](https://condexo.it/assemblea-condominiale/)
- [Eligo — Assemblea di condominio online](https://www.eligo.social/assemblea-di-condominio-online/)
- [Registro anagrafe condominiale — Danea](https://www.danea.it/blog/registro-anagrafe-condominiale/)
- [Registro di anagrafe condominiale: quali dati deve contenere?](https://www.quotidianodelcondominio.it/giurisprudenza-in-condominio/dottrina-condominiale/registro-anagrafe-condominiale-quali-dati-deve-contenere/)
- [Collega Condominio](https://collegacondominio.it/)
- [MioCondominio — Danea](https://www.danea.it/software/domustudio/miocondominio/)
- [Kipò Condominio](https://kipocondominio.it/software/condominio/)
- [L'App Arcadia dedicata ai condomini](https://arcadiasoftware.it/2021/11/arcadia-app-condomini/)

---

## Riepilogo rilievi di questa fase

| ID | Titolo | Gravità |
|---|---|---|
| DEP-01 | `next` ha 1 vulnerabilità critica + diverse alte, fix minor disponibile | alta |
| DEP-02 | `exceljs`→`uuid` vulnerabile, nessun fix diretto (serve override) | media |
| DEP-03 | `pdf-lib` fermo da 4 anni, genera tutti i documenti legali del prodotto | alta |
| DEP-04 | `exceljs` stabile fermo da 2 anni | media |
| CONT-01 | Nessuna strategia di backup/DR verificabile né documentata (ammesso dal progetto stesso) | alta |
| CONT-02 | Nessuna funzione di esportazione completa dei dati di un condominio | media |
| (mercato) | Registro anagrafe condominiale incompleto rispetto allo standard atteso (conferma esterna di FEAT-01) | richiama Fase 3 |
| (mercato) | Nessuna app mobile nativa, standard di fatto nel settore | media (prodotto, non sicurezza) |
| (mercato) | Nessuna firma digitale con valore legale pieno, offerta da almeno 2 concorrenti verificati | richiama Fase 3 |

---

Nessun file del progetto è stato modificato in questa fase, a parte la
creazione di questo stesso documento in
`docs/audit/05-dipendenze-continuita-mercato.md`.
