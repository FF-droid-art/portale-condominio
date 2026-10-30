/**
 * Esportazione completa dei dati di un condominio: la parte pura.
 *
 * PERCHÉ QUESTO MODULO ESISTE (CONT-02 in
 * `docs/audit/05-dipendenze-continuita-mercato.md`). La bozza di DPA
 * (`legale/dpa-BOZZA.md`, art. 10.1.a) promette al titolare la restituzione
 * dei dati «in formato strutturato e di uso comune» alla cessazione del
 * rapporto, e l'art. 10.6 gli ricorda che la conservazione decennale dell'art.
 * 1130-bis c.c. grava su di lui. Prima non esisteva un'azione che lo facesse:
 * c'erano soltanto i download uno per uno.
 *
 * COSA STA QUI E COSA NO. Qui sta solo la logica che si può provare senza
 * database: serializzazione CSV, nomi di file, testo del LEGGIMI, divisione in
 * blocchi degli identificativi. Le query e la lettura dello storage stanno in
 * `src/app/admin/condomini/[id]/esportazione-dati.ts`, come vuole la regola di
 * `CLAUDE.md` ("l'I/O resta nelle action/pagine, non in `src/lib`").
 *
 * PERCHÉ IL PUNTO E VIRGOLA COME SEPARATORE. I CSV che questo portale già
 * tratta usano `;` (vedi `demo/estratto-conto-*.csv`, che l'importatore della
 * riconciliazione legge), ed è il separatore che Excel in locale italiano
 * riconosce aprendo il file con un doppio clic. In testa si scrive il BOM
 * UTF-8, altrimenti Excel rovina gli accenti dei nominativi — che in un
 * registro di anagrafe non è un dettaglio estetico.
 */

/** Separatore di campo dei CSV esportati. Vedi la nota in testa al modulo. */
export const SEPARATORE_CSV = ";";

/** Byte order mark UTF-8: serve a Excel per leggere gli accenti. */
export const BOM_UTF8 = "\uFEFF";

/** Terminatore di riga: CRLF come da RFC 4180. */
const FINE_RIGA = "\r\n";

/**
 * Una cella CSV.
 *
 * I booleani diventano `vero`/`falso` e non `true`/`false`: il destinatario di
 * questo archivio è un amministratore di condominio, non un programma. Il
 * `null` diventa cella vuota — distinguere "nessun valore" da "stringa vuota"
 * in un CSV non è possibile, e inventare un segnaposto confonderebbe di più.
 *
 * Il doppio apice iniziale (`'` o `=` o `+` o `-` in testa) viene neutralizzato
 * con un apice singolo: un valore come `=1+1` in un CSV aperto con Excel
 * diventerebbe una formula, e un campo di testo libero (una nota, la
 * descrizione di una spesa) può contenerlo per sbaglio o di proposito.
 */
export function cellaCsv(valore: unknown): string {
  if (valore === null || valore === undefined) return "";

  let testo: string;
  if (typeof valore === "boolean") testo = valore ? "vero" : "falso";
  else if (valore instanceof Date) testo = valore.toISOString();
  else if (typeof valore === "object") testo = JSON.stringify(valore);
  else testo = String(valore);

  if (/^[=+\-@\t\r]/.test(testo)) testo = `'${testo}`;

  const vaQuotato =
    testo.includes(SEPARATORE_CSV) ||
    testo.includes('"') ||
    testo.includes("\n") ||
    testo.includes("\r") ||
    testo !== testo.trim();

  return vaQuotato ? `"${testo.replace(/"/g, '""')}"` : testo;
}

/**
 * Un CSV completo, intestazione inclusa.
 *
 * Le colonne arrivano dal chiamante e NON si deducono dalle chiavi delle
 * righe, per due motivi: una tabella senza righe produce comunque un file con
 * la sua intestazione (così chi apre l'archivio vede che la tabella è vuota e
 * non che manca), e le colonne restano nello stesso ordine a ogni
 * esportazione, anche se la `select` cambia.
 */
