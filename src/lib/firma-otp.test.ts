import { describe, expect, test } from "vitest";
import {
  generaCodiceOtp,
  generaToken,
  hashOtp,
  normalizzaCodice,
  OTP_MAX_TENTATIVI,
  scadenzaOtp,
  verificaOtp,
  type StatoFirma,
} from "./firma-otp";

const TOKEN = "token-di-prova";
const ADESSO = new Date("2026-09-08T10:00:00.000Z");

function statoConCodice(codice: string, extra: Partial<StatoFirma> = {}): StatoFirma {
  return {
    otp_hash: hashOtp(TOKEN, codice),
    otp_scadenza: new Date(ADESSO.getTime() + 10 * 60_000).toISOString(),
    otp_tentativi: 0,
    confermato_il: null,
    ...extra,
  };
}

describe("generazione", () => {
  test("il codice ha sempre 6 cifre", () => {
    for (let i = 0; i < 200; i++) {
      expect(generaCodiceOtp()).toMatch(/^\d{6}$/);
    }
  });

  test("il token è url-safe e non banale", () => {
    const token = generaToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(generaToken()).not.toBe(token);
  });

  test("l'impronta dipende sia dal token sia dal codice", () => {
    expect(hashOtp("a", "123456")).not.toBe(hashOtp("b", "123456"));
    expect(hashOtp("a", "123456")).not.toBe(hashOtp("a", "123457"));
    expect(hashOtp("a", "123456")).toBe(hashOtp("a", "123456"));
  });

  test("la scadenza è 15 minuti dopo il momento indicato", () => {
    expect(scadenzaOtp(ADESSO).toISOString()).toBe("2026-09-08T10:15:00.000Z");
  });
});

describe("normalizzaCodice", () => {
  test("toglie spazi, trattini e testo incollato dall'email", () => {
    expect(normalizzaCodice(" 12 34-56 ")).toBe("123456");
    expect(normalizzaCodice("codice: 000123")).toBe("000123");
  });
});

describe("verificaOtp", () => {
  test("codice corretto entro la scadenza", () => {
    expect(verificaOtp(statoConCodice("123456"), "123456", TOKEN, ADESSO)).toEqual({ ok: true });
  });

  test("accetta il codice anche se digitato con spazi", () => {
    expect(verificaOtp(statoConCodice("123456"), "123 456", TOKEN, ADESSO).ok).toBe(true);
  });

  test("codice errato: fallisce e conta il tentativo", () => {
    const esito = verificaOtp(statoConCodice("123456"), "654321", TOKEN, ADESSO);
    expect(esito.ok).toBe(false);
    expect(esito.ok === false && esito.incrementaTentativi).toBe(true);
    expect(esito.ok === false && esito.errore).toContain("Tentativi rimasti: 4");
  });

  test("codice di lunghezza sbagliata non viene confrontato ma conta come tentativo", () => {
    const esito = verificaOtp(statoConCodice("123456"), "12345", TOKEN, ADESSO);
    expect(esito.ok).toBe(false);
    expect(esito.ok === false && esito.incrementaTentativi).toBe(true);
  });

  test("codice scaduto", () => {
    const stato = statoConCodice("123456", {
      otp_scadenza: new Date(ADESSO.getTime() - 1000).toISOString(),
    });
    const esito = verificaOtp(stato, "123456", TOKEN, ADESSO);
    expect(esito.ok).toBe(false);
    expect(esito.ok === false && esito.errore).toContain("scaduto");
    expect(esito.ok === false && esito.incrementaTentativi).toBe(false);
  });

  test("tentativi esauriti: nemmeno il codice giusto passa", () => {
    const stato = statoConCodice("123456", { otp_tentativi: OTP_MAX_TENTATIVI });
    const esito = verificaOtp(stato, "123456", TOKEN, ADESSO);
    expect(esito.ok).toBe(false);
    expect(esito.ok === false && esito.errore).toContain("Troppi tentativi");
  });

  test("nessun codice richiesto", () => {
    const stato: StatoFirma = {
      otp_hash: null,
      otp_scadenza: null,
      otp_tentativi: 0,
      confermato_il: null,
    };
    const esito = verificaOtp(stato, "123456", TOKEN, ADESSO);
    expect(esito.ok).toBe(false);
    expect(esito.ok === false && esito.errore).toContain("Nessun codice attivo");
  });

  test("documento già confermato: la conferma non si ripete", () => {
    const stato = statoConCodice("123456", { confermato_il: ADESSO.toISOString() });
    const esito = verificaOtp(stato, "123456", TOKEN, ADESSO);
    expect(esito.ok).toBe(false);
    expect(esito.ok === false && esito.errore).toContain("già confermato");
  });

  test("il codice di un firmatario non vale per un altro token", () => {
    const esito = verificaOtp(statoConCodice("123456"), "123456", "altro-token", ADESSO);
    expect(esito.ok).toBe(false);
  });
});
