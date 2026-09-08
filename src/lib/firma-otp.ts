import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Conferma "leggera" del verbale d'assemblea tramite codice usa-e-getta
 * inviato per email.
 *
 * ATTENZIONE (ripetuto anche in interfaccia): NON è una firma elettronica con
 * valore legale ai sensi del regolamento eIDAS / del CAD. È solo un
 * tracciamento di approvazione: chi controlla la casella email indicata
 * dall'amministratore conferma di aver letto e approvato quel documento, e la
 * conferma viene registrata con data e ora. Per una firma con valore legale
 * (FEA) servirebbe un provider certificato esterno — vedi IDEE-FUTURE.md.
 */
export const DISCLAIMER_FIRMA =
  "Conferma tracciata tramite codice usa-e-getta inviato per email: NON è una firma elettronica " +
  "con valore legale (FEA/eIDAS), ma la registrazione dell'approvazione del documento da parte " +
  "della persona indicata.";

/** Validità del codice, in minuti. */
export const OTP_VALIDITA_MINUTI = 15;

/** Tentativi errati consentiti prima di dover richiedere un nuovo codice. */
export const OTP_MAX_TENTATIVI = 5;

/** Token opaco messo nel link di conferma inviato per email. */
export function generaToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Codice numerico a 6 cifre, generato con il PRNG crittografico. */
export function generaCodiceOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * Impronta del codice. Il codice in chiaro non viene mai salvato: nel database
 * finisce solo lo SHA-256 di "token:codice", così due firmatari con lo stesso
 * codice generato per caso non hanno la stessa impronta e l'impronta non è
 * riutilizzabile su un'altra riga.
 */
export function hashOtp(token: string, codice: string): string {
  return createHash("sha256").update(`${token}:${codice}`).digest("hex");
}

export function scadenzaOtp(adesso: Date = new Date()): Date {
  return new Date(adesso.getTime() + OTP_VALIDITA_MINUTI * 60_000);
}

/** Normalizza quanto digitato dall'utente (spazi, trattini incollati dall'email). */
export function normalizzaCodice(input: string): string {
  return input.replace(/\D/g, "");
}

export type StatoFirma = {
  otp_hash: string | null;
  otp_scadenza: string | null;
  otp_tentativi: number;
  confermato_il: string | null;
};

export type EsitoVerificaOtp =
  | { ok: true }
  | { ok: false; errore: string; incrementaTentativi: boolean };

/**
 * Verifica il codice digitato. Funzione pura: riceve lo stato della riga e
 * restituisce l'esito, senza toccare il database — così è testabile e la
 * server action si limita a scrivere la conseguenza.
 */
export function verificaOtp(
  stato: StatoFirma,
  codiceDigitato: string,
  token: string,
  adesso: Date = new Date()
): EsitoVerificaOtp {
  if (stato.confermato_il) {
    return { ok: false, errore: "Questo documento risulta già confermato.", incrementaTentativi: false };
  }
  if (!stato.otp_hash || !stato.otp_scadenza) {
    return {
      ok: false,
      errore: "Nessun codice attivo: richiedine uno nuovo.",
      incrementaTentativi: false,
    };
  }
  if (stato.otp_tentativi >= OTP_MAX_TENTATIVI) {
    return {
      ok: false,
      errore: "Troppi tentativi errati: richiedi un nuovo codice.",
      incrementaTentativi: false,
    };
  }
  if (new Date(stato.otp_scadenza).getTime() <= adesso.getTime()) {
    return {
      ok: false,
      errore: "Il codice è scaduto: richiedine uno nuovo.",
      incrementaTentativi: false,
    };
  }

  const codice = normalizzaCodice(codiceDigitato);
  if (codice.length !== 6) {
    return { ok: false, errore: "Il codice è composto da 6 cifre.", incrementaTentativi: true };
  }

  if (!confrontoCostante(hashOtp(token, codice), stato.otp_hash)) {
    const rimasti = OTP_MAX_TENTATIVI - stato.otp_tentativi - 1;
    return {
      ok: false,
      errore:
        rimasti > 0
          ? `Codice non valido. Tentativi rimasti: ${rimasti}.`
          : "Codice non valido: richiedi un nuovo codice.",
      incrementaTentativi: true,
    };
  }

  return { ok: true };
}

/** Confronto a tempo costante tra due impronte esadecimali della stessa lunghezza. */
function confrontoCostante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
