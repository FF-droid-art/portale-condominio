import { normalizzaIntestazione } from "./mappatura";

// Nome "pulito" della tabella millesimale a partire dall'intestazione della
// colonna: toglie il prefisso "Millesimi"/"proprietà" e capitalizza.
//   "Millesimi proprietà generali" -> "Generali"
//   "Millesimi ascensore"          -> "Ascensore"
//   "Millesimi scala A"            -> "Scala A"
//   "Millesimi garage"             -> "Garage"
export function nomeTabellaMillesimi(intestazione: string): string {
  let s = intestazione
    .trim()
    .replace(/^millesimi\s*/i, "")
    .replace(/^propriet[àa]\s*/i, "")
    .trim();
  if (!s) s = "Generali";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Individua tutte le colonne di millesimi nel foglio (intestazione che
// contiene "millesim"), con il loro indice e il nome-tabella pulito.
export function colonneMillesimi(
  intestazioni: string[]
): { indice: number; nome: string }[] {
  return intestazioni
    .map((header, indice) => ({ indice, header }))
    .filter((c) => normalizzaIntestazione(c.header).includes("millesim"))
    .map((c) => ({ indice: c.indice, nome: nomeTabellaMillesimi(c.header) }));
}
