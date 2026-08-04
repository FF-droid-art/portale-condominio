import type { RigaImportCondominioUnita } from "./tipi";

/**
 * Prepara le righe "per persona" prima di validazione e import:
 *  - nome condominio opzionale: se assente si usa l'indirizzo come nome;
 *  - scarta le righe che non identificano un'unità (né identificativo né
 *    indirizzo), tipiche righe di totale o vuote di coda degli export.
 *
 * NON collassa: mantiene una riga per occupante, perché la Fase 3 crea un
 * legame unità↔persona per ognuna. Funzione pura, usata lato client
 * (anteprima) e lato server (rivalidazione).
 */
export function preparaRighePersone(
  righe: RigaImportCondominioUnita[]
): RigaImportCondominioUnita[] {
  return righe
    .map((r) => ({
      ...r,
      nomeCondominio: r.nomeCondominio.trim() || r.indirizzoCondominio.trim(),
    }))
    .filter(
      (r) => r.identificativo.trim() !== "" || r.indirizzoCondominio.trim() !== ""
    );
}

/**
 * Fonde le righe che descrivono la stessa unità (più occupanti) in un'unica
 * riga-unità. Usato SOLO per contare/mostrare le unità in anteprima: i
 * millesimi presi sono il valore valido più alto tra le righe (le righe
 * inquilino li hanno vuoti). L'import vero raggruppa lato database.
 */
export function collassaUnita(
  righe: RigaImportCondominioUnita[]
): RigaImportCondominioUnita[] {
  const perUnita = new Map<string, RigaImportCondominioUnita>();
  for (const riga of righe) {
    const chiave = `${riga.nomeCondominio}||${riga.indirizzoCondominio}||${riga.identificativo}`;
    const esistente = perUnita.get(chiave);
    if (!esistente) {
      perUnita.set(chiave, { ...riga });
      continue;
    }
    esistente.piano = esistente.piano ?? riga.piano;
    esistente.codiceFiscaleCondominio =
      esistente.codiceFiscaleCondominio ?? riga.codiceFiscaleCondominio;
    esistente.millesimiProprieta = millesimoPreferito(
      esistente.millesimiProprieta,
      riga.millesimiProprieta
    );
  }
  return [...perUnita.values()];
}

// Sceglie il millesimo "migliore" tra due righe della stessa unità: ignora i
// NaN (celle vuote) e tiene il valore più alto. Se entrambi NaN resta NaN.
function millesimoPreferito(a: number, b: number): number {
  if (Number.isNaN(a)) return b;
  if (Number.isNaN(b)) return a;
  return Math.max(a, b);
}