export function versoCsv(
  colonne: readonly string[],
  righe: readonly Record<string, unknown>[]
): string {
  const intestazione = colonne.map((c) => cellaCsv(c)).join(SEPARATORE_CSV);
  const corpo = righe.map((riga) =>
    colonne.map((colonna) => cellaCsv(riga[colonna])).join(SEPARATORE_CSV)
  );
  return BOM_UTF8 + [intestazione, ...corpo].join(FINE_RIGA) + FINE_RIGA;
}

/**
 * Riduce un testo libero a qualcosa che si può usare come nome di file su
 * qualunque sistema: accenti risolti, solo lettere/cifre/trattini, lunghezza
 * limitata. Senza questo, il nome di una spesa ("Rifacimento facciata — 2°
 * lotto / saldo") diventerebbe un percorso illegale su Windows.
 */
export function slug(testo: string, lunghezzaMassima = 60): string {
  const normalizzato = testo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalizzato.slice(0, lunghezzaMassima).replace(/-+$/, "") || "senza-nome";
}

/** Estensione (senza punto) di un percorso di storage, "bin" se non si capisce. */
export function estensioneDa(percorso: string): string {
  const base = percorso.split("/").pop() ?? "";
  const punto = base.lastIndexOf(".");
  if (punto <= 0 || punto === base.length - 1) return "bin";
  const estensione = base.slice(punto + 1).toLowerCase();
  return /^[a-z0-9]{1,8}$/.test(estensione) ? estensione : "bin";
}

/**
 * Nome libero all'interno dell'archivio.
 *
 * Due documenti possono voler finire sullo stesso nome (due fatture caricate
 * lo stesso giorno sulla stessa spesa, due allegati chiamati entrambi
 * "scansione.pdf"). Sovrascrivere uno dei due in un archivio di conservazione
 * sarebbe una perdita di dati silenziosa: al secondo si aggiunge `-2`.
 */
export function nomeUnico(nome: string, usati: Set<string>): string {
  if (!usati.has(nome)) {
    usati.add(nome);
    return nome;
  }
  const punto = nome.lastIndexOf(".");
  const radice = punto > 0 ? nome.slice(0, punto) : nome;
  const coda = punto > 0 ? nome.slice(punto) : "";
  let n = 2;
  while (usati.has(`${radice}-${n}${coda}`)) n += 1;
  const scelto = `${radice}-${n}${coda}`;
  usati.add(scelto);
  return scelto;
}

/** Nome del file .zip scaricato. La data è quella del condominio (`@/lib/fuso`). */
export function nomeArchivio(nomeCondominio: string, data: string): string {
  return `esportazione-${slug(nomeCondominio, 40)}-${data}.zip`;
}

/**
 * Divide un elenco di identificativi in blocchi.
 *
 * Le tabelle figlie si leggono con `.in("padre_id", [...])`, come già fa il
 * resto del codice (`src/app/admin/riconciliazione/page.tsx`). Un condominio
 * con qualche centinaio di spese produrrebbe però un URL di parecchie decine
 * di migliaia di caratteri, e PostgREST lo rifiuterebbe: si interroga a
 * blocchi e si concatenano i risultati.
 */
export function aBlocchi<T>(elementi: readonly T[], dimensione = 100): T[][] {
  if (dimensione < 1) throw new Error("La dimensione del blocco deve essere almeno 1.");
  const blocchi: T[][] = [];
  for (let i = 0; i < elementi.length; i += dimensione) {
    blocchi.push(elementi.slice(i, i + dimensione));
  }
  return blocchi;
}

/** Riga dell'indice dei CSV nel LEGGIMI. */
export type VoceTabella = {
  /** Nome del file dentro `dati/`, senza estensione. */
  nome: string;
  /** A cosa corrisponde, in italiano corrente. */
  descrizione: string;
  /** Righe esportate. */
  righe: number;
};

