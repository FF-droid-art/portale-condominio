# INFORMATIVA SUL TRATTAMENTO DEI DATI PERSONALI
### (artt. 13 e 14 Regolamento UE 2016/679 – GDPR)

**Versione:** bozza 1.0 — **Ultimo aggiornamento:** `27 ottobre 2026 (bozza demo)`

> **AVVISO — DOCUMENTO IN BOZZA.** Testo tecnico predisposto sulla base dei dati effettivamente trattati dal portale. Da sottoporre a verifica legale prima della pubblicazione.

---

## 1. Premessa: chi fa cosa

Il portale `Portale Condominio` è uno strumento software utilizzato dagli **amministratori di condominio** per gestire i condomìni di cui hanno ricevuto incarico.

Questo comporta una distinzione importante:

- **Titolare del trattamento** dei dati dei condòmini è **l'amministratore di condominio** che utilizza il portale per il Suo condominio. È lui che decide quali dati raccogliere, per quali finalità e per quanto tempo conservarli, in esecuzione del mandato conferitogli dall'assemblea e degli obblighi che il codice civile gli impone.
- **Responsabile del trattamento** ai sensi dell'art. 28 GDPR è **`Portale Condominio Demo S.r.l.`**, che fornisce la piattaforma e tratta i dati esclusivamente su istruzione documentata dell'amministratore, nei limiti dell'accordo di nomina sottoscritto con ciascun amministratore cliente.

**Se Lei è un condòmino**: il titolare a cui rivolgersi per esercitare i Suoi diritti è il Suo amministratore di condominio. Trova i suoi recapiti nella sezione "Condominio" della Sua area riservata, oppure negli avvisi che ha ricevuto. Può comunque scrivere anche al gestore del portale all'indirizzo indicato al § 10: la richiesta sarà inoltrata senza ritardo all'amministratore competente.

**Se Lei è un amministratore di condominio cliente del servizio**: per i dati del Suo account professionale (nome, cognome, email di accesso) e per la gestione del rapporto contrattuale con il portale, titolare del trattamento è `Portale Condominio Demo S.r.l.`. Per i dati dei Suoi condòmini, titolare è Lei.

---

## 2. Dati di contatto

| | |
|---|---|
| **Gestore del portale (responsabile del trattamento)** | `Portale Condominio Demo S.r.l.` |
| **Sede legale** | `Via Esempio 1, 00100 Roma (RM)` |
| **Partita IVA / Codice fiscale** | `00000000000 (dato di esempio)` |
| **Email per questioni privacy** | `privacy@portalecondominio-demo.it` |
| **PEC** | `portalecondominiodemo@pec.it` |
| **Responsabile della protezione dei dati (DPO)** | `Non nominato — valutazione in corso, vedi sezione finale` |

---

## 3. Quali dati trattiamo davvero

L'elenco che segue corrisponde alle informazioni effettivamente memorizzate dal portale. Non sono raccolti dati ulteriori rispetto a quelli qui indicati.

### 3.1 Dati dell'account di accesso
Nome, cognome, indirizzo email, ruolo nel portale (amministratore o condòmino), data di creazione dell'account.
La **password non è mai conservata dal portale in chiaro né in alcuna forma leggibile**: la gestione delle credenziali è affidata al servizio di autenticazione Supabase Auth, che conserva esclusivamente un'impronta crittografica della password.

### 3.2 Anagrafica del condominio (registro di anagrafe condominiale)
Nominativo o ragione sociale, indirizzo email, numero di telefono, qualificazione del soggetto (persona fisica o società).
Per ogni unità immobiliare: identificativo dell'unità, piano, millesimi di proprietà, eventuali tabelle millesimali aggiuntive (ascensore, riscaldamento, ecc.), quota di possesso e **titolo in base al quale la persona è collegata all'unità**: proprietario, nudo proprietario, usufruttuario, conduttore, comodatario, oltre all'indicazione se al soggetto spetti o meno il diritto di voto.

