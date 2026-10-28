# Fase 2 — Sito: struttura, usabilità, visibilità

> Metodologia: come nelle fasi precedenti, ogni rilievo è verificato
> leggendo il file citato. Per i componenti riusati in decine di pagine
> (Button, Field/Input, Dialog, PageHeader, pattern di conferma distruttiva)
> ho letto l'implementazione una volta e **campionato** 2-4 punti di utilizzo
> per confermare che il pattern sia applicato davvero, non solo dichiarato —
> indicato esplicitamente dove ho campionato invece di coprire ogni pagina.
> Il coordinatore ha segnalato che round di lavoro precedenti hanno già
> toccato accessibilità/SEO: non ho dato per scontato nulla, ho verificato lo
> stato attuale di ogni file citato, inclusi `documento-legale.tsx`,
> `turnstile-widget.tsx`, `/privacy`, `/cookie` (tutti letti in questa fase).
> Nessun file del progetto è stato modificato: output solo in
> `docs/audit/02-sito.md`.
>
> Gravità: **bloccante** / **alta** / **media** / **bassa**.

---

## Cose fatte bene (verificate, non solo dichiarate nei commenti)

Il design system (`src/app/globals.css`) dichiara nei propri commenti di
seguire WCAG 2.2, Nielsen/NN/g e Refactoring UI. Prima di accettarlo per
buono ho verificato a campione che le affermazioni fossero vere nel codice
effettivo, non solo nell'intenzione:

1. **Contrasto colore verificato con calcolo manuale, non solo dichiarato.**
   Ho calcolato la luminanza relativa e il rapporto di contrasto WCAG per 3
   coppie testo/sfondo scelte come casi limite: `--muted-foreground` su
   `--background` (chiaro) = **5.53:1**; `--warning` su `--warning-bg`
   (chiaro, la coppia più a rischio della palette) = **4.85:1**; `--danger`
   su `--surface` (scuro) = **6.33:1**. Tutte superano la soglia 4.5:1 di
   **WCAG 2.2 — 1.4.3 Contrast (Minimum)** per testo normale. Campione di 3
   coppie su un totale di circa 10 definite nel file; non è una verifica
   esaustiva di ogni combinazione usata nell'interfaccia, ma le due coppie a
   margine più stretto scelte apposta passano.
2. **Un solo anello di focus globale**, mai ridefinito nei singoli
   componenti (`globals.css` righe 165-169): soddisfa **WCAG 2.2 — 2.4.7
   Focus Visible** per costruzione, non per disciplina manuale pagina per
   pagina.
3. **`Dialog` (`src/components/ui/dialog.tsx`) è un'implementazione modale
   corretta e completa**: `role="dialog"`, `aria-modal="true"`,
   `aria-labelledby`/`aria-describedby` collegati con `useId()`, focus
   spostato al primo elemento interno all'apertura, Tab trattenuto dentro il
   pannello con wraparound, Esc per chiudere, focus restituito all'elemento
   che ha aperto la modale, scroll della pagina bloccato mentre è aperta.
   Letto l'intero file (165 righe): soddisfa **WCAG 2.2 — 4.1.2 Name, Role,
   Value**, **2.1.2 No Keyboard Trap**, **2.4.3 Focus Order**. Essendo
   l'unico componente modale del progetto (verificato: nessun altro overlay
   custom trovato), ogni form/conferma che lo usa eredita queste garanzie
   automaticamente.
4. **Il menu mobile in `src/components/app-shell.tsx` (righe 145-182)
   replica lo stesso standard** indipendentemente da `Dialog`: focus trap
   con wraparound sul Tab, Esc per chiudere, `aria-expanded`/`aria-controls`
   sul pulsante che lo apre, `role="dialog"` + `aria-modal` sul pannello.
5. **Il componente `Field` (`src/components/ui/input.tsx` righe 125-182)
   collega da sé `id`→`htmlFor`, `aria-describedby` (aiuto + errore) e
   `aria-invalid`** al controllo passato come figlio, invece di lasciare
   questa associazione alla disciplina di chi scrive ogni singolo form.
   Verificato che l'asterisco visivo di "obbligatorio" è marcato
   `aria-hidden="true"` (riga 27) ma — campione su
   `src/app/registrazione/page.tsx` e `src/app/admin/spese/form.tsx` — in
   **entrambi** i punti controllati l'attributo HTML nativo `required` è
   duplicato anche sull'`<input>` reale, che le tecnologie assistive
   annunciano comunque: nessun gap, l'asterisco decorativo non è l'unica
   indicazione. Soddisfa **WCAG 2.2 — 1.3.1 Info and Relationships**,
   **3.3.1 Error Identification**, **3.3.2 Labels or Instructions**.
