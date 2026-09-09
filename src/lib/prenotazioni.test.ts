import { describe, expect, test } from "vitest";
import {
  componiIstante,
  formattaFascia,
  giornoDi,
  minutiDaOra,
  oraDi,
  postiLiberi,
  postiOccupati,
  sovrapposte,
  validaPrenotazione,
  type SpazioPrenotabile,
} from "./prenotazioni";

const SALA: SpazioPrenotabile = {
  nome: "Sala condominiale",
  posti: 1,
  ora_apertura: "08:00:00",
  ora_chiusura: "22:00:00",
  durata_massima_ore: 4,
  attivo: true,
};

const ADESSO = "2026-09-08T10:00";

describe("lettura e composizione degli istanti", () => {
  test("giorno e ora si leggono dalla stringa, non dal fuso del processo", () => {
    expect(giornoDi("2026-09-10T18:00:00+00:00")).toBe("2026-09-10");
    expect(oraDi("2026-09-10T18:00:00+00:00")).toBe("18:00");
    expect(oraDi("2026-09-10T18:00:00")).toBe("18:00");
  });

  test("componiIstante rimette insieme quello che il modulo ha raccolto", () => {
    expect(componiIstante("2026-09-10", "18:00")).toBe("2026-09-10T18:00:00");
    expect(componiIstante("2026-09-10", "18:00:00")).toBe("2026-09-10T18:00:00");
  });

  test("formattaFascia mostra la fascia come è stata prenotata", () => {
    expect(
      formattaFascia({ inizio: "2026-09-10T18:00:00+00:00", fine: "2026-09-10T20:30:00+00:00" })
    ).toBe("18:00 – 20:30");
  });

  test("minutiDaOra rifiuta le ore impossibili", () => {
    expect(minutiDaOra("08:30")).toBe(510);
    expect(minutiDaOra("24:00")).toBeNull();
    expect(minutiDaOra("12:75")).toBeNull();
    expect(minutiDaOra("mattina")).toBeNull();
  });
});

describe("sovrapposte", () => {
  const fascia = { inizio: "2026-09-10T18:00:00", fine: "2026-09-10T20:00:00" };

  test("due fasce che si toccano soltanto non si sovrappongono", () => {
    expect(sovrapposte(fascia, { inizio: "2026-09-10T20:00:00", fine: "2026-09-10T22:00:00" })).toBe(
      false
    );
    expect(sovrapposte(fascia, { inizio: "2026-09-10T16:00:00", fine: "2026-09-10T18:00:00" })).toBe(
      false
    );
  });

  test("riconosce la sovrapposizione anche parziale o per contenimento", () => {
    expect(sovrapposte(fascia, { inizio: "2026-09-10T19:00:00", fine: "2026-09-10T21:00:00" })).toBe(
      true
    );
    expect(sovrapposte(fascia, { inizio: "2026-09-10T18:30:00", fine: "2026-09-10T19:00:00" })).toBe(
      true
    );
    expect(sovrapposte(fascia, { inizio: "2026-09-10T17:00:00", fine: "2026-09-10T23:00:00" })).toBe(
      true
    );
  });

  test("giorni diversi non si sovrappongono mai", () => {
    expect(sovrapposte(fascia, { inizio: "2026-09-11T18:00:00", fine: "2026-09-11T20:00:00" })).toBe(
      false
    );
  });

  test("il confronto regge le due forme di istante (con e senza offset)", () => {
    // Stesso bordo scritto nei due modi: non devono risultare sovrapposte.
    expect(
      sovrapposte(
        { inizio: "2026-09-10T20:00:00", fine: "2026-09-10T22:00:00" },
        { inizio: "2026-09-10T18:00:00+00:00", fine: "2026-09-10T20:00:00+00:00" }
      )
    ).toBe(false);
  });
});

describe("postiOccupati e postiLiberi", () => {
  const esistenti = [
    { id: "a", inizio: "2026-09-10T18:00:00+00:00", fine: "2026-09-10T20:00:00+00:00", stato: "confermata" },
    { id: "b", inizio: "2026-09-10T18:30:00+00:00", fine: "2026-09-10T19:30:00+00:00", stato: "confermata" },
    { id: "c", inizio: "2026-09-10T18:00:00+00:00", fine: "2026-09-10T20:00:00+00:00", stato: "annullata" },
  ];
  const richiesta = { inizio: "2026-09-10T19:00:00", fine: "2026-09-10T19:15:00" };

  test("le prenotazioni annullate non occupano nulla", () => {
    expect(postiOccupati(esistenti, richiesta)).toBe(2);
  });

  test("la prenotazione in modifica non conta contro se stessa", () => {
    expect(postiOccupati(esistenti, richiesta, "a")).toBe(1);
  });

  test("i posti liberi non scendono sotto zero", () => {
    expect(postiLiberi({ posti: 3 }, esistenti, richiesta)).toBe(1);
    expect(postiLiberi({ posti: 1 }, esistenti, richiesta)).toBe(0);
  });
});

