import { describe, expect, test } from "vitest";
import {
  FAMIGLIE_ARCHIVIO,
  FAMIGLIE_IMMAGINE,
  FAMIGLIE_PDF_E_IMMAGINI,
  LUNGHEZZA_TESTA_FILE,
  descriviFamiglie,
  estensioneDa,
  riconosciTipoFile,
  testaDiFile,
  verificaTipoFile,
} from "./tipi-file";

/** Costruisce una testa di file da byte e/o sigle ASCII. */
function testa(...pezzi: (number | string)[]): Uint8Array<ArrayBuffer> {
  const byte: number[] = [];
  for (const pezzo of pezzi) {
    if (typeof pezzo === "number") byte.push(pezzo);
    else for (const c of pezzo) byte.push(c.charCodeAt(0));
  }
  return new Uint8Array(byte);
}

const PDF = testa("%PDF-1.7\n%", 0xe2, 0xe3);
const JPEG = testa(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, "JFIF");
const PNG = testa(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d);
const GIF = testa("GIF89a", 0x01, 0x00);
const WEBP = testa("RIFF", 0x24, 0x00, 0x00, 0x00, "WEBPVP8 ");
const HEIC = testa(0x00, 0x00, 0x00, 0x18, "ftypheic");
const AVIF = testa(0x00, 0x00, 0x00, 0x1c, "ftypavif");
const ZIP = testa(0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00);
const OLE2 = testa(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);

