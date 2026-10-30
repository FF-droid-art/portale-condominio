import { describe, expect, test } from "vitest";
import { costruisciEmailConvocazione } from "./convocazione-email";

describe("costruisciEmailConvocazione", () => {
  test("contenuto minimo: solo tipo e data, nessun luogo né punto", () => {
    const { subject, html } = costruisciEmailConvocazione({
      tipo: "ordinaria",
      dataAssemblea: "2026-03-10T18:00",
    });
    expect(subject).toContain("ordinaria");
    expect(html).toContain("ordinaria");
    expect(html).not.toContain("Luogo:");
    expect(html).not.toContain("Collegamento online:");
    expect(html).toContain("sarà disponibile sul portale");
  });

  test("include il luogo quando presente", () => {
    const { html } = costruisciEmailConvocazione({
      tipo: "ordinaria",
      dataAssemblea: "2026-03-10T18:00",
      luogo: "Sala riunioni, piano terra",
    });
    expect(html).toContain("Sala riunioni, piano terra");
  });

  test("non mostra una riga vuota se il luogo è solo spazi", () => {
    const { html } = costruisciEmailConvocazione({
      tipo: "ordinaria",
      dataAssemblea: "2026-03-10T18:00",
      luogo: "   ",
    });
    expect(html).not.toContain("Luogo:");
  });

  test("include il link della videoconferenza, se presente", () => {
    const { html } = costruisciEmailConvocazione({
      tipo: "straordinaria",
      dataAssemblea: "2026-03-10T18:00",
      linkVideoconferenza: "https://meet.example.com/assemblea",
    });
    expect(html).toContain("https://meet.example.com/assemblea");
    expect(html).toContain("Collegamento online:");
  });

  test("elenca l'ordine del giorno in ordine di numero punto, non di inserimento", () => {
    const { html } = costruisciEmailConvocazione({
      tipo: "ordinaria",
      dataAssemblea: "2026-03-10T18:00",
      puntiOdg: [
        { numeroPunto: 2, descrizione: "Approvazione rendiconto" },
        { numeroPunto: 1, descrizione: "Nomina del presidente" },
      ],
    });
    const indice1 = html.indexOf("Nomina del presidente");
    const indice2 = html.indexOf("Approvazione rendiconto");
    expect(indice1).toBeGreaterThan(-1);
    expect(indice1).toBeLessThan(indice2);
    expect(html).not.toContain("sarà disponibile sul portale");
  });

  test("indica la convocazione (prima/seconda) nell'oggetto e nel corpo", () => {
    const { subject, html } = costruisciEmailConvocazione({
      tipo: "ordinaria",
      dataAssemblea: "2026-03-10T18:00",
      convocazione: 2,
    });
    expect(subject).toContain("seconda convocazione");
    expect(html).toContain("seconda convocazione");
  });

  test("evita l'iniezione HTML nel luogo e nei punti", () => {
    const { html } = costruisciEmailConvocazione({
      tipo: "ordinaria",
      dataAssemblea: "2026-03-10T18:00",
      luogo: "<script>alert(1)</script>",
      puntiOdg: [{ numeroPunto: 1, descrizione: "<img src=x onerror=alert(1)>" }],
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
  });
});
