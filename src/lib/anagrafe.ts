/**
 * Registro di anagrafe condominiale (art. 1130, n. 6, c.c.).
 *
 * Logica pura sui dati che la legge richiede oltre alle generalità:
 * codice fiscale della persona e dati catastali dell'unità. Nessun
 * accesso al database: le query stanno nelle server action.
 *
 * Nota sul livello di severità: la validazione qui è volutamente
 * permissiva. Questi dati si raccolgono progressivamente e un codice
 * fiscale va rifiutato solo quando è certamente sbagliato (lunghezza o
 * struttura impossibili), non quando non supera il controllo del
 * carattere di controllo: un amministratore che sta ricopiando una
 * visura non deve trovarsi il salvataggio bloccato da un dato che per
 * lui è quello giusto.
 */

/** Maiuscolo, senza spazi né punteggiatura; stringa vuota -> null. */
export function normalizzaCodiceFiscale(valore: string | null | undefined): string | null {
  const pulito = (valore ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return pulito || null;
}

// Persona fisica: 6 lettere, 2 cifre (anno), 1 lettera (mese), 2 cifre
// (giorno + sesso), 1 lettera + 3 cifre (comune, con le cifre che possono
// essere sostituite da lettere nei codici omocodici) e 1 lettera di
// controllo.
const RE_CF_PERSONA = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/;

// Società ed enti: codice fiscale numerico di 11 cifre (coincide con la
// partita IVA). Un condòmino può essere una società, quindi la forma va
// accettata esattamente come quella della persona fisica.
const RE_CF_ENTE = /^[0-9]{11}$/;

/**
 * Vero se il codice fiscale ha una forma plausibile (persona fisica a 16
 * caratteri oppure ente a 11 cifre). Si aspetta un valore già
 * normalizzato con `normalizzaCodiceFiscale`.
 */
export function codiceFiscaleValido(codiceFiscale: string): boolean {
  return RE_CF_PERSONA.test(codiceFiscale) || RE_CF_ENTE.test(codiceFiscale);
}

export type DatiCatastali = {
  foglio: string | null;
  particella: string | null;
  subalterno: string | null;
  categoria: string | null;
};

/** Testo libero -> valore da salvare: ripulito, maiuscolo per la categoria. */
export function normalizzaDatiCatastali(input: {
  foglio?: string | null;
  particella?: string | null;
  subalterno?: string | null;
  categoria?: string | null;
}): DatiCatastali {
  const pulisci = (v: string | null | undefined) => (v ?? "").trim() || null;
  return {
    foglio: pulisci(input.foglio),
    particella: pulisci(input.particella),
    subalterno: pulisci(input.subalterno),
    categoria: pulisci(input.categoria)?.toUpperCase() ?? null,
  };
}

/**
 * Riga catastale da mostrare nelle schede e nei documenti, nella forma
 * abbreviata usata negli atti: "Fg. 12 · Part. 345 · Sub. 7 · A/2".
 * Null quando non si è ancora raccolto nessuno dei quattro dati, così
 * l'interfaccia può mostrare il suo segnaposto invece di una riga vuota.
 */
export function formatDatiCatastali(dati: Partial<DatiCatastali>): string | null {
  const parti = [
    dati.foglio ? `Fg. ${dati.foglio}` : null,
    dati.particella ? `Part. ${dati.particella}` : null,
    dati.subalterno ? `Sub. ${dati.subalterno}` : null,
    dati.categoria ? dati.categoria : null,
  ].filter((p): p is string => !!p);
  return parti.length ? parti.join(" · ") : null;
}

/**
 * Quanto è completo il registro per una persona: serve all'interfaccia
 * per segnalare all'amministratore che cosa gli manca ancora, senza
 * impedirgli di salvare.
 */
export function datiAnagrafeMancanti(persona: {
  codice_fiscale?: string | null;
  residenza_domicilio?: string | null;
}): string[] {
  const mancanti: string[] = [];
  if (!persona.codice_fiscale?.trim()) mancanti.push("codice fiscale");
  if (!persona.residenza_domicilio?.trim()) mancanti.push("residenza o domicilio");
  return mancanti;
}
