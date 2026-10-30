import { afterEach, describe, expect, test, vi } from "vitest";
import {
  MESSAGGIO_GENERICO,
  codiceErrore,
  messaggioErrore,
  messaggioErroreAuth,
  registraErrore,
  traduciErrore,
  traduciErroreAuth,
} from "./errori";

/**
 * Due cose vanno verificate qui, e sono distinte:
 *
 * 1. che nessun testo tecnico arrivi all'utente (COD-02). Non basta
 *    controllare i casi noti: il test importante è quello sul messaggio
 *    grezzo di Postgres, che deve sparire anche quando il codice non è
 *    riconosciuto;
 * 2. che l'errore originale finisca comunque nel log (COD-09), perché è la
 *    condizione che rende accettabile nascondere il dettaglio.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

/** Un errore PostgREST come arriva davvero dal client Supabase. */
function erroreDb(code: string, message: string) {
  return { code, message, details: null, hint: null };
}

const MESSAGGIO_CRUDO =
  'insert or update on table "ripartizioni" violates foreign key constraint "ripartizioni_unita_id_fkey"';

describe("traduciErrore — vincoli del database", () => {
  test("violazione di unicità: dice che il dato è già registrato", () => {
    const messaggio = traduciErrore(
      erroreDb("23505", 'duplicate key value violates unique constraint "unita_condominio_identificativo_unique"')
    );
    expect(messaggio).toMatch(/già registrati/i);
    expect(messaggio).not.toContain("unique");
  });

  test("violazione di foreign key: parla del dato collegato, non del vincolo", () => {
    const messaggio = traduciErrore(erroreDb("23503", MESSAGGIO_CRUDO));
    expect(messaggio).toMatch(/dato collegato/i);
    expect(messaggio).not.toContain("ripartizioni");
    expect(messaggio).not.toContain("fkey");
  });

  test("violazione di check: parla di un valore non ammesso", () => {
    const messaggio = traduciErrore(
      erroreDb("23514", 'new row violates check constraint "assemblee_convocazione_check"')
    );
    expect(messaggio).toMatch(/non è ammesso/i);
    expect(messaggio).not.toContain("check constraint");
  });

  test("colonna obbligatoria vuota", () => {
    expect(traduciErrore(erroreDb("23502", 'null value in column "titolo"'))).toMatch(
      /dato obbligatorio/i
    );
  });

  test("numero fuori scala: i millesimi sono numeric(6,3)", () => {
    expect(
      traduciErrore(erroreDb("22003", "numeric field overflow"))
    ).toMatch(/troppo grande/i);
  });

  test("uuid o numero malformato", () => {
    expect(
      traduciErrore(erroreDb("22P02", 'invalid input syntax for type uuid: "abc"'))
    ).toMatch(/formato valido/i);
  });

  test("RLS: diventa un messaggio sui permessi, non un errore di database", () => {
    const messaggio = traduciErrore(
      erroreDb("42501", 'new row violates row-level security policy for table "spese"')
    );
    expect(messaggio).toMatch(/permessi/i);
    expect(messaggio).not.toMatch(/row-level|policy/i);
  });

  test("riga non trovata da .single()", () => {
    expect(
      traduciErrore(erroreDb("PGRST116", "JSON object requested, multiple (or no) rows returned"))
    ).toMatch(/non esiste più/i);
  });

  test("token scaduto", () => {
    expect(traduciErrore(erroreDb("PGRST301", "JWT expired"))).toMatch(/sessione è scaduta/i);
  });
});

describe("traduciErrore — messaggi applicativi dello schema (P0001)", () => {
  test("il `raise exception` scritto nello schema arriva all'utente così com'è", () => {
    // Testo reale del trigger di disponibilità degli spazi comuni, scritto in
    // italiano proprio perché lo legga chi prenota.
    const messaggio = "Lo spazio risulta già prenotato in questa fascia oraria.";
    expect(traduciErrore({ code: "P0001", message: messaggio })).toBe(messaggio);
  });

  test("un P0001 troppo lungo non è una frase per l'utente: resta il generico", () => {
    const sfogo = "x".repeat(500);
    expect(traduciErrore({ code: "P0001", message: sfogo })).toBe(MESSAGGIO_GENERICO);
  });

  test("un P0001 senza messaggio resta il generico", () => {
    expect(traduciErrore({ code: "P0001", message: "  " })).toBe(MESSAGGIO_GENERICO);
  });
});