> Nota: una persona può essere presente in anagrafica **anche senza avere un account di accesso** (è il caso di chi non si è mai registrato al portale, delle società, degli ex proprietari il cui legame è conservato come storico). In tal caso il portale tratta i suoi dati pur non avendo alcun rapporto diretto con lei: questa informativa vale anche per tali soggetti ai sensi dell'art. 14 GDPR, e i dati provengono dall'amministratore di condominio, che li ha acquisiti nell'esercizio del mandato (tipicamente dai verbali di assemblea, dagli atti di compravendita comunicati e dalle comunicazioni dei condòmini stessi).

### 3.3 Dati contabili e di pagamento
- **Spese del condominio**: descrizione, importo, categoria, data, nome del fornitore, documento giustificativo allegato (tipicamente la fattura).
- **Ripartizione a carico di ciascuna unità**: importo dovuto, stato del pagamento (da pagare / pagato / in ritardo), data di scadenza, data dell'eventuale pagamento, codice avviso di pagamento.
- **Posizioni di morosità e solleciti**: per ciascun sollecito emesso, l'unità interessata, il livello del sollecito (primo, secondo, terzo), l'importo complessivo scaduto, la data di invio, l'amministratore che lo ha emesso ed eventuali note.
- **Movimenti bancari importati** dall'amministratore per la riconciliazione: data, importo, descrizione dell'operazione, riferimento bancario (CRO/TRN quando presente), stato dell'abbinamento alla quota corrispondente.
- **Dati del conto corrente del condominio**: IBAN, banca, intestatario. Sono dati informativi del condominio, non di un singolo condòmino, e non consentono al portale alcuna operazione bancaria.

> **Sui dati di morosità.** Le informazioni sulle quote non versate hanno un impatto significativo sulla sfera personale e reputazionale dell'interessato. Il portale è progettato di conseguenza: i solleciti sono inviati **individualmente al singolo destinatario**, mai in copia visibile ad altri condòmini; gli avvisi collettivi sono inviati **in copia nascosta (BCC)**; il prospetto delle posizioni individuali è visibile al solo amministratore. L'eventuale diffusione dell'elenco dei morosi all'interno del condominio (in bacheca, in assemblea, nelle comunicazioni collettive) è una scelta che resta in capo all'amministratore titolare, ed è oggetto di un orientamento restrittivo costante del Garante per la protezione dei dati personali: il portale non la agevola né la esegue automaticamente.

