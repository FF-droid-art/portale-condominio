import type { CampoImport } from "./tipi";
import { coercisciData, coercisciNumero } from "./coercizione";

export type RigaGrezzaCostruita = Record<string, string | number | null>;

/**
 * Applica la mappatura colonne + coercizione di tipo a ogni riga grezza,
 * producendo dizionari generici (chiave campo -> valore). Ogni wizard
 * specifico converte poi questi dizionari nel proprio tipo forte
 * (RigaImportUnita / RigaImportSpesa).
 */
export function costruisciRighe(
  campi: CampoImport[],
  mappatura: Record<string, number | null>,
  righeGrezze: unknown[][]
): RigaGrezzaCostruita[] {
  return righeGrezze
    .filter((riga) =>
      riga.some((v) => v !== null && v !== undefined && String(v).trim() !== "")
    )
    .map((riga) => {
      const risultato: RigaGrezzaCostruita = {};
      for (const campo of campi) {
        const indice = mappatura[campo.chiave];
        const valoreGrezzo =
          indice === null || indice === undefined ? undefined : riga[indice];

        if (campo.tipo === "numero") {
          risultato[campo.chiave] = coercisciNumero(valoreGrezzo);
        } else if (campo.tipo === "data") {
          risultato[campo.chiave] = coercisciData(valoreGrezzo);
        } else {
          const testo =
            valoreGrezzo === null || valoreGrezzo === undefined
              ? ""
              : String(valoreGrezzo).trim();
          risultato[campo.chiave] = testo === "" && !campo.obbligatorio ? null : testo;
        }
      }
      return risultato;
    });
}