describe("validaPrenotazione", () => {
  test("una richiesta valida restituisce la fascia da salvare", () => {
    const esito = validaPrenotazione({
      spazio: SALA,
      giorno: "2026-09-10",
      oraInizio: "18:00",
      oraFine: "20:00",
      esistenti: [],
      adesso: ADESSO,
    });
    expect(esito).toEqual({
      ok: true,
      inizio: "2026-09-10T18:00:00",
      fine: "2026-09-10T20:00:00",
    });
  });

  test("rifiuta uno spazio disattivato", () => {
    const esito = validaPrenotazione({
      spazio: { ...SALA, attivo: false },
      giorno: "2026-09-10",
      oraInizio: "18:00",
      oraFine: "20:00",
      esistenti: [],
      adesso: ADESSO,
    });
    expect("errore" in esito && esito.errore).toContain("non è al momento prenotabile");
  });

  test("rifiuta una fascia fuori dagli orari di apertura", () => {
    const presto = validaPrenotazione({
      spazio: SALA,
      giorno: "2026-09-10",
      oraInizio: "07:00",
      oraFine: "09:00",
      esistenti: [],
      adesso: ADESSO,
    });
    expect("errore" in presto && presto.errore).toContain("dalle 08:00 alle 22:00");

    const tardi = validaPrenotazione({
      spazio: SALA,
      giorno: "2026-09-10",
      oraInizio: "21:00",
      oraFine: "23:00",
      esistenti: [],
      adesso: ADESSO,
    });
    expect("errore" in tardi).toBe(true);
  });

  test("rifiuta una durata oltre il massimo dello spazio", () => {
    const esito = validaPrenotazione({
      spazio: SALA,
      giorno: "2026-09-10",
      oraInizio: "10:00",
      oraFine: "16:00",
      esistenti: [],
      adesso: ADESSO,
    });
    expect("errore" in esito && esito.errore).toContain("non può superare 4 ore");
  });

  test("rifiuta una fascia invertita o troppo breve", () => {
    const invertita = validaPrenotazione({
      spazio: SALA,
      giorno: "2026-09-10",
      oraInizio: "20:00",
      oraFine: "18:00",
      esistenti: [],
      adesso: ADESSO,
    });
    expect("errore" in invertita).toBe(true);

    const breve = validaPrenotazione({
      spazio: SALA,
      giorno: "2026-09-10",
      oraInizio: "18:00",
      oraFine: "18:10",
      esistenti: [],
      adesso: ADESSO,
    });
    expect("errore" in breve && breve.errore).toContain("quarto d'ora");
  });

  test("rifiuta una fascia già passata", () => {
    const esito = validaPrenotazione({
      spazio: SALA,
      giorno: "2026-09-08",
      oraInizio: "09:00",
      oraFine: "10:00",
      esistenti: [],
      adesso: ADESSO,
    });
    expect("errore" in esito && esito.errore).toContain("già passata");
  });

  test("rifiuta la sovrapposizione su uno spazio a posto unico", () => {
    const esito = validaPrenotazione({
      spazio: SALA,
      giorno: "2026-09-10",
      oraInizio: "19:00",
      oraFine: "21:00",
      esistenti: [
        { inizio: "2026-09-10T18:00:00+00:00", fine: "2026-09-10T20:00:00+00:00", stato: "confermata" },
      ],
      adesso: ADESSO,
    });
    expect("errore" in esito && esito.errore).toBe(
      "Lo spazio è già prenotato in questa fascia oraria."
    );
  });

  test("con più posti accetta finché ce n'è almeno uno libero", () => {
    const parcheggio = { ...SALA, nome: "Posti auto ospiti", posti: 2, durata_massima_ore: null };
    const esistenti = [
      { inizio: "2026-09-10T18:00:00+00:00", fine: "2026-09-10T20:00:00+00:00", stato: "confermata" },
    ];

    const primo = validaPrenotazione({
      spazio: parcheggio,
      giorno: "2026-09-10",
      oraInizio: "18:00",
      oraFine: "20:00",
      esistenti,
      adesso: ADESSO,
    });
    expect("ok" in primo).toBe(true);

    const pieno = validaPrenotazione({
      spazio: parcheggio,
      giorno: "2026-09-10",
      oraInizio: "18:00",
      oraFine: "20:00",
      esistenti: [...esistenti, ...esistenti],
      adesso: ADESSO,
    });
    expect("errore" in pieno && pieno.errore).toContain("Tutti i 2 posti");
  });

  test("una fascia che tocca soltanto la precedente è ammessa", () => {
    const esito = validaPrenotazione({
      spazio: SALA,
      giorno: "2026-09-10",
      oraInizio: "20:00",
      oraFine: "22:00",
      esistenti: [
        { inizio: "2026-09-10T18:00:00+00:00", fine: "2026-09-10T20:00:00+00:00", stato: "confermata" },
      ],
      adesso: ADESSO,
    });
    expect("ok" in esito).toBe(true);
  });
});