### 3.4 Dati relativi alle assemblee
Data, tipo (ordinaria o straordinaria), convocazione (prima o seconda), luogo, eventuale link alla videoconferenza, stato; ordine del giorno; **presenze** (unità, persona, modalità di partecipazione — di persona, da remoto o per delega — millesimi rappresentati, ora di ingresso e di uscita, eventuali note e indicazione di chi ha registrato la presenza); **deleghe** (unità delegante, unità delegataria, persona delegata); **voti espressi** (punto all'ordine del giorno, unità, persona, scelta espressa — favorevole, contrario, astenuto — millesimi rappresentati, data e ora del voto).

> **Attenzione: il voto non è anonimo.** Il portale registra nominativamente la scelta espressa da ciascun avente diritto, perché è così che funziona il voto assembleare condominiale, dove il verbale deve dare conto dei nomi dei dissenzienti ai fini dell'impugnazione (art. 1137 c.c.). Il dato è visibile all'amministratore e confluisce nel verbale.

### 3.5 Conferma del verbale di assemblea
Per i soggetti chiamati a confermare il verbale (presidente, segretario, amministratore): nominativo, email, ruolo, data e ora della conferma, riferimento alla versione del documento confermata. Il codice usa-e-getta inviato via email **non viene mai conservato in chiaro**: nel database finisce soltanto la sua impronta crittografica SHA-256, con scadenza a 15 minuti e un numero massimo di 5 tentativi.

> Questa conferma **non è una firma elettronica con valore legale** ai sensi del Regolamento eIDAS o del Codice dell'Amministrazione Digitale: è la registrazione tracciata di un'approvazione.

### 3.6 Segnalazioni, manutenzioni e fornitori
- **Segnalazioni**: titolo, descrizione in testo libero, categoria, priorità, stato, unità interessata (oppure parti comuni), autore della segnalazione, eventuale **fotografia allegata**, date di apertura, aggiornamento e chiusura.
- **Note sulle segnalazioni**: autore, testo, e un contrassegno "nota interna" che indica se la nota è di servizio dell'amministratore e quindi non visibile al condòmino.
- **Fornitori**: denominazione, categoria di attività, nominativo del referente, email, telefono, partita IVA, note. Quando il fornitore è un professionista o una ditta individuale, si tratta di dati personali a tutti gli effetti.
- **Manutenzioni programmate**: titolo, descrizione, data prevista, periodicità, stato, costo previsto, fornitore e spesa collegati.

> **Avvertenza sul testo libero e sulle fotografie.** I campi descrittivi delle segnalazioni e le immagini caricate possono contenere, per iniziativa di chi li compila, informazioni non previste e potenzialmente appartenenti a categorie particolari di dati (art. 9 GDPR) — per esempio il riferimento a una condizione di salute a giustificazione di una richiesta, oppure l'immagine riconoscibile di una persona. **Il portale non è progettato per trattare categorie particolari di dati e ne sconsiglia espressamente l'inserimento.** Chi compila una segnalazione è invitato a limitarsi a ciò che serve per far intervenire il tecnico.

### 3.7 Documenti e archivio
Documenti caricati dall'amministratore (regolamento, planimetrie, polizze, bilanci, contratti, certificazioni, altro) con titolo, descrizione, categoria, nome del file, dimensione, tipo di file, autore del caricamento e data. I file sono conservati in uno spazio di archiviazione **privato**, non raggiungibile tramite URL pubblico e accessibile soltanto previa verifica dei permessi dell'utente richiedente.

### 3.8 Consultazioni, spazi comuni, preferenze
- **Sondaggi non deliberativi**: domanda, opzioni e, per ciascuna risposta, l'unità, la persona che ha risposto e i millesimi rappresentati. **Anche le risposte ai sondaggi sono quindi nominative**, non anonime.
- **Prenotazioni di spazi comuni**: spazio, unità, persona, data e ora di inizio e fine, eventuali note, stato.
- **Preferenze di notifica**: per ciascun tipo di avviso, se l'utente ha scelto di riceverlo o meno via email.

### 3.9 Dati tecnici
Il portale non utilizza strumenti di analisi statistica, profilazione, pubblicità o tracciamento di terze parti. **Non sono presenti cookie di profilazione, pixel, né servizi di analytics.** I soli dati tecnici trattati sono quelli necessari al funzionamento: cookie di sessione (si veda la Cookie Policy) e i log tecnici del fornitore di hosting e del database, generati automaticamente per finalità di sicurezza e diagnostica.

### 3.10 Dati che il portale NON tratta
Per chiarezza:
- **Dati di pagamento con carta.** Quando un condòmino paga una quota online, viene reindirizzato alle pagine di pagamento ospitate da Stripe. **Numero di carta, scadenza e codice di sicurezza non transitano mai dai server del portale e non vengono mai memorizzati.** Il portale conserva unicamente l'identificativo della sessione di pagamento e l'esito (pagato / non pagato).
- **Dati catastali, codice fiscale dei singoli condòmini, documenti di identità.** Lo schema attuale non prevede questi campi a livello di singola persona. Il codice fiscale è previsto solo per il condominio in quanto tale. *(Si veda la domanda aperta sul registro di anagrafe condominiale ex art. 1130 n. 6 c.c.)*
- **Dati di geolocalizzazione, biometrici, giudiziari.**

---

## 4. Perché trattiamo questi dati e su quale base giuridica

| Finalità | Base giuridica (art. 6 GDPR) |
|---|---|
| Tenuta del registro di anagrafe condominiale, dei registri dei verbali, di nomina e revoca dell'amministratore e di contabilità | **Obbligo legale** (art. 6.1.c) — art. 1130 nn. 6 e 7 c.c. |
| Riparto delle spese, emissione e incasso delle quote, rendicontazione annuale | **Obbligo legale** ed **esecuzione del rapporto condominiale** (art. 6.1.c e 6.1.b) — artt. 1123, 1130 n. 10, 1130-bis c.c. |
| Convocazione delle assemblee, gestione di deleghe, presenze, votazioni, redazione e conservazione dei verbali | **Obbligo legale** (art. 6.1.c) — artt. 1136, 1137 c.c., art. 66 disp. att. c.c. |
| Recupero delle quote non versate: solleciti, costituzione in mora, azioni di recupero | **Obbligo legale** e **legittimo interesse** del condominio alla riscossione (art. 6.1.c e 6.1.f) — art. 63 disp. att. c.c. |
| Conservazione e consultazione dei documenti del condominio | **Obbligo legale** (art. 6.1.c) — art. 1129 c.c., art. 1130-bis c.c. |
| Gestione delle segnalazioni di guasto e delle manutenzioni; rapporti con i fornitori | **Legittimo interesse** alla conservazione e manutenzione delle parti comuni (art. 6.1.f) e, per i fornitori, **esecuzione di un contratto** (art. 6.1.b) |
| Prenotazione degli spazi comuni e sondaggi non deliberativi | **Legittimo interesse** all'organizzazione della vita condominiale (art. 6.1.f) |
| Invio delle comunicazioni di servizio via email (convocazioni, avvisi di pagamento, verbali, aggiornamenti) | Le **stesse basi** della finalità a cui la comunicazione si riferisce. Non si tratta di marketing e non è richiesto il consenso: le notifiche possono comunque essere disattivate singolarmente dalla propria area riservata, **salvo quelle indispensabili** (recupero password, codici di conferma) |
| Gestione dell'account dell'amministratore cliente e del rapporto contrattuale con il portale | **Esecuzione del contratto** (art. 6.1.b) e **obblighi contabili e fiscali** (art. 6.1.c) |
| Sicurezza del servizio, prevenzione di accessi abusivi, log tecnici | **Legittimo interesse** alla sicurezza dei sistemi (art. 6.1.f) |

**Non viene richiesto consenso** perché nessuna delle finalità sopra indicate si fonda sul consenso. Non viene svolta alcuna attività di marketing, profilazione o processo decisionale automatizzato ai sensi dell'art. 22 GDPR.

---

## 5. Conferimento dei dati e conseguenze del rifiuto

Il conferimento dei dati di anagrafica, delle quote di proprietà e dei dati contabili è **necessario** per l'adempimento degli obblighi di legge dell'amministratore: non è possibile rifiutarlo senza rendere impossibile la gestione del condominio. Si ricorda che l'art. 1130 n. 6 c.c. prevede, in caso di mancata comunicazione dei dati da parte del condòmino, un meccanismo di sollecito e di acquisizione a spese dell'inadempiente.

Il conferimento del **numero di telefono** e l'uso delle funzioni facoltative (prenotazione spazi, sondaggi, segnalazioni, pagamento online) sono invece liberi.

---

## 6. Chi può vedere i Suoi dati

### 6.1 All'interno del portale
L'accesso ai dati è limitato tecnicamente, non solo organizzativamente, attraverso regole di sicurezza a livello di singola riga del database (*Row Level Security*). In concreto:

- **l'amministratore** vede i dati dei soli condomìni che gestisce;
- **il condòmino** vede i dati del proprio condominio e, per le informazioni individuali (quote a suo carico, solleciti a lui indirizzati, sue prenotazioni, suoi voti), **esclusivamente i propri**;
- le **note interne** dell'amministratore sulle segnalazioni non sono visibili al condòmino;
- i dati della morosità di un condòmino non sono accessibili agli altri condòmini attraverso il portale.

### 6.2 Verso l'esterno
I dati **non sono diffusi** e **non sono ceduti o venduti a terzi**. Possono essere comunicati a:

- **i soggetti indicati al § 7** (fornitori tecnologici che operano come responsabili o sub-responsabili);
- **professionisti incaricati dal condominio** (legale per il recupero crediti, commercialista, tecnici e fornitori per l'esecuzione degli interventi), su decisione dell'amministratore titolare;
- **autorità giudiziarie e amministrative**, nei casi previsti dalla legge.

### 6.3 Accesso tecnico del gestore del portale
Il personale tecnico del gestore del portale può accedere ai dati **solo per quanto strettamente necessario** alla manutenzione, all'assistenza e alla risoluzione dei malfunzionamenti. Il portale dispone di una funzione di **"visualizza come" (impersonazione)** che consente a un amministratore di vedere il portale con gli occhi di un proprio utente per fornirgli assistenza: la sessione è temporanea (massimo un'ora), è segnalata da un banner permanentemente visibile a schermo, ed è disponibile al solo amministratore nei confronti dei propri utenti.

---

## 7. Fornitori tecnologici (responsabili e sub-responsabili del trattamento)

| Fornitore | Ruolo nel servizio | Sede | Dati trattati | Trasferimenti extra-UE |
|---|---|---|---|---|
| **Supabase, Inc.** | Database, autenticazione, archiviazione dei documenti | USA (infrastruttura su Amazon Web Services; regioni UE disponibili) | Tutti i dati del portale | DPA pubblico con Clausole Contrattuali Standard (moduli 2 e 3) ed elenco pubblico dei sub-responsabili. **Regione di hosting di questa installazione: `eu-central-1 (Francoforte) — dato di esempio, da confermare nel pannello`** |
| **Vercel, Inc.** | Hosting dell'applicazione e consegna delle pagine | USA | Dati in transito durante l'uso del portale; log tecnici | DPA pubblico, Clausole Contrattuali Standard e UK Addendum; certificazione EU-U.S. Data Privacy Framework |
| **Resend, Inc.** | Invio delle email transazionali del portale | USA | Indirizzo email del destinatario, oggetto e contenuto del messaggio | DPA pre-sottoscritto con Clausole Contrattuali Standard; adesione all'EU-U.S. Data Privacy Framework |
| **Stripe** (Stripe Payments Europe Ltd. per i clienti europei) | Incasso delle quote condominiali online | Irlanda, con trasferimenti infragruppo verso Stripe, Inc. (USA) | Dati della transazione, dati della carta (raccolti e conservati **direttamente da Stripe**, mai dal portale) | Clausole Contrattuali Standard ed EU-U.S. Data Privacy Framework. Stripe agisce in parte come **autonomo titolare** per gli obblighi antiriciclaggio, antifrode e di normativa sui pagamenti che la legge impone direttamente a lui |

Quando viene avviato un pagamento online, l'utente lascia il portale ed è condotto su pagine ospitate da Stripe: da quel momento e per quelle pagine si applica l'informativa privacy di Stripe.

L'elenco aggiornato dei fornitori è mantenuto in questa informativa e nell'accordo di nomina sottoscritto con ciascun amministratore cliente.

---

## 8. Per quanto tempo conserviamo i dati

| Categoria | Tempo di conservazione | Fonte |
|---|---|---|
| Registri e documentazione contabile del condominio (spese, giustificativi, ripartizioni, rendiconti, movimenti) | **10 anni** dalla data della registrazione | Art. 1130-bis, comma 1, c.c. |
| Verbali di assemblea e registro dei verbali | **10 anni** (allineati alla documentazione contabile; i verbali restano inoltre nella disponibilità del condominio) | Art. 1130-bis c.c.; artt. 1130 n. 7 e 1137 c.c. |
| Registro di anagrafe condominiale (dati dei proprietari e dei titolari di diritti reali e di godimento) | Per tutta la durata del legame con l'unità e, successivamente, per **10 anni** in quanto elemento necessario a ricostruire le partite contabili | Artt. 1130 n. 6 e 1130-bis c.c. |
| Solleciti, posizioni di morosità e relative comunicazioni | Fino alla definizione della posizione debitoria e comunque per il **termine di prescrizione applicabile** al credito, salvo contenzioso in corso | `10 anni dalla definizione della posizione (termine di prescrizione ordinario — da confermare in sede legale)` |
| Account di accesso e preferenze di notifica | Per tutta la durata del rapporto, con cancellazione entro 30 giorni dalla cessazione | **Scelta aperta** |
| Segnalazioni e note, con eventuali fotografie | 24 mesi dalla chiusura della segnalazione | **Scelta aperta** |
| Prenotazioni di spazi comuni | 12 mesi dalla data della prenotazione | **Scelta aperta** |
| Sondaggi non deliberativi e relative risposte | 24 mesi dalla chiusura del sondaggio | **Scelta aperta** |
| Registrazioni di conferma del verbale (token, impronte dei codici, conferme) | Il token e l'impronta del codice perdono validità entro 15 minuti; il dato della conferma segue il verbale a cui si riferisce | — |
| Log tecnici di hosting e database | Secondo le politiche di conservazione di Vercel e Supabase | `90 giorni circa (politiche standard dei fornitori — da confermare)` |

Alla scadenza i dati sono cancellati oppure resi anonimi. **Nota di trasparenza:** allo stato attuale il portale non esegue una cancellazione automatica allo scadere dei termini; l'eliminazione avviene su iniziativa dell'amministratore titolare o del gestore su sua istruzione. *(Punto segnalato tra gli interventi da pianificare.)*

---

## 9. I Suoi diritti

Lei può in qualsiasi momento:

- **accedere** ai Suoi dati e ottenerne copia (art. 15);
- chiedere la **rettifica** dei dati inesatti o l'integrazione di quelli incompleti (art. 16);
- chiedere la **cancellazione** dei dati (art. 17), **nei limiti** in cui la conservazione non sia imposta da un obbligo di legge: i dati contabili e i verbali non possono essere cancellati prima del decorso del termine decennale;
- chiedere la **limitazione** del trattamento (art. 18);
- ricevere i dati in formato strutturato e di uso comune e trasmetterli ad altro titolare (**portabilità**, art. 20), nei limiti dei dati trattati sulla base del contratto o del consenso;
- **opporsi** al trattamento fondato sul legittimo interesse, per motivi connessi alla Sua situazione particolare (art. 21);
- **revocare** eventuali consensi prestati, senza pregiudizio per la liceità del trattamento già effettuato.

Lei può inoltre **disattivare autonomamente** le singole categorie di notifiche email dalla sezione "Notifiche" della Sua area riservata. Restano sempre attive le comunicazioni indispensabili all'accesso (recupero password, codici di conferma) e le comunicazioni che l'amministratore ha l'obbligo di legge di recapitarle, che in tal caso Le saranno inviate con altri mezzi.

**Come esercitare i diritti.** Scrivendo all'amministratore del Suo condominio (titolare del trattamento) oppure, in subordine, a `privacy@portalecondominio-demo.it`. Il riscontro è dovuto **entro un mese**, prorogabile di due mesi in casi complessi. L'esercizio dei diritti è gratuito.

**Reclamo.** Se ritiene che il trattamento violi il GDPR, può proporre reclamo al **Garante per la protezione dei dati personali** (Piazza Venezia 11, 00187 Roma — garante@gpdp.it — protocollo@pec.gpdp.it — www.garanteprivacy.it) o ricorrere all'autorità giudiziaria.

---

## 10. Sicurezza

Sono adottate le misure tecniche e organizzative descritte in dettaglio nell'Allegato B dell'accordo di nomina a responsabile (§ 3 del documento DPA), tra cui: separazione dei dati per condominio imposta a livello di database, archiviazione dei documenti in spazio privato non indicizzabile, cifratura delle comunicazioni in transito, gestione delle credenziali affidata a un servizio specializzato senza conservazione delle password, verifica crittografica dei messaggi ricevuti dal sistema di pagamento.

---

## 11. Modifiche

Questa informativa può essere aggiornata. La versione vigente è sempre pubblicata su `https://portale-condominio.vercel.app/privacy` con l'indicazione della data di ultimo aggiornamento. Le modifiche sostanziali sono comunicate via email agli utenti registrati.

---

## COSA RESTA DA DECIDERE O FAR VERIFICARE — vedi il file `COSA-RESTA-DA-DECIDERE.md` in questa cartella (è comune ai tre documenti).
