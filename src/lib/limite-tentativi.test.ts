import { describe, expect, test } from "vitest";
import {
  LIMITI,
  attesa,
  chiaveTentativo,
  estraiIp,
  messaggioLimite,
  minutiDiAttesa,
  normalizzaEmail,
} from "./limite-tentativi";

describe("normalizzaEmail", () => {
  test("toglie spazi e differenze di maiuscole", () => {
    expect(normalizzaEmail("  Mario.Rossi@Example.COM ")).toBe("mario.rossi@example.com");
  });
});

describe("chiaveTentativo", () => {
  test("è un'impronta esadecimale, non l'email in chiaro", () => {
    const chiave = chiaveTentativo("login", ["mario@example.com", "1.2.3.4"]);
    expect(chiave).toMatch(/^[0-9a-f]{64}$/);
    expect(chiave).not.toContain("mario");
  });

  test("gli stessi elementi danno la stessa chiave", () => {
    expect(chiaveTentativo("login", ["a@b.it", "1.2.3.4"])).toBe(
      chiaveTentativo("login", ["a@b.it", "1.2.3.4"])
    );
  });

  test("la stessa coppia su azioni diverse non condivide il contatore", () => {
    expect(chiaveTentativo("login", ["a@b.it", "1.2.3.4"])).not.toBe(
      chiaveTentativo("recupero_password", ["a@b.it", "1.2.3.4"])
    );
  });

  test("IP diverso, contatore diverso: un ufficio non blocca l'altro", () => {
    expect(chiaveTentativo("login", ["a@b.it", "1.2.3.4"])).not.toBe(
      chiaveTentativo("login", ["a@b.it", "5.6.7.8"])
    );
  });

  test("gli elementi vuoti vengono scartati, non trattati come valore", () => {
    // Due IP ignoti non devono finire nello stesso contatore solo perché
    // entrambi sono nulli: resta la sola email a distinguerli.
    expect(chiaveTentativo("login", ["a@b.it", null])).toBe(chiaveTentativo("login", ["a@b.it"]));
    expect(chiaveTentativo("login", ["a@b.it", null])).not.toBe(
      chiaveTentativo("login", ["c@d.it"])
    );
  });
});

describe("estraiIp", () => {
  test("preferisce l'header scritto dalla piattaforma", () => {
    const h = new Headers({
      "x-vercel-forwarded-for": "9.9.9.9",
      "x-real-ip": "8.8.8.8",
      "x-forwarded-for": "7.7.7.7",
    });
    expect(estraiIp(h)).toBe("9.9.9.9");
  });

  test("di una catena di proxy prende il primo elemento, cioè il client", () => {
    const h = new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1, 10.0.0.2" });
    expect(estraiIp(h)).toBe("1.2.3.4");
  });

  test("senza header utili restituisce null invece di una stringa vuota", () => {
    expect(estraiIp(new Headers())).toBeNull();
    expect(estraiIp(new Headers({ "x-forwarded-for": "   " }))).toBeNull();
  });
});

describe("minutiDiAttesa", () => {
  const adesso = new Date("2026-03-01T10:00:00Z");

  test("arrotonda per eccesso: 4 minuti e mezzo si dicono 5", () => {
    expect(minutiDiAttesa("2026-03-01T10:04:30Z", adesso)).toBe(5);
  });

  test("non dice mai «fra 0 minuti»", () => {
    expect(minutiDiAttesa("2026-03-01T10:00:01Z", adesso)).toBe(1);
    expect(minutiDiAttesa("2026-03-01T09:50:00Z", adesso)).toBe(1);
  });

  test("regge un valore mancante o illeggibile", () => {
    expect(minutiDiAttesa(null, adesso)).toBe(1);
    expect(minutiDiAttesa("non una data", adesso)).toBe(1);
  });
});

describe("attesa", () => {
  test("accorda il singolare", () => {
    expect(attesa(1)).toBe("un minuto");
    expect(attesa(0)).toBe("un minuto");
    expect(attesa(7)).toBe("7 minuti");
  });
});

describe("messaggioLimite", () => {
  const adesso = new Date("2026-03-01T10:00:00Z");

  test("dice quanto aspettare", () => {
    const messaggio = messaggioLimite("login", "2026-03-01T10:06:00Z", adesso);
    expect(messaggio).toContain("6 minuti");
  });

  test("nessun messaggio rivela se l'account esiste", () => {
    // Il principio è già rispettato dal login ("Email o password non
    // corrette"): un blocco non deve essere la scappatoia che lo aggira.
    for (const azione of Object.keys(LIMITI) as (keyof typeof LIMITI)[]) {
      const messaggio = messaggioLimite(azione, "2026-03-01T10:05:00Z", adesso);
      expect(messaggio.toLowerCase()).not.toMatch(/registrat|esiste|account|iscritt|utente/);
    }
  });
});

describe("configurazione dei limiti", () => {
  test("ogni azione ha numeri sensati e non blocca per sempre", () => {
    for (const [azione, limite] of Object.entries(LIMITI)) {
      expect(limite.massimo, azione).toBeGreaterThanOrEqual(3);
      expect(limite.finestraMinuti, azione).toBeGreaterThan(0);
      // Un'attesa massima oltre l'ora, su un portale condominiale senza help
      // desk, equivarrebbe a un blocco definitivo.
      expect(limite.finestraMinuti, azione).toBeLessThanOrEqual(60);
    }
  });

  test("il recupero password è più severo del login, perché ogni tentativo spedisce una email", () => {
    expect(LIMITI.recupero_password.massimo).toBeLessThan(LIMITI.login.massimo);
  });

  test("il limite di solo IP sulla firma è molto più alto di quello per singolo link", () => {
    // Deve restare fuori portata di un uso legittimo dietro un NAT: è un
    // tetto al costo degli invii, non un controllo sull'utente.
    expect(LIMITI.richiesta_otp_firma_ip.massimo).toBeGreaterThan(
      LIMITI.richiesta_otp_firma.massimo * 2
    );
  });
});
