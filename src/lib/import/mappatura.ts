import type { CampoImport } from "./tipi";

export function normalizzaIntestazione(testo: string): string {
  return testo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Euristica greedy: per ogni campo (nell'ordine dato), assegna la prima
 * colonna non ancora usata la cui intestazione normalizzata contiene uno
 * dei sinonimi del campo. Le colonne restano disponibili all'admin per
 * la correzione manuale nel passo successivo, questo è solo un suggerimento.
 */
export function suggerisciMappatura(
  intestazioni: string[],
  campi: CampoImport[]
): Record<string, number | null> {
  const normalizzate = intestazioni.map(normalizzaIntestazione);
  const usate = new Set<number>();
  const mappatura: Record<string, number | null> = {};

  for (const campo of campi) {
    let trovato: number | null = null;
    for (const sinonimo of campo.sinonimi) {
      const indice = normalizzate.findIndex(
        (h, i) => !usate.has(i) && h.includes(sinonimo)
      );
      if (indice !== -1) {
        trovato = indice;
        break;
      }
    }
    if (trovato !== null) usate.add(trovato);
    mappatura[campo.chiave] = trovato;
  }

  return mappatura;
}
