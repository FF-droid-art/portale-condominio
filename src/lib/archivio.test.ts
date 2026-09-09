import { describe, expect, test } from "vitest";
import { estensione, formatDimensione, indiceCategoria } from "./archivio";

describe("formatDimensione", () => {
  test("sceglie l'unità in base alla grandezza", () => {
    expect(formatDimensione(512)).toBe("512 B");
    expect(formatDimensione(2048)).toBe("2,0 kB");
    expect(formatDimensione(1024 * 1024)).toBe("1,0 MB");
  });

  test("sopra la decina toglie i decimali, che non aggiungono nulla", () => {
    expect(formatDimensione(1024 * 50)).toBe("50 kB");
    expect(formatDimensione(1024 * 1024 * 12)).toBe("12 MB");
  });

  test("usa la virgola decimale italiana", () => {
    expect(formatDimensione(1024 * 1024 * 1.5)).toBe("1,5 MB");
  });

  test("un valore mancante o assurdo non produce «NaN»", () => {
    expect(formatDimensione(null)).toBe("—");
    expect(formatDimensione(undefined)).toBe("—");
    expect(formatDimensione(-1)).toBe("—");
  });
});

describe("estensione", () => {
  test("restituisce l'estensione in maiuscolo", () => {
    expect(estensione("regolamento.pdf")).toBe("PDF");
    expect(estensione("bilancio 2025.xlsx")).toBe("XLSX");
  });

  test("regge i nomi senza estensione o con il punto in posizione strana", () => {
    expect(estensione("regolamento")).toBe("FILE");
    expect(estensione(".gitignore")).toBe("FILE");
    expect(estensione("archivio.")).toBe("FILE");
  });

  test("un'estensione lunghissima non sfonda la colonna", () => {
    expect(estensione("file.estensioneassurda")).toBe("ESTEN");
  });
});

describe("indiceCategoria", () => {
  test("il regolamento viene prima di «altro»", () => {
    expect(indiceCategoria("regolamento")).toBeLessThan(indiceCategoria("altro"));
  });

  test("una categoria sconosciuta finisce in fondo invece di rompere l'ordinamento", () => {
    expect(indiceCategoria("inesistente")).toBeGreaterThanOrEqual(indiceCategoria("altro"));
  });
});