6. **Target size dei pulsanti icona-sola sempre ≥ 24×24px**: la variante più
   piccola (`xs`) misura 28×28px (`size-7` = 1.75rem), le altre 32/40/48px
   (`src/components/ui/button.tsx` righe 42-47). Soddisfa **WCAG 2.2 — 2.5.8
   Target Size (Minimum)**, criterio introdotto proprio nella versione 2.2 e
   spesso trascurato.
7. **Intestazioni di tabella ordinabili accessibili**: verificato in
   `src/app/admin/spese/elenco-spese.tsx` — `aria-sort` dinamico
   (`"ascending"`/`"descending"`/`"none"`) sul `<th>` e un vero elemento
   `<button>` per attivare l'ordinamento (non un `<div onClick>`, quindi
   operabile da tastiera per costruzione). Coerente con **WCAG 2.2 — 4.1.2**
   e con le ARIA Authoring Practices per le tabelle ordinabili.
8. **Tabelle responsive con trasformazione a "scheda" sotto 768px**
   (`globals.css` righe 287-371), invece dello scorrimento orizzontale a più
   colonne — il pattern viene citato nel commento come ripreso da NN/g ("How
   to Fit Big Tables on Small Screens") ed è implementato correttamente
   (ogni cella porta la propria etichetta via `data-etichetta`).
9. **`prefers-reduced-motion: reduce` rispettato** globalmente
   (`globals.css` righe 177-186): azzera durate di animazione/transizione
   per chi ha attivato la riduzione del movimento a livello di sistema.
10. **Conferma delle azioni distruttive proporzionata al rischio**, non
    uniforme a `window.confirm()` (verificato: zero occorrenze di
    `window.confirm`/`confirm(` in tutto `src/`, che sarebbe comunque
    inaccessibile e fuori dal design system). L'unica azione davvero
    irreversibile dell'app (eliminazione di un condominio,
    `src/app/admin/condomini/[id]/elimina-condominio-button.tsx`) richiede
    di **ritrascrivere il nome del condominio** per abilitare il pulsante di
    conferma, ed elenca prima che cosa verrà rimosso. Le azioni
    reversibili/minori (es. annullare una prenotazione,
    `src/app/area-riservata/spazi/annulla-button.tsx`) usano invece una
    conferma più leggera ma sempre tramite `Dialog`, mai un alert nativo.
    Applicazione diretta dell'euristica di Nielsen **#5 (prevenzione degli
    errori)** e **#3 (controllo e libertà dell'utente)**, con intensità del
    passo di conferma calibrata sulla reversibilità — non genericamente
    uguale ovunque.
11. **Interruttore mostra/nascondi password accessibile**
    (`src/components/ui/password-input.tsx`): vero `<button type="button">`
    con `aria-pressed` e `aria-label` che cambia con lo stato, non
    un'icona muta cliccabile.
12. **Un solo `<h1>` per pagina, verificato anche nel caso più a rischio.**
    `src/components/ui/page-header.tsx` emette un unico `<h1>`; le pagine
    legali (`/privacy`, `/cookie`) **non** usano `PageHeader` e lasciano che
    l'unico `<h1>` della pagina venga dal primo titolo del Markdown stesso
    tramite `src/components/documento-legale.tsx` (mappatura `h1`→`<h1>`,
    righe 11-15) — ho controllato `src/app/privacy/page.tsx` proprio per
    escludere un doppio `<h1>` (header di pagina + titolo del documento) ed
    è confermato che non succede.
13. **Pagina 404 ben progettata** (`src/app/not-found.tsx`): spiega le due
    cause plausibili (indirizzo inesistente o contenuto non più accessibile
    con l'account corrente — non un generico "errore"), offre due percorsi
    di recupero concreti e un terzo link per chi pensa si tratti di un
    errore di accesso. Euristica di Nielsen **#9 (aiutare l'utente a
    riconoscere, diagnosticare, recuperare dagli errori)** applicata bene.
