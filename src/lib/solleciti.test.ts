import { describe, expect, test } from "vitest";
import {
  ETICHETTE_LIVELLO,
  SOGLIE_LIVELLO,
  calcolaPosizione,
  isLivelloSollecito,
  livelloSuggerito,
  posizioniPerUnita,
} from "./solleciti";

const OGGI = "2026-09-09";

/** Rata di comodo: scadenza e importo sono l'unica cosa che cambia nei test. */
function rata(scadenza: string | null, importo = 100, stato = "da_pagare") {
  return {
    importo_dovuto: importo,
    stato_pagamento: stato,
    data_scadenza: scadenza,
    data_pagamento: null,
  };
}

describe("livelloSuggerito", () => {
  test("nessun livello finché il termine non è passato", () => {
    expect(livelloSuggerito(0)).toBeNull();
    expect(livelloSuggerito(-5)).toBeNull();
  });

  test("le soglie scattano al giorno dichiarato, non a quello dopo", () => {
    expect(livelloSuggerito(SOGLIE_LIVELLO[1])).toBe(1);
    expect(livelloSuggerito(SOGLIE_LIVELLO[2] - 1)).toBe(1);
    expect(livelloSuggerito(SOGLIE_LIVELLO[2])).toBe(2);
    expect(livelloSuggerito(SOGLIE_LIVELLO[3] - 1)).toBe(2);
    expect(livelloSuggerito(SOGLIE_LIVELLO[3])).toBe(3);
  });

  test("un ritardo molto lungo resta al livello massimo", () => {
    expect(livelloSuggerito(900)).toBe(3);
  });

  test("ogni livello ha un'etichetta", () => {
    expect(ETICHETTE_LIVELLO[1]).toBe("Primo sollecito");
    expect(ETICHETTE_LIVELLO[3]).toBe("Diffida");
  });

  test("isLivelloSollecito accetta solo 1, 2 e 3", () => {
    expect(isLivelloSollecito(2)).toBe(true);
    expect(isLivelloSollecito(0)).toBe(false);
    expect(isLivelloSollecito(4)).toBe(false);
  });
});

describe("calcolaPosizione", () => {
  test("un'unità in regola non ha nulla di scaduto", () => {
    const posizione = calcolaPosizione(
      [rata("2026-08-01", 200, "pagato"), rata("2026-12-31", 150)],
      OGGI
    );
    expect(posizione).toMatchObject({
      totaleScaduto: 0,
      rateScadute: 0,
      giorniRitardoMax: 0,
      livello: null,
    });
  });

  test("il giorno della scadenza non è ancora ritardo", () => {
    expect(calcolaPosizione([rata(OGGI)], OGGI).rateScadute).toBe(0);
    expect(calcolaPosizione([rata("2026-09-08")], OGGI).giorniRitardoMax).toBe(1);
  });

  test("somma le rate arretrate e prende il ritardo più lungo", () => {
    const posizione = calcolaPosizione(
      [
        rata("2026-09-01", 120), // 8 giorni
        rata("2026-06-01", 80), // 100 giorni
        rata("2026-10-01", 500), // non ancora scaduta
        rata("2026-01-01", 400, "pagato"), // saldata
      ],
      OGGI
    );
    expect(posizione.totaleScaduto).toBe(200);
    expect(posizione.rateScadute).toBe(2);
    expect(posizione.giorniRitardoMax).toBe(100);
    expect(posizione.livello).toBe(3);
  });

  test("le partite escono dalla più vecchia alla più recente", () => {
    const posizione = calcolaPosizione([rata("2026-09-01", 10), rata("2026-06-01", 20)], OGGI);
    expect(posizione.partite.map((p) => p.rata.importo_dovuto)).toEqual([20, 10]);
    expect(posizione.partite[0].giorniRitardo).toBe(100);
  });

  test("una rata senza scadenza non è arretrata da sola", () => {
    expect(calcolaPosizione([rata(null, 300)], OGGI).rateScadute).toBe(0);
  });

  test("una rata senza scadenza ma segnata a mano in ritardo entra nel totale", () => {
    const posizione = calcolaPosizione([rata(null, 300, "in_ritardo")], OGGI);
    expect(posizione.totaleScaduto).toBe(300);
    expect(posizione.rateScadute).toBe(1);
    // Non si sa da quando: non deve gonfiare il livello suggerito.
    expect(posizione.giorniRitardoMax).toBe(0);
    expect(posizione.livello).toBeNull();
  });

  test("una data di scadenza illeggibile non manda in errore il calcolo", () => {
    expect(calcolaPosizione([rata("scaduta")], OGGI).rateScadute).toBe(0);
  });
});

describe("posizioniPerUnita", () => {
  const rate = [
    { unita_id: "int-1", ...rata("2026-06-01", 80) },
    { unita_id: "int-1", ...rata("2026-09-01", 20) },
    { unita_id: "int-2", ...rata("2026-09-01", 500) },
    { unita_id: "int-3", ...rata("2026-12-01", 900) },
    { unita_id: "int-4", ...rata("2026-01-01", 900, "pagato") },
  ];

  test("le unità in regola non compaiono", () => {
    expect(posizioniPerUnita(rate, OGGI).map((p) => p.unitaId)).toEqual(["int-1", "int-2"]);
  });

  test("ordina per ritardo più lungo, poi per importo", () => {
    const posizioni = posizioniPerUnita(rate, OGGI);
    expect(posizioni[0].unitaId).toBe("int-1");
    expect(posizioni[0].posizione.totaleScaduto).toBe(100);
    expect(posizioni[1].posizione.totaleScaduto).toBe(500);
  });

  test("un elenco vuoto non produce posizioni", () => {
    expect(posizioniPerUnita([], OGGI)).toEqual([]);
  });
});