describe("riconosciTipoFile", () => {
  test("riconosce i formati attesi dalla firma dei primi byte", () => {
    expect(riconosciTipoFile(PDF)?.famiglia).toBe("pdf");
    expect(riconosciTipoFile(JPEG)?.famiglia).toBe("jpeg");
    expect(riconosciTipoFile(PNG)?.famiglia).toBe("png");
    expect(riconosciTipoFile(GIF)?.famiglia).toBe("gif");
    expect(riconosciTipoFile(WEBP)?.famiglia).toBe("webp");
    expect(riconosciTipoFile(HEIC)?.famiglia).toBe("heic");
    expect(riconosciTipoFile(AVIF)?.famiglia).toBe("avif");
    expect(riconosciTipoFile(ZIP)?.famiglia).toBe("zip");
    expect(riconosciTipoFile(OLE2)?.famiglia).toBe("ole2");
  });

  test("il MIME canonico non dipende da quello che dichiara il client", () => {
    expect(riconosciTipoFile(JPEG)?.mime).toBe("image/jpeg");
    expect(riconosciTipoFile(PDF)?.mime).toBe("application/pdf");
  });

  // È il caso di COD-06: un HTML o un SVG con uno script dentro, spedito
  // come "image/png" o "application/pdf".
  test("rifiuta HTML, SVG e testo semplice", () => {
    expect(riconosciTipoFile(testa("<!DOCTYPE html><script>"))).toBeNull();
    expect(riconosciTipoFile(testa("<html><body>"))).toBeNull();
    expect(riconosciTipoFile(testa('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(riconosciTipoFile(testa("<?xml version=\"1.0\"?><svg>"))).toBeNull();
    expect(riconosciTipoFile(testa("data,importo\n2026-01-01;10,00\n"))).toBeNull();
  });

  test("rifiuta un eseguibile e uno script", () => {
    expect(riconosciTipoFile(testa("MZ", 0x90, 0x00))).toBeNull();
    expect(riconosciTipoFile(testa(0x7f, "ELF"))).toBeNull();
    expect(riconosciTipoFile(testa("#!/bin/sh\nrm -rf /"))).toBeNull();
  });

  test("la firma deve stare in testa: un «%PDF» più in là non vale", () => {
    expect(riconosciTipoFile(testa("<html>\n%PDF-1.7"))).toBeNull();
  });

  test("un file vuoto o troncato non fa saltare il riconoscimento", () => {
    expect(riconosciTipoFile(new Uint8Array())).toBeNull();
    expect(riconosciTipoFile(testa(0xff, 0xd8))).toBeNull();
    expect(riconosciTipoFile(testa("RIFF"))).toBeNull();
    expect(riconosciTipoFile(testa(0x00, 0x00, 0x00, 0x18, "ftyp"))).toBeNull();
  });

  test("un RIFF che non è WebP (un wav) non passa come immagine", () => {
    expect(riconosciTipoFile(testa("RIFF", 0x24, 0x00, 0x00, 0x00, "WAVEfmt "))).toBeNull();
  });
});

describe("verificaTipoFile", () => {
  test("una foto passa dove sono ammesse le immagini", () => {
    const esito = verificaTipoFile(JPEG, "foto.jpg", FAMIGLIE_IMMAGINE);
    expect(esito).toEqual({ ok: true, famiglia: "jpeg", mime: "image/jpeg", estensione: "jpg" });
  });

  test("l'estensione canonica è quella del contenuto, non quella del nome", () => {
    // Una foto chiamata "foto.html" resta una foto, ma il percorso nello
    // storage non deve finire in .html.
    const esito = verificaTipoFile(PNG, "foto.html", FAMIGLIE_IMMAGINE);
    expect(esito).toEqual({ ok: true, famiglia: "png", mime: "image/png", estensione: "png" });
  });

  test("un PDF non passa dove si aspetta solo una foto, e il messaggio dice cosa serve", () => {
    const esito = verificaTipoFile(PDF, "fattura.pdf", FAMIGLIE_IMMAGINE);
    expect(esito.ok).toBe(false);
    if (!esito.ok) {
      expect(esito.errore).toContain("PDF");
      expect(esito.errore).toContain("JPEG");
    }
  });

  test("un HTML travestito da PDF viene respinto", () => {
    const esito = verificaTipoFile(
      testa("<html><script>alert(1)</script>"),
      "regolamento.pdf",
      FAMIGLIE_PDF_E_IMMAGINI
    );
    expect(esito.ok).toBe(false);
  });

  test("un documento Office passa in archivio, con il MIME dedotto dall'estensione", () => {
    expect(verificaTipoFile(ZIP, "bilancio.xlsx", FAMIGLIE_ARCHIVIO)).toEqual({
      ok: true,
      famiglia: "zip",
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      estensione: "xlsx",
    });
    expect(verificaTipoFile(OLE2, "regolamento.doc", FAMIGLIE_ARCHIVIO)).toEqual({
      ok: true,
      famiglia: "ole2",
      mime: "application/msword",
      estensione: "doc",
    });
  });

  test("uno ZIP con un'estensione non da documento non passa", () => {
    // Un .zip qualunque, o un contenitore rinominato .html: l'estensione
    // serve solo a scegliere fra tipi già ammessi, non ad ammetterne altri.
    expect(verificaTipoFile(ZIP, "archivio.zip", FAMIGLIE_ARCHIVIO).ok).toBe(false);
    expect(verificaTipoFile(ZIP, "pagina.html", FAMIGLIE_ARCHIVIO).ok).toBe(false);
    expect(verificaTipoFile(ZIP, "senzaestensione", FAMIGLIE_ARCHIVIO).ok).toBe(false);
  });

  test("i documenti Office non passano dove sono ammessi solo PDF e immagini", () => {
    expect(verificaTipoFile(ZIP, "bilancio.xlsx", FAMIGLIE_PDF_E_IMMAGINI).ok).toBe(false);
    expect(verificaTipoFile(OLE2, "nota.doc", FAMIGLIE_PDF_E_IMMAGINI).ok).toBe(false);
  });
});

describe("testaDiFile", () => {
  test("legge solo la testa, non tutto il file", async () => {
    const contenuto = new Uint8Array(LUNGHEZZA_TESTA_FILE * 4);
    contenuto.set(PNG, 0);
    const testaLetta = await testaDiFile(new Blob([contenuto]));
    expect(testaLetta.length).toBe(LUNGHEZZA_TESTA_FILE);
    expect(riconosciTipoFile(testaLetta)?.famiglia).toBe("png");
  });

  test("un file più corto della testa si legge comunque per intero", async () => {
    const testaLetta = await testaDiFile(new Blob([GIF]));
    expect(testaLetta.length).toBe(GIF.length);
    expect(riconosciTipoFile(testaLetta)?.famiglia).toBe("gif");
  });
});

describe("estensioneDa", () => {
  test("minuscola, senza punto", () => {
    expect(estensioneDa("Bilancio 2025.XLSX")).toBe("xlsx");
  });

  test("nomi strani non producono estensioni strane", () => {
    expect(estensioneDa("senzaestensione")).toBe("");
    expect(estensioneDa(".gitignore")).toBe("");
    expect(estensioneDa("finisce.con.punto.")).toBe("");
  });
});

describe("descriviFamiglie", () => {
  test("elenca i formati in italiano, con «o» prima dell'ultimo", () => {
    expect(descriviFamiglie(["pdf", "jpeg", "png"])).toBe("PDF, JPEG o PNG");
  });

  test("zip e OLE2 si dicono una volta sola: per chi carica sono «documenti Office»", () => {
    const descrizione = descriviFamiglie(["zip", "ole2"]);
    expect(descrizione).toBe("documenti Office (doc, docx, xls, xlsx, odt, ods)");
  });
});
