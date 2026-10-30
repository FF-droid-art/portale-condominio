import { describe, expect, test } from "vitest";
import {
  ALFABETO_CODICE_INVITO,
  LUNGHEZZA_CODICE_INVITO,
  codiceInvitoValido,
  formattaCodiceInvito,
  normalizzaCodiceInvito,
  urlRegistrazioneConCodice,
} from "./inviti";

describe("alfabeto del codice", () => {
  test("ha 30 caratteri e nessuno di quelli ambigui", () => {
    expect(ALFABETO_CODICE_INVITO.length).toBe(30);
    for (const escluso of ["0", "1", "I", "L", "O", "U"]) {
      expect(ALFABETO_CODICE_INVITO).not.toContain(escluso);
    }
  });

  test("nessun carattere ripetuto", () => {
    expect(new Set(ALFABETO_CODICE_INVITO).size).toBe(ALFABETO_CODICE_INVITO.length);
  });
});

describe("normalizzaCodiceInvito", () => {
  test("maiuscolo, senza trattini né spazi", () => {
    expect(normalizzaCodiceInvito("abcd-2345")).toBe("ABCD2345");
    expect(normalizzaCodiceInvito("ABCD 2345")).toBe("ABCD2345");
    expect(normalizzaCodiceInvito("  abcd2345  ")).toBe("ABCD2345");
    expect(normalizzaCodiceInvito("A.B.C.D-2.3.4.5")).toBe("ABCD2345");
  });

  test("un codice già normalizzato resta identico (idempotente)", () => {
    expect(normalizzaCodiceInvito("ABCD2345")).toBe("ABCD2345");
    expect(normalizzaCodiceInvito(normalizzaCodiceInvito("abcd-2345"))).toBe("ABCD2345");
  });

  test("vuoto o assente diventa stringa vuota (il campo è facoltativo)", () => {
    expect(normalizzaCodiceInvito("")).toBe("");
    expect(normalizzaCodiceInvito("   ")).toBe("");
    expect(normalizzaCodiceInvito("---")).toBe("");
    expect(normalizzaCodiceInvito(null)).toBe("");
    expect(normalizzaCodiceInvito(undefined)).toBe("");
  });

  test("non corregge i caratteri fuori alfabeto: li lascia vedere a chi valida", () => {
    expect(normalizzaCodiceInvito("o0il1u")).toBe("O0IL1U");
  });
});

describe("formattaCodiceInvito", () => {
  test("otto caratteri diventano XXXX-XXXX", () => {
    expect(formattaCodiceInvito("ABCD2345")).toBe("ABCD-2345");
    expect(formattaCodiceInvito("abcd2345")).toBe("ABCD-2345");
  });

  test("un codice già formattato non raddoppia il trattino", () => {
    expect(formattaCodiceInvito("ABCD-2345")).toBe("ABCD-2345");
    expect(formattaCodiceInvito(formattaCodiceInvito("ABCD2345"))).toBe("ABCD-2345");
  });

  test("lunghezze diverse restano senza trattino (si sta ancora digitando)", () => {
    expect(formattaCodiceInvito("ABC")).toBe("ABC");
    expect(formattaCodiceInvito("ABCD23456")).toBe("ABCD23456");
    expect(formattaCodiceInvito("")).toBe("");
  });
});

describe("codiceInvitoValido", () => {
  test("accetta un codice di otto caratteri dell'alfabeto, come lo si digita", () => {
    expect(codiceInvitoValido("ABCD2345")).toBe(true);
    expect(codiceInvitoValido("abcd-2345")).toBe(true);
    expect(codiceInvitoValido("ABCD 2345")).toBe(true);
  });

  test("rifiuta le lunghezze diverse da otto", () => {
    expect(codiceInvitoValido("ABCD234")).toBe(false);
    expect(codiceInvitoValido("ABCD23456")).toBe(false);
    expect(codiceInvitoValido("")).toBe(false);
    expect(codiceInvitoValido(null)).toBe(false);
  });

  test("rifiuta i caratteri ambigui, che per costruzione non compaiono mai in un codice vero", () => {
    expect(codiceInvitoValido("ABCD234O")).toBe(false);
    expect(codiceInvitoValido("ABCD2340")).toBe(false);
    expect(codiceInvitoValido("ABCD234I")).toBe(false);
    expect(codiceInvitoValido("ABCD234L")).toBe(false);
    expect(codiceInvitoValido("ABCD234U")).toBe(false);
    expect(codiceInvitoValido("ABCD2341")).toBe(false);
  });

  test("ogni carattere dell'alfabeto è accettato in ogni posizione", () => {
    for (const carattere of ALFABETO_CODICE_INVITO) {
      const codice = carattere.repeat(LUNGHEZZA_CODICE_INVITO);
      expect(codiceInvitoValido(codice), codice).toBe(true);
    }
  });
});

describe("urlRegistrazioneConCodice", () => {
  test("porta alla registrazione con il codice formattato in query", () => {
    expect(urlRegistrazioneConCodice("https://portale.example", "ABCD2345")).toBe(
      "https://portale.example/registrazione?codice=ABCD-2345"
    );
  });

  test("non raddoppia la barra se l'origine ne ha una in coda", () => {
    expect(urlRegistrazioneConCodice("https://portale.example/", "ABCD2345")).toBe(
      "https://portale.example/registrazione?codice=ABCD-2345"
    );
  });

  test("accetta un codice già formattato o minuscolo", () => {
    expect(urlRegistrazioneConCodice("http://localhost:3000", "abcd-2345")).toBe(
      "http://localhost:3000/registrazione?codice=ABCD-2345"
    );
  });
});
