import ExcelJS from "exceljs";
import Papa from "papaparse";
import type { FileAnalizzato, FoglioAnalizzato, FoglioGrezzo } from "./tipi";

/**
 * Legge un file in tutti i suoi fogli, restituendo le righe grezze (senza
 * decidere quale sia l'intestazione: ci pensa `estraiFoglio` dopo la scelta
 * dell'utente, con un default da `rilevaRigaIntestazione`).
 *
 * Supporta solo .xlsx (exceljs) e .csv (papaparse) — niente .xls legacy
 * (formato binario OLE, non supportato da exceljs) per evitare di
 * introdurre la libreria "xlsx" di SheetJS, che ha CVE high-severity
 * irrisolte su npm (prototype pollution / ReDoS su file non fidati).
 */
export async function analizzaFile(file: File): Promise<FileAnalizzato> {
  const nome = file.name.toLowerCase();

  if (nome.endsWith(".csv")) {
    return analizzaCsv(file);
  }
  if (nome.endsWith(".xlsx")) {
    return analizzaXlsx(file);
  }
  throw new Error("Formato non supportato: usa un file .xlsx o .csv.");
}

async function analizzaCsv(file: File): Promise<FileAnalizzato> {
  const testo = await file.text();
  const risultato = Papa.parse<string[]>(testo, { skipEmptyLines: true });
  return { fogli: [{ nome: "CSV", righe: risultato.data }] };
}

async function analizzaXlsx(file: File): Promise<FileAnalizzato> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const fogli: FoglioGrezzo[] = [];
  workbook.eachSheet((foglio) => {
    // Leggiamo le celle per posizione (1..columnCount) invece di usare
    // row.values (array sparso, 1-based): così le colonne restano allineate
    // anche quando una riga ha celle iniziali vuote (tipico dei titoli).
    const numColonne = foglio.columnCount;
    const matrice: unknown[][] = [];
    foglio.eachRow({ includeEmpty: false }, (row) => {
      const valori: unknown[] = [];
      for (let c = 1; c <= numColonne; c++) {
        valori.push(normalizzaValoreCella(row.getCell(c).value));
      }
      matrice.push(valori);
    });
    fogli.push({ nome: foglio.name, righe: matrice });
  });

  return { fogli };
}

/**
 * Euristica per indovinare quale riga contiene le intestazioni: tra le
 * prime righe, quella con più celle valorizzate. Le righe-titolo di un
 * export gestionale hanno 1-2 celle piene, l'intestazione vera ne ha molte.
 * È solo un default: l'utente può correggerlo nel passo di caricamento.
 */
export function rilevaRigaIntestazione(righe: unknown[][]): number {
  const LIMITE = Math.min(righe.length, 15);
  let migliore = 0;
  let maxPiene = -1;
  for (let i = 0; i < LIMITE; i++) {
    const piene = righe[i].filter(
      (v) => v !== null && v !== undefined && String(v).trim() !== ""
    ).length;
    if (piene > maxPiene) {
      maxPiene = piene;
      migliore = i;
    }
  }
  return migliore;
}

/**
 * Dato un foglio grezzo e l'indice della riga d'intestazione, produce il
 * `FoglioAnalizzato` (intestazioni + righe dati) atteso dal resto del flusso.
 */
export function estraiFoglio(
  foglio: FoglioGrezzo,
  rigaIntestazione: number
): FoglioAnalizzato {
  const intestazioni = (foglio.righe[rigaIntestazione] ?? []).map((v) =>
    String(v ?? "")
  );
  const righe = foglio.righe.slice(rigaIntestazione + 1);
  return { intestazioni, righe };
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
