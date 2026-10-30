/**
 * Codici di invito per unità.
 *
 * Logica pura: forma del codice, normalizzazione di quello digitato a mano,
 * URL di registrazione da mettere nel QR. Nessun accesso al database — la
 * generazione del codice è un affare del database (trigger
 * `crea_invito_unita` + funzione `genera_codice_invito` in
 * `supabase/schema.sql`), qui si legge, si ripulisce e si formatta.
 *
 * ## L'alfabeto, e perché non si prova a correggere i caratteri ambigui
 *
 * L'alfabeto è di stile Crockford: 30 caratteri, senza `0`, `1`, `I`, `L`,
 * `O`, `U`. I primi cinque escono perché si confondono fra loro su carta
 * stampata, la `U` perché la sua assenza evita di generare per caso parole
 * sconvenienti.
 *
 * Una decodifica "alla Crockford" (`O` → `0`, `I`/`L` → `1`) qui non
 * avrebbe senso: siccome l'alfabeto esclude *entrambi* i membri di ogni
 * coppia ambigua, un codice che contiene `O` non è un codice con uno zero
 * mal letto — è un codice sbagliato, e tanto vale dirlo. La
 * normalizzazione si limita quindi a maiuscolo e rimozione dei
 * separatori: chi ricopia `abcd-2345`, `ABCD 2345` o `abcd2345` ottiene
 * sempre lo stesso codice.
 */

/** I 30 caratteri ammessi, in ordine: deve coincidere con `genera_codice_invito()`. */
export const ALFABETO_CODICE_INVITO = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Lunghezza del codice senza separatori. */
export const LUNGHEZZA_CODICE_INVITO = 8;

/** Posizione del trattino nella forma leggibile `XXXX-XXXX`. */
const GRUPPO = 4;

/**
 * Da quello che l'utente ha digitato (o incollato, o ricopiato da un
 * foglio) al valore da confrontare con `inviti_unita.codice`: maiuscolo,
 * senza trattini, spazi, punti o qualunque altro separatore.
 *
 * Non taglia la lunghezza e non scarta i caratteri fuori alfabeto: serve a
 * `codiceInvitoValido` poterli vedere per dire che il codice non va bene.
 */
export function normalizzaCodiceInvito(valore: string | null | undefined): string {
  return (valore ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
}

/**
 * Forma leggibile: `ABCD-2345`. Due gruppi di quattro si ricopiano e si
 * dettano al telefono molto meglio di otto caratteri di fila.
 *
 * Un valore di lunghezza diversa da otto viene restituito normalizzato ma
 * senza trattino, invece di essere spezzato a forza: capita solo mentre
 * l'utente sta ancora digitando.
 */
export function formattaCodiceInvito(valore: string | null | undefined): string {
  const codice = normalizzaCodiceInvito(valore);
  if (codice.length !== LUNGHEZZA_CODICE_INVITO) return codice;
  return `${codice.slice(0, GRUPPO)}-${codice.slice(GRUPPO)}`;
}

/**
 * Vero se il codice ha la forma giusta: otto caratteri, tutti dentro
 * l'alfabeto. Non dice che il codice esiste — quello lo sa solo il
 * database (`valida_codice_invito`) — serve a non interrogarlo per ogni
 * carattere digitato e a dare subito un riscontro su una `O` o uno zero.
 */
export function codiceInvitoValido(valore: string | null | undefined): boolean {
  const codice = normalizzaCodiceInvito(valore);
  if (codice.length !== LUNGHEZZA_CODICE_INVITO) return false;
  return [...codice].every((carattere) => ALFABETO_CODICE_INVITO.includes(carattere));
}

/**
 * URL che il QR code codifica: la pagina di registrazione con il codice
 * già inserito. Chi inquadra il codice in bacheca arriva al modulo e trova
 * il campo compilato, senza ricopiare nulla.
 *
 * `origine` è l'origine assoluta del sito (`https://…`, senza percorso).
 */
export function urlRegistrazioneConCodice(origine: string, codice: string): string {
  const base = origine.replace(/\/+$/, "");
  return `${base}/registrazione?codice=${encodeURIComponent(formattaCodiceInvito(codice))}`;
}