14. **Microcopy in italiano di registro coerente e senza gergo tecnico**
    verso l'utente finale, in tutti i file letti in questa fase e nelle fasi
    precedenti (es. i messaggi del flusso OTP, la spiegazione del rendiconto,
    gli stati vuoti). L'eccezione verificata è il leak di messaggi di errore
    grezzi del database, già rilevato come **COD-02** in Fase 1: lo
    richiamo qui solo come riferimento incrociato (rilevante anche per
    l'euristica di Nielsen #9), senza riaprirlo come rilievo distinto.
15. **Alt text presente** sulle immagini caricate dagli utenti (foto di una
    segnalazione): `alt="Foto allegata alla segnalazione"` in
    `src/app/admin/segnalazioni/[id]/page.tsx` riga 147 e nel file
    equivalente in area-riservata — generico ma presente e corretto
    (il contenuto reale della foto non è noto in anticipo, quindi un alt più
    specifico non sarebbe generabile automaticamente). Soddisfa **WCAG 2.2 —
    1.1.1 Non-text Content**.
16. **`lang="it"` corretto** sull'elemento `<html>` in `src/app/layout.tsx`
    riga 24 — nessun contenuto rilevato in un'altra lingua che richiederebbe
    un `lang` annidato diverso.

---

## Rilievi

### SITO-01 — Le pagine pubbliche di autenticazione non hanno un titolo di pagina proprio
- **Gravità**: media
- **File**: `src/app/login/page.tsx`, `src/app/registrazione/page.tsx`,
  `src/app/recupera-password/page.tsx`, `src/app/reimposta-password/page.tsx`
  (verificato: nessuno dei quattro esporta `metadata`, a differenza di
  **tutte** le altre 26 pagine del sito che lo fanno — vedi elenco completo
  ottenuto con una ricerca su `export const metadata` in `src/app`)
- **Descrizione**: senza un `export const metadata` proprio, queste quattro
  pagine ricevono il titolo di default definito in `src/app/layout.tsx`
  (`"Portale Condominio"`, usato qui senza il template `%s · Portale
  Condominio` perché manca lo slot `%s`). Il risultato è che la scheda del
  browser, la cronologia e i risultati di ricerca mostrano lo stesso titolo
  generico per `/login`, `/registrazione`, `/recupera-password` e
  `/reimposta-password`.
- **Impatto concreto**: un utente con più schede aperte (es. login in una,
  registrazione in un'altra) non può distinguerle dal titolo; chi usa un
  lettore di schermo e passa da una scheda all'altra con lo screen reader
  sente annunciare lo stesso titolo per pagine diverse, perdendo
  l'orientamento. Impatto anche in motori di ricerca: queste pagine sono
  pubbliche (whitelisted nel `proxy.ts`) e indicizzabili, ma indistinguibili
  tra loro nei risultati.
- **Rimedio**:
  ```ts
  // src/app/login/page.tsx
  export const metadata: Metadata = {
    title: "Accedi",
    description: "Accedi al portale per gestire il tuo condominio.",
  };
  ```
  (titoli e descrizioni analoghi per le altre tre pagine, usando il template
  già definito nel layout radice).
- **Riferimento**: **WCAG 2.2 — 2.4.2 Page Titled** (livello A — non solo
  AA: è uno dei criteri più bassi della scala di conformità, quindi la sua
  assenza è più grave del livello "media" assegnato qui per il contesto —
  classificata media perché l'impatto pratico è limitato a 4 pagine di
  servizio, non a flussi applicativi centrali).

### SITO-02 — Nessun `robots.txt`/`sitemap.xml` e nessuna direttiva di indicizzazione sulle aree autenticate
- **Gravità**: media
- **File**: assenti in tutto il repo (verificato con ricerca di
  `robots.txt`, `sitemap.xml`, e delle convenzioni App Router
  `src/app/robots.ts`/`src/app/sitemap.ts`); nessun campo `robots` in
  `metadata` in nessuno dei file letti, incluso `src/app/admin/layout.tsx`
  e `src/app/area-riservata/layout.tsx`
- **Descrizione**: il sito non pubblica né un file `robots.txt` né una
  sitemap, e non imposta `noindex` esplicito sulle sezioni `/admin/*` e
  `/area-riservata/*`. Oggi un crawler che tenti di visitare quelle route
  senza sessione viene rediretto a `/login` dal `proxy.ts` (verificato in
  Fase 0), quindi il contenuto vero non è raggiungibile — ma senza una
  direttiva esplicita un motore di ricerca può comunque indicizzare l'URL
  del redirect o la pagina di login sotto percorsi come
  `/admin/condomini/[id]`, generando voci duplicate o poco utili nei
  risultati.
- **Impatto concreto**: visibilità ridotta e meno controllata delle pagine
  pubbliche che contano davvero (`/`, `/privacy`, `/cookie`,
  `/registrazione`), perché non c'è una sitemap che le segnali esplicitamente
  ai motori di ricerca, e rischio di indicizzazione di URL non significativi
  sotto le aree protette.
- **Rimedio**:
  ```ts
  // src/app/robots.ts
  import type { MetadataRoute } from "next";
  export default function robots(): MetadataRoute.Robots {
    return {
      rules: [{ userAgent: "*", disallow: ["/admin", "/area-riservata"] }],
      sitemap: "https://<dominio>/sitemap.xml",
    };
  }
  // src/app/sitemap.ts — elenca solo le pagine pubbliche reali
  ```
  e un campo `robots: { index: false }` nei `metadata` di
  `src/app/admin/layout.tsx` e `src/app/area-riservata/layout.tsx` come
  seconda rete di sicurezza.
- **Riferimento**: buona pratica SEO tecnica standard (Google Search Central,
  "Robots.txt introduction"); nessuna norma cogente, ma rientra nel mandato
  di Fase 2 sulla visibilità tecnica.

### SITO-03 — Nessun Open Graph, Twitter Card o dato strutturato schema.org sulla pagina pubblica
- **Gravità**: bassa
- **File**: `src/app/layout.tsx` (unico punto con `metadata` condiviso —
  nessun campo `openGraph`/`twitter`); ricerca esaustiva di
  `application/ld+json`/`schema.org` su tutto `src/`: zero risultati
- **Descrizione**: la home page pubblica (`src/app/page.tsx`, pagina di
  presentazione del prodotto per potenziali amministratori) non definisce
  immagine, titolo o descrizione per la condivisione social (Open Graph /
  Twitter Card), né alcun dato strutturato schema.org (es. `SoftwareApplication`
  o `Organization`) che aiuterebbe i motori di ricerca a capire di cosa si
  tratta.
- **Impatto concreto**: se un link al sito viene condiviso su LinkedIn,
  WhatsApp o email (canali plausibili per un prodotto B2B rivolto ad
  amministratori di condominio), non comparirà alcuna anteprima con
  immagine/descrizione — solo il link nudo. Nessun rich result possibile nei
  motori di ricerca.
- **Rimedio**:
  ```ts
  export const metadata: Metadata = {
    // ...esistente
    openGraph: {
      title: "Portale Condominio",
      description: "Gestione condominiale online...",
      url: "https://<dominio>",
      siteName: "Portale Condominio",
      images: ["/og-image.png"],
      locale: "it_IT",
    },
  };
  ```
- **Riferimento**: Open Graph Protocol (ogp.me); nessuna norma cogente.

### SITO-04 — Asset di scaffolding Next.js inutilizzati ancora in `public/`
- **Gravità**: bassa
- **File**: `public/file.svg`, `public/globe.svg`, `public/next.svg`,
  `public/vercel.svg`, `public/window.svg`
- **Descrizione**: sono le icone demo generate da `create-next-app`.
  Verificato con una ricerca di ogni nome file in tutto `src/`: **nessun
  riferimento** — non sono usate da nessuna pagina o componente.
- **Impatto concreto**: nessuno funzionale (non vengono caricate se non
  linkate); solo peso morto nel repository e possibile confusione per chi
  lo esplora pensando siano in uso.
- **Rimedio**: rimuoverle.
- **Riferimento**: pulizia del codice, non una violazione di linea guida.

### SITO-05 — Nessuna dichiarazione di accessibilità pubblicata
- **Gravità**: bassa (classificata come nota da verificare, non come
  violazione accertata — vedi sotto)
- **File**: nessuno trovato (ricerca di "accessibilit" su `src/` e `legale/`:
  zero risultati)
- **Descrizione**: non esiste una pagina "Dichiarazione di accessibilità"
  nel formato richiesto da AgID per i soggetti tenuti (PA, enti e — dal
  recepimento dell'European Accessibility Act, d.lgs. 82/2022 — alcuni
  servizi privati B2C elencati nell'Allegato I della direttiva UE
  2019/882, con decorrenza degli obblighi dal 28 giugno 2025 per i nuovi
  servizi).
- **Impatto concreto**: **non verificato se questo prodotto sia un "soggetto
  tenuto"** ai sensi della normativa citata — un portale di gestione
  condominiale venduto ad amministratori (uso perevalentemente B2B, con
  un flusso di pagamento verso il consumatore finale tramite Stripe Checkout,
  che è un servizio di terzi con una propria conformità) non rientra in modo
  ovvio nelle categorie elencate nell'Allegato I EAA (e-commerce, servizi
  bancari al consumo, trasporti, ecc.), ma non è un'interpretazione legale
  che rientra nel perimetro tecnico di questa fase. Segnalo il fatto
  (nessuna dichiarazione pubblicata) e rimando la valutazione di
  applicabilità alla Fase 3 (conformità normativa), dove va trattata insieme
  alle altre verifiche legali.
- **Rimedio**: nessuno finché non è chiarita l'applicabilità in Fase 3;
  se applicabile, pubblicare una dichiarazione di accessibilità nel formato
  previsto (modello AgID, basato su EN 301 549) collegata dal footer.
- **Riferimento**: AgID — Linee guida sull'accessibilità degli strumenti
  informatici; EN 301 549; d.lgs. 82/2022 (recepimento EAA) — applicabilità
  da confermare, non assunta.

### SITO-06 — La prop `iconOnly` di `Button` non impone a livello di tipo la presenza di un'etichetta accessibile
- **Gravità**: bassa
- **File**: `src/components/ui/button.tsx` riga 62 (commento: "Pulsante di
  sola icona: ricordarsi `aria-label` o `title`" — un promemoria nel
  commento, non un vincolo verificato da TypeScript o da una regola ESLint)
- **Descrizione**: campionando 4 usi reali (`app-shell.tsx` ×3,
  `password-input.tsx`, `elimina-condominio-button.tsx` — quest'ultimo in
  realtà non icon-only) tutti forniscono correttamente `aria-label`. Non ho
  trovato un'istanza mancante in questa fase, quindi questo **non è un
  difetto osservato oggi**, ma un gap nel guardrail: nulla impedisce a un
  futuro pulsante icona-sola di essere aggiunto senza etichetta, perché il
  controllo esiste solo come commento.
- **Impatto concreto**: rischio di regressione futura silenziosa (un
  pulsante senza nome accessibile viola **WCAG 2.2 — 4.1.2 Name, Role,
  Value**), non un problema attuale verificato.
- **Rimedio**: se si vuole irrigidire la garanzia, rendere `aria-label`
  obbligatorio a livello di tipo quando `iconOnly` è `true` (type discriminato
  sulla prop), oppure aggiungere una regola `eslint-plugin-jsx-a11y` con
  `aria-label` richiesto sui bottoni senza testo visibile.
- **Riferimento**: WCAG 2.2 — 4.1.2; osservazione preventiva, non un
  rilievo su un difetto riscontrato.

---

## Nota di coerenza con la Fase 1

Il rilievo **COD-02** (messaggi di errore grezzi del database esposti
all'utente, incluso nel flusso pubblico `/firma-verbale/[token]`) resta
pertinente anche per questa fase sotto l'euristica di Nielsen **#9** e per
la chiarezza del microcopy — non lo riscrivo qui come rilievo separato per
non duplicarlo: si trova in `docs/audit/01-codice.md`.

---

## Fuori perimetro in questa fase

- Non è stato eseguito un controllo automatico (es. axe-core/Lighthouse) su
  pagine renderizzate dal vivo: i rilievi sopra vengono da lettura diretta
  del codice (markup, ARIA, CSS) e da calcolo manuale del contrasto su un
  campione di 3 coppie colore, non da una scansione esaustiva.
- Non è stata misurata la performance reale (Core Web Vitals) con uno
  strumento: la Fase 1 ha già notato l'assenza di `next/image` in due punti
  (deliberata e documentata, verificato in Fase 0/1) e l'esecuzione
  client-side di ExcelJS/PapaParse nel wizard di importazione (COD-08); non
  li riapro qui.
- L'applicabilità concreta di EAA/AgID a questo prodotto (SITO-05) è
  segnalata ma non decisa: è una valutazione legale, rimandata alla Fase 3
  come da istruzioni dell'incarico.

---

Nessun file del progetto è stato modificato in questa fase, a parte la
creazione di questo stesso documento in `docs/audit/02-sito.md`.
