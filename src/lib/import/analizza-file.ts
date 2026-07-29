import ExcelJS from "exceljs";
import Papa from "papaparse";
import type { FoglioAnalizzato } from "./tipi";

/**
 * Legge la prima riga come intestazioni e il resto come righe grezze.
 * Supporta solo .xlsx (exceljs) e .csv (papaparse) — niente .xls legacy
 * (formato binario OLE, non supportato da exceljs) per evitare di
 * introdurre la libreria "xlsx" di SheetJS, che ha CVE high-severity
 * irrisolte su npm (prototype pollution / ReDoS su file non fidati).
 */
export async function analizzaFile(file: File): Promise<FoglioAnalizzato> {
  const nome = file.name.toLowerCase();

  if (nome.endsWith(".csv")) {
    return analizzaCsv(file);
  }
  if (nome.endsWith(".xlsx")) {
    return analizzaXlsx(file);
  }
  throw new Error("Formato non supportato: usa un file .xlsx o .csv.");
}

async function analizzaCsv(file: File): Promise<FoglioAnalizzato> {
  const testo = await file.text();
  const risultato = Papa.parse<string[]>(testo, { skipEmptyLines: true });
  const [intestazioni, ...righe] = risultato.data;
  if (!intestazioni) return { intestazioni: [], righe: [] };
  return { intestazioni, righe };
}

async function analizzaXlsx(file: File): Promise<FoglioAnalizzato> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const foglio = workbook.worksheets[0];
  if (!foglio) return { intestazioni: [], righe: [] };

  const matrice: unknown[][] = [];
  foglio.eachRow({ includeEmpty: false }, (row) => {
    // row.values ha un elemento fantasma all'indice 0 (exceljs è 1-based).
    const valori = (row.values as unknown[]).slice(1).map(normalizzaValoreCella);
    matrice.push(valori);
  });

  const [intestazioni, ...righe] = matrice;
  if (!intestazioni) return { intestazioni: [], righe: [] };
  return { intestazioni: intestazioni.map((v) => String(v ?? "")), righe };
}

// Le celle con formula o testo formattato arrivano da exceljs come oggetti
// ({ formula, result } oppure { richText: [...] }) invece che valori
// primitivi: le riduciamo al loro valore "piatto" prima della validazione.
function normalizzaValoreCella(valore: unknown): unknown {
  if (valore && typeof valore === "object") {
    if ("result" in valore) return (valore as { result: unknown }).result;
    if ("richText" in valore) {
      return (valore as { richText: { text: string }[] }).richText
        .map((parte) => parte.text)
        .join("");
    }
    if ("text" in valore) return (valore as { text: unknown }).text;
  }
  return valore;
}
