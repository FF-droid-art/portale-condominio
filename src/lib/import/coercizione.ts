/**
 * Conversioni "best effort" da valori di cella grezzi (numero, stringa,
 * Date) ai tipi attesi dal DB. Euristiche pensate per fogli italiani
 * (es. "1.234,56"); da rivedere quando arriverà un file reale di
 * riferimento (TeamSystem o altro gestionale).
 */

export function coercisciNumero(valore: unknown): number | null {
  if (typeof valore === "number") {
    return Number.isFinite(valore) ? valore : null;
  }
  if (typeof valore !== "string") return null;

  const pulito = valore.trim();
  if (!pulito) return null;

  const haVirgola = pulito.includes(",");
  const haPunto = pulito.includes(".");

  // "1.234,56" (punto=migliaia, virgola=decimali) -> 1234.56
  // "120,500" (solo virgola, es. millesimi con 3 decimali) -> 120.500
  // "1234.56" / "1234" (solo punto o nessun separatore) -> invariato
  const normalizzato =
    haVirgola && haPunto
      ? pulito.replace(/\./g, "").replace(",", ".")
      : haVirgola
        ? pulito.replace(",", ".")
        : pulito;

  const numero = Number(normalizzato);
  return Number.isFinite(numero) ? numero : null;
}

export function coercisciData(valore: unknown): string | null {
  if (valore instanceof Date) {
    if (Number.isNaN(valore.getTime())) return null;
    return valore.toISOString().slice(0, 10);
  }
  if (typeof valore !== "string") return null;

  const pulito = valore.trim();
  if (!pulito) return null;

  // ISO yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(pulito)) return pulito.slice(0, 10);

  // dd/mm/yyyy oppure dd-mm-yyyy
  const match = pulito.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const [, giorno, mese, anno] = match;
    return `${anno}-${mese.padStart(2, "0")}-${giorno.padStart(2, "0")}`;
  }

  return null;
}
