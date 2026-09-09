/**
 * Archivio dei documenti del condominio.
 *
 * Finora nel portale esistevano solo due tipi di documento, ciascuno legato a
 * un'entità (la fattura di una spesa, il verbale di un'assemblea). Qui stanno i
 * documenti che appartengono al condominio e basta: regolamento, planimetrie,
 * polizze, bilanci storici. Li carica l'amministratore, li leggono tutti i
 * condòmini di quello stabile.
 */

import type { CategoriaDocumento } from "@/lib/types";

export const ETICHETTE_CATEGORIA_DOCUMENTO: Record<CategoriaDocumento, string> = {
  regolamento: "Regolamento condominiale",
  planimetria: "Planimetrie e tavole",
  polizza: "Polizze assicurative",
  bilancio: "Bilanci e rendiconti",
  contratto: "Contratti",
  certificazione: "Certificazioni e collaudi",
  altro: "Altro",
};

export const CATEGORIE_DOCUMENTO = Object.keys(
  ETICHETTE_CATEGORIA_DOCUMENTO
) as CategoriaDocumento[];

/**
 * Ordine di presentazione delle categorie: dai documenti che si consultano di
 * continuo (il regolamento) a quelli che si cercano una volta l'anno.
 */
export function indiceCategoria(categoria: string): number {
  const i = (CATEGORIE_DOCUMENTO as string[]).indexOf(categoria);
  return i === -1 ? CATEGORIE_DOCUMENTO.length : i;
}

/** Dimensione massima di un documento caricato in archivio. */
export const DOCUMENTO_MAX_BYTES = 10 * 1024 * 1024;

/** "1,4 MB" — leggibile, non 1468006. */
export function formatDimensione(byte: number | null | undefined): string {
  if (byte == null || byte < 0) return "—";
  if (byte < 1024) return `${byte} B`;
  const kb = byte / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0).replace(".", ",")} kB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb < 10 ? 1 : 0).replace(".", ",")} MB`;
}

/** Estensione del file, per l'etichetta accanto al nome ("PDF", "XLSX"). */
export function estensione(nomeFile: string): string {
  const punto = nomeFile.lastIndexOf(".");
  if (punto <= 0 || punto === nomeFile.length - 1) return "FILE";
  return nomeFile.slice(punto + 1).toUpperCase().slice(0, 5);
}