/** Riga dell'indice dei documenti nel LEGGIMI. */
export type VoceCartella = {
  cartella: string;
  descrizione: string;
  file: number;
};

export type DatiLeggimi = {
  condominio: { nome: string; indirizzo: string; codiceFiscale: string | null };
  /** Chi ha chiesto l'esportazione (l'amministratore in carica). */
  amministratore: { nome: string; cognome: string; email: string } | null;
  /** Data dell'esportazione, "aaaa-mm-gg" nel fuso del condominio. */
  data: string;
  /** Ora dell'esportazione, "hh:mm". */
  ora: string;
  tabelle: readonly VoceTabella[];
  cartelle: readonly VoceCartella[];
  /** Documenti censiti in banca dati ma non scaricabili dallo storage. */
  documentiMancanti: readonly string[];
};

/**
 * Testo del `LEGGIMI.txt` in testa all'archivio.
 *
 * È il primo file che si apre e deve dire tre cose, in quest'ordine: di che
 * condominio si tratta e a che data, che cosa c'è dentro, e — soprattutto —
 * che cosa questo archivio NON garantisce. Il disclaimer non è una formalità:
 * l'art. 10.6 della DPA mette la conservazione decennale in capo
 * all'amministratore, quindi è lui che deve verificare di avere tutto, e
 * sapere che l'esportazione da sola non glielo assicura.
 *
 * In formato .txt e non .md: si apre con un doppio clic su qualunque sistema,
 * senza che nessuno debba sapere cos'è il Markdown.
 */
