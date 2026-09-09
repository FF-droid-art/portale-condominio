import { describe, expect, test } from "vitest";
import {
  CATALOGO_NOTIFICHE,
  GRUPPI_NOTIFICHE,
  TIPI_EVENTO,
  deveInviareEmail,
  isTipoEvento,
  statoPreferenze,
  utentiDaNotificare,
} from "./notifiche";

describe("catalogo degli eventi", () => {
  test("ogni tipo compare una volta sola", () => {
    expect(new Set(TIPI_EVENTO).size).toBe(TIPI_EVENTO.length);
  });

  test("ogni voce ha etichetta, descrizione e gruppo", () => {
    for (const voce of CATALOGO_NOTIFICHE) {
      expect(voce.etichetta.length).toBeGreaterThan(0);
      expect(voce.descrizione.length).toBeGreaterThan(0);
      expect(GRUPPI_NOTIFICHE).toContain(voce.gruppo);
    }
  });

  test("i gruppi sono elencati senza ripetizioni", () => {
    expect(new Set(GRUPPI_NOTIFICHE).size).toBe(GRUPPI_NOTIFICHE.length);
  });

  test("isTipoEvento riconosce solo i tipi del catalogo", () => {
    expect(isTipoEvento("nuova_assemblea")).toBe(true);
    expect(isTipoEvento("piccioni_sul_tetto")).toBe(false);
  });
});

describe("deveInviareEmail", () => {
  test("chi non ha mai toccato le impostazioni riceve tutto", () => {
    expect(deveInviareEmail([], "nuova_assemblea")).toBe(true);
    expect(deveInviareEmail(null, "nuova_assemblea")).toBe(true);
    expect(deveInviareEmail(undefined, "avviso_pagamento")).toBe(true);
  });

  test("solo una riga esplicita a false blocca l'invio", () => {
    const prefs = [{ tipo_evento: "nuova_assemblea", email_attiva: false }];
    expect(deveInviareEmail(prefs, "nuova_assemblea")).toBe(false);
    expect(deveInviareEmail(prefs, "avviso_pagamento")).toBe(true);
  });

  test("una riga riattivata torna a far passare l'email", () => {
    expect(
      deveInviareEmail([{ tipo_evento: "nuovo_sondaggio", email_attiva: true }], "nuovo_sondaggio")
    ).toBe(true);
  });

  test("le righe di eventi sconosciuti non influenzano nulla", () => {
    expect(
      deveInviareEmail([{ tipo_evento: "evento_futuro", email_attiva: false }], "nuova_assemblea")
    ).toBe(true);
  });
});

describe("utentiDaNotificare", () => {
  const righe = [
    { utente_id: "ada", tipo_evento: "nuova_assemblea", email_attiva: false },
    { utente_id: "ada", tipo_evento: "avviso_pagamento", email_attiva: true },
    { utente_id: "bruno", tipo_evento: "avviso_pagamento", email_attiva: false },
  ];

  test("toglie solo chi ha disattivato quel preciso evento", () => {
    expect(utentiDaNotificare(righe, "nuova_assemblea", ["ada", "bruno", "carla"])).toEqual([
      "bruno",
      "carla",
    ]);
    expect(utentiDaNotificare(righe, "avviso_pagamento", ["ada", "bruno", "carla"])).toEqual([
      "ada",
      "carla",
    ]);
  });

  test("senza preferenze salvate l'elenco resta intero e nell'ordine dato", () => {
    expect(utentiDaNotificare([], "nuovo_documento", ["carla", "ada"])).toEqual(["carla", "ada"]);
    expect(utentiDaNotificare(null, "nuovo_documento", ["carla", "ada"])).toEqual(["carla", "ada"]);
  });

  test("un elenco di destinatari vuoto resta vuoto", () => {
    expect(utentiDaNotificare(righe, "nuova_assemblea", [])).toEqual([]);
  });
});

describe("statoPreferenze", () => {
  test("restituisce una voce per ogni evento del catalogo", () => {
    const stato = statoPreferenze([{ tipo_evento: "nuovo_sondaggio", email_attiva: false }]);
    expect(stato).toHaveLength(TIPI_EVENTO.length);
    expect(stato.find((s) => s.tipo === "nuovo_sondaggio")?.attiva).toBe(false);
    expect(stato.filter((s) => s.attiva)).toHaveLength(TIPI_EVENTO.length - 1);
  });

  test("senza righe salvate è tutto attivo", () => {
    expect(statoPreferenze([]).every((s) => s.attiva)).toBe(true);
  });
});