describe("traduciErrore — storage e casi non riconosciuti", () => {
  test("lo storage non manda codici: conta lo stato HTTP", () => {
    expect(traduciErrore({ statusCode: "403", message: "new row violates..." })).toMatch(
      /permessi/i
    );
    expect(traduciErrore({ statusCode: "413", message: "Payload too large" })).toMatch(
      /troppo grande/i
    );
    expect(traduciErrore({ statusCode: "409", message: "Duplicate" })).toMatch(
      /già registrati/i
    );
    expect(traduciErrore({ status: 429, message: "Too many requests" })).toMatch(
      /Troppe richieste/i
    );
  });

  test("codice sconosciuto: il messaggio di Postgres non passa", () => {
    const messaggio = traduciErrore(erroreDb("XX000", MESSAGGIO_CRUDO));
    expect(messaggio).toBe(MESSAGGIO_GENERICO);
  });

  test("un Error qualunque non espone il proprio messaggio", () => {
    expect(traduciErrore(new Error("ECONNREFUSED 127.0.0.1:5432"))).toBe(MESSAGGIO_GENERICO);
  });

  test("null, undefined e valori non oggetto non fanno eccezione", () => {
    expect(traduciErrore(null)).toBe(MESSAGGIO_GENERICO);
    expect(traduciErrore(undefined)).toBe(MESSAGGIO_GENERICO);
    expect(traduciErrore("boom")).toBe(MESSAGGIO_GENERICO);
  });
});

describe("traduciErroreAuth", () => {
  test("credenziali sbagliate", () => {
    expect(traduciErroreAuth({ code: "invalid_credentials", message: "Invalid login credentials" }))
      .toMatch(/Email o password non corrette/i);
  });

  test("indirizzo già registrato: non lo conferma", () => {
    const messaggio = traduciErroreAuth({
      code: "user_already_exists",
      message: "User already registered",
    });
    // Il punto dell'asserzione: il testo non deve dire che quell'account
    // esiste (COD-05 evita di rivelarlo in login e recupero password; la
    // registrazione non può essere l'eccezione).
    expect(messaggio).not.toMatch(/già registrat|esiste/i);
    expect(messaggio).toMatch(/Password dimenticata/i);
  });

  test("password debole e password identica alla precedente", () => {
    expect(traduciErroreAuth({ code: "weak_password", message: "Password is too weak" })).toMatch(
      /troppo debole/i
    );
    expect(traduciErroreAuth({ code: "same_password", message: "..." })).toMatch(
      /diversa da quella attuale/i
    );
  });

  test("captcha e limiti di invio", () => {
    expect(traduciErroreAuth({ code: "captcha_failed", message: "captcha protection: ..." }))
      .toMatch(/anti-bot/i);
    expect(traduciErroreAuth({ code: "over_email_send_rate_limit", message: "..." })).toMatch(
      /Troppe richieste/i
    );
  });

  test("codice sconosciuto: niente messaggio di GoTrue", () => {
    expect(
      traduciErroreAuth({ code: "qualcosa_di_nuovo", message: "unexpected_failure: hook timed out" })
    ).toBe(MESSAGGIO_GENERICO);
  });

  test("senza codice resta lo stato HTTP", () => {
    expect(traduciErroreAuth({ status: 429, message: "..." })).toMatch(/Troppe richieste/i);
    expect(traduciErroreAuth({ status: 401, message: "..." })).toMatch(/sessione è scaduta/i);
  });
});

describe("codiceErrore", () => {
  test("legge il codice e lo normalizza a stringa", () => {
    expect(codiceErrore(erroreDb("23505", "..."))).toBe("23505");
    expect(codiceErrore({ code: 42501 })).toBe("42501");
    expect(codiceErrore(new Error("senza codice"))).toBeNull();
    expect(codiceErrore(null)).toBeNull();
  });
});

describe("il dettaglio tecnico finisce nel log", () => {
  test("registraErrore scrive codice, messaggio, dettagli e suggerimento", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    registraErrore("admin/spese/creaSpesa", {
      code: "23503",
      message: MESSAGGIO_CRUDO,
      details: 'Key (unita_id)=(…) is not present in table "unita".',
      hint: null,
    });

    expect(log).toHaveBeenCalledTimes(1);
    const [etichetta, dati] = log.mock.calls[0];
    expect(etichetta).toContain("admin/spese/creaSpesa");
    expect(dati).toMatchObject({ codice: "23503", messaggio: MESSAGGIO_CRUDO });
    expect(dati.dettagli).toContain("unita_id");
  });

  test("messaggioErrore logga sempre e restituisce il testo tradotto", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const messaggio = messaggioErrore(erroreDb("23505", "duplicate key value..."), "admin/unita/x");

    expect(log).toHaveBeenCalledTimes(1);
    expect(messaggio).toMatch(/già registrati/i);
  });

  test("messaggioErroreAuth logga sempre, anche quando il caso è noto", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const messaggio = messaggioErroreAuth({ code: "weak_password", message: "..." }, "registrazione");

    expect(log).toHaveBeenCalledTimes(1);
    expect(messaggio).toMatch(/troppo debole/i);
  });

  test("un errore senza contesto si logga comunque", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    messaggioErrore(new Error("boom"));

    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain("errore");
  });
});