export function testoLeggimi(dati: DatiLeggimi): string {
  const righe: string[] = [];
  const titolo = `ESPORTAZIONE DEI DATI DEL CONDOMINIO`;

  righe.push(titolo);
  righe.push("=".repeat(titolo.length));
  righe.push("");
  righe.push(`Condominio:   ${dati.condominio.nome}`);
  righe.push(`Indirizzo:    ${dati.condominio.indirizzo}`);
  if (dati.condominio.codiceFiscale) {
    righe.push(`Cod. fiscale: ${dati.condominio.codiceFiscale}`);
  }
  righe.push(`Esportato il: ${dati.data} alle ${dati.ora} (ora italiana)`);
  if (dati.amministratore) {
    const a = dati.amministratore;
    righe.push(`Richiesto da: ${a.nome} ${a.cognome} <${a.email}>`);
  }
  righe.push("");
  righe.push("");

  righe.push("1. CHE COSA CONTIENE QUESTO ARCHIVIO");
  righe.push("------------------------------------");
  righe.push("");
  righe.push("Cartella \"dati/\": un file CSV per ogni tabella del condominio.");
  righe.push(
    `I campi sono separati dal punto e virgola (;), la codifica è UTF-8 con BOM:`
  );
  righe.push(
    "si aprono con un doppio clic in Excel, LibreOffice Calc e Fogli Google,"
  );
  righe.push("e si rileggono con qualunque strumento che tratti CSV.");
  righe.push("");
  for (const t of dati.tabelle) {
    const conteggio = t.righe === 1 ? "1 riga" : `${t.righe} righe`;
    righe.push(`  dati/${t.nome}.csv`);
    righe.push(`      ${t.descrizione} — ${conteggio}`);
  }
  righe.push("");
  righe.push("Cartella \"documenti/\": i file caricati nel portale per questo");
  righe.push("condominio, divisi per origine e con nomi leggibili.");
  righe.push("");
  if (dati.cartelle.length === 0) {
    righe.push("  (nessun documento caricato per questo condominio)");
  } else {
    for (const c of dati.cartelle) {
      const conteggio = c.file === 1 ? "1 file" : `${c.file} file`;
      righe.push(`  documenti/${c.cartella}/`);
      righe.push(`      ${c.descrizione} — ${conteggio}`);
    }
  }
  righe.push("");

  if (dati.documentiMancanti.length > 0) {
    righe.push("");
    righe.push("2. DOCUMENTI NON RECUPERATI");
    righe.push("---------------------------");
    righe.push("");
    righe.push(
      "I documenti elencati qui sotto risultano registrati in banca dati ma non"
    );
    righe.push(
      "è stato possibile leggerne il file dall'archivio. Verificali nel portale"
    );
    righe.push("e, se ti servono, ricaricali prima di ripetere l'esportazione.");
    righe.push("");
    for (const m of dati.documentiMancanti) righe.push(`  - ${m}`);
    righe.push("");
  }

  const numeroSezione = dati.documentiMancanti.length > 0 ? 3 : 2;
  righe.push("");
  righe.push(`${numeroSezione}. A CHE COSA SERVE E CHE COSA NON GARANTISCE`);
  righe.push("-".repeat(`${numeroSezione}. A CHE COSA SERVE E CHE COSA NON GARANTISCE`.length));
  righe.push("");
  righe.push(
    "Questa esportazione assolve, per la parte tecnica, l'obbligo di restituzione"
  );
  righe.push(
    "dei dati in formato strutturato e di uso comune previsto dall'art. 10.1,"
  );
  righe.push("lett. a), dell'accordo sul trattamento dei dati (DPA).");
  righe.push("");
  righe.push("NON sostituisce la verifica che devi fare tu.");
  righe.push("");
  righe.push(
    "L'obbligo di conservare per dieci anni la documentazione contabile e i"
  );
  righe.push(
    "registri del condominio (art. 1130-bis, comma 1, c.c., e art. 10.6 della"
  );
  righe.push(
    "DPA) grava sull'amministratore, non sul fornitore del portale. Prima di"
  );
  righe.push("considerare chiuso un passaggio di consegne o una cessazione:");
  righe.push("");
  righe.push("  - apri i CSV e controlla che i dati che ti aspetti ci siano;");
  righe.push("  - apri a campione i documenti e verifica che siano leggibili;");
  righe.push(
    "  - confronta il numero di file nella cartella \"documenti/\" con quello che"
  );
  righe.push("    risulta nel portale, e la sezione 2 qui sopra se è presente;");
  righe.push(
    "  - conserva l'archivio su un supporto che resti leggibile per dieci anni,"
  );
  righe.push("    non solo nella cartella dei download.");
  righe.push("");
  righe.push(
    "L'archivio contiene i dati presenti nel portale alla data indicata in testa."
  );
  righe.push(
    "Non contiene quanto non è mai stato caricato qui, né le comunicazioni"
  );
  righe.push("scambiate fuori dal portale (email, messaggi, carta).");
  righe.push("");
  righe.push(
    "I file sono una copia dei dati, non un documento con valore di certificazione:"
  );
  righe.push(
    "nessuna firma elettronica, nessuna marca temporale. Dove il portale genera un"
  );
  righe.push(
    "PDF ufficiale (rendiconto, convocazione, verbale), quel PDF va scaricato dalle"
  );
  righe.push("pagine che lo producono: questa esportazione non lo rigenera.");
  righe.push("");
  righe.push("");

  righe.push(`${numeroSezione + 1}. DATI PERSONALI`);
  righe.push("-".repeat(`${numeroSezione + 1}. DATI PERSONALI`.length));
  righe.push("");
  righe.push(
    "L'archivio contiene dati personali dei condòmini (nominativi, codici fiscali,"
  );
  righe.push(
    "recapiti, residenze, posizioni di pagamento) e va trattato di conseguenza:"
  );
  righe.push(
    "custodiscilo in un luogo protetto, non inoltrarlo a chi non ne ha titolo e"
  );
  righe.push(
    "non lasciarlo su supporti condivisi. Le posizioni di morosità, in particolare,"
  );
  righe.push(
    "non vanno comunicate agli altri condòmini (art. 1129, comma 9, c.c. e prassi"
  );
  righe.push("del Garante).");
  righe.push("");

  return righe.join("\r\n");
}
