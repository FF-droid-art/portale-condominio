# INFORMATIVA SULL'USO DEI COOKIE

**Versione:** bozza 1.0 — **Ultimo aggiornamento:** `[DATA]`

> **AVVISO — DOCUMENTO IN BOZZA.** Da sottoporre a verifica legale prima della pubblicazione.

---

## 1. In sintesi

**Questo sito non chiede il consenso ai cookie, e non lo fa perché non ne ha bisogno.**

Il portale utilizza esclusivamente **cookie tecnici**, necessari a farlo funzionare: servono a mantenere l'utente autenticato tra una pagina e l'altra e a gestire in sicurezza la funzione di assistenza. Non sono presenti cookie di profilazione, cookie pubblicitari, pixel di tracciamento, né strumenti di analisi statistica di terze parti (Google Analytics o equivalenti). Nessun dato di navigazione è ceduto a terzi per finalità commerciali.

Per questa ragione **non è presente alcun banner di consenso**: ciò che vedete è un'informativa, non una richiesta.

---

## 2. Perché non serve il consenso

L'art. 122, comma 1, del d.lgs. 196/2003 (Codice in materia di protezione dei dati personali), in attuazione della direttiva 2002/58/CE, esclude dall'obbligo di consenso l'archiviazione di informazioni nel dispositivo dell'utente quando ciò è **strettamente necessario** al fornitore per erogare un servizio esplicitamente richiesto dall'utente.

Le **Linee guida cookie e altri strumenti di tracciamento** adottate dal Garante per la protezione dei dati personali il **10 giugno 2021** (doc. web n. 9677876, applicabili dal 10 gennaio 2022) confermano che i cookie tecnici — tra cui espressamente quelli di **autenticazione e di sessione** — possono essere utilizzati senza acquisire il consenso dell'utente, fermo restando l'obbligo di fornire **un'informativa adeguata**. Questo documento assolve tale obbligo.

Resta inteso che **nessun cookie viene installato prima dell'autenticazione** oltre a quelli che l'autenticazione stessa richiede: la pagina pubblica di presentazione non installa cookie.

---

## 3. Elenco dei cookie utilizzati

### 3.1 Cookie di sessione e autenticazione (Supabase Auth)

| Caratteristica | Descrizione |
|---|---|
| **Nome** | `sb-<identificativo-progetto>-auth-token` (il cookie può essere suddiviso in più parti numerate, es. `...-auth-token.0`, `...-auth-token.1`, quando il contenuto eccede la dimensione massima di un singolo cookie) |
| **Tipo** | Tecnico — strettamente necessario |
| **Origine** | Prima parte (impostato dal dominio del portale) |
| **Finalità** | Mantenere l'utente autenticato tra una pagina e l'altra, senza dover reinserire le credenziali ad ogni richiesta. Contiene il token di sessione rilasciato dal servizio di autenticazione |
| **Durata** | Durata della sessione, con rinnovo automatico del token finché l'utente resta attivo; eliminato al logout |
| **Consenso** | Non richiesto |

### 3.2 Cookie della funzione "visualizza come" (assistenza)

| Caratteristica | Descrizione |
|---|---|
| **Nome** | `admin_return_session` |
| **Tipo** | Tecnico — strettamente necessario |
| **Origine** | Prima parte |
| **Finalità** | Quando un amministratore attiva la funzione di assistenza "visualizza come" per vedere il portale dal punto di vista di un proprio utente, questo cookie conserva i riferimenti della sessione amministrativa originaria, così da poterla ripristinare al termine, insieme ai nomi mostrati nel banner di avviso |
| **Durata** | **Massimo 1 ora**, oppure fino al termine manuale della sessione di assistenza |
| **Caratteristiche di sicurezza** | `HttpOnly` (non leggibile dal codice JavaScript della pagina), `Secure` in ambiente di produzione (trasmesso solo su connessione cifrata), `SameSite=Lax` |
| **Consenso** | Non richiesto |

### 3.3 Cookie di terze parti: nessuno sul nostro dominio

Il portale **non installa cookie di terze parti**.

Va tuttavia segnalato che, quando un condòmino avvia il pagamento online di una quota, viene **reindirizzato su pagine ospitate da Stripe** (dominio `checkout.stripe.com`). Quelle pagine non appartengono al portale e installano cookie propri, necessari al funzionamento del pagamento e alla prevenzione delle frodi. Per quei cookie si applicano l'informativa e la cookie policy di Stripe, consultabili su `stripe.com/privacy` e `stripe.com/cookies-policy/legal`. Il portale non ha accesso a quei cookie né alle informazioni che contengono.

Inoltre, a partire dall'introduzione della protezione anti-bot sulla registrazione, la pagina `/registrazione` carica il widget **Cloudflare Turnstile**, che può impostare un proprio cookie tecnico per la verifica anti-abuso. Non è un cookie di profilazione: serve esclusivamente a distinguere un utente umano da un bot al momento dell'invio del modulo. Si applica l'informativa di Cloudflare (`cloudflare.com/privacypolicy`).

### 3.4 Strumenti assenti

Per trasparenza: il portale **non utilizza** Google Analytics o altri sistemi di statistica, non utilizza pixel di Meta, LinkedIn o altre piattaforme pubblicitarie, non utilizza font caricati da server esterni che possano registrare l'indirizzo IP del visitatore, non utilizza mappe, video incorporati o widget di terze parti (salvo quanto indicato al § 3.3 per il pagamento e per la protezione anti-bot).

---

## 4. Log del server (non sono cookie)

Indipendentemente dai cookie, i fornitori di hosting (Vercel) e di database (Supabase) registrano automaticamente **log tecnici** delle richieste ricevute, che possono includere indirizzo IP, data e ora, pagina richiesta e tipo di browser. Sono generati per finalità di sicurezza, diagnostica e prevenzione degli abusi, sulla base del legittimo interesse alla sicurezza dei sistemi (art. 6.1.f GDPR), non sono usati per identificare o profilare gli utenti, e sono conservati secondo le politiche dei rispettivi fornitori. Si veda il § 7 dell'Informativa privacy.

---

## 5. Come gestire i cookie dal browser

Può in ogni momento eliminare i cookie o impedirne l'installazione agendo sulle impostazioni del Suo browser (Chrome, Firefox, Safari, Edge: sezione "Privacy e sicurezza"). **Attenzione:** bloccando i cookie tecnici di sessione **non sarà più possibile accedere all'area riservata del portale**, perché il sistema non potrà riconoscerla da una pagina all'altra.

---

## 6. Riferimenti e contatti

Per qualsiasi chiarimento: `[EMAIL PRIVACY]`. Per il quadro completo dei trattamenti si rinvia all'**Informativa sul trattamento dei dati personali** disponibile su `[URL]/privacy`.
