import type { RigaImportCondominioUnita, RigaImportSpesa, RigaImportUnita } from "./tipi";

const STATI_PAGAMENTO_VALIDI = new Set(["da_pagare", "pagato", "in_ritardo"]);

/**
 * Ritorna il messaggio d'errore per la riga, oppure null se valida.
 * Usata sia lato client (anteprima istantanea) sia lato server
 * (rivalidazione: non ci si fida mai del solo controllo client).
 */
export function validaRigaUnita(riga: RigaImportUnita): string | null {
  if (!riga.identificativo.trim()) return "Identificativo mancante.";
  if (riga.millesimi_proprieta === null || Number.isNaN(riga.millesimi_proprieta)) {
    return "Millesimi di proprietà mancanti o non numerici.";
  }
  if (riga.millesimi_proprieta < 0) return "Millesimi di proprietà negativi.";
  return null;
}

export function validaRigaCondominioUnita(riga: RigaImportCondominioUnita): string | null {
  if (!riga.nomeCondominio.trim()) return "Nome condominio mancante.";
  if (!riga.indirizzoCondominio.trim()) return "Indirizzo condominio mancante.";
  if (!riga.identificativo.trim()) return "Identificativo unità mancante.";
  // I millesimi appartengono all'unità, non a ogni occupante: una riga
  // inquilino può non averli. Se assenti l'unità parte da 0 (li rifinisce
  // la Fase 4). Si segnala solo un valore negativo, che è un errore vero.
  if (!Number.isNaN(riga.millesimiProprieta) && riga.millesimiProprieta < 0) {
    return "Millesimi di proprietà negativi.";
  }
  // Persona (se presente): la quota, se indicata, dev'essere tra 1 e 100.
  if (riga.nominativo && riga.nominativo.trim() && !Number.isNaN(riga.quota)) {
    if (riga.quota <= 0 || riga.quota > 100) {
      return "Quota di titolarità fuori intervallo (1-100).";
    }
  }
  return null;
}

export function validaRigaSpesa(riga: RigaImportSpesa): string | null {
  if (!riga.identificativoUnita.trim()) return "Identificativo unità mancante.";
  if (!riga.descrizione.trim()) return "Descrizione mancante.";
  if (!riga.categoria.trim()) return "Categoria mancante.";
  if (!riga.dataSpesa || !/^\d{4}-\d{2}-\d{2}$/.test(riga.dataSpesa)) {
    return "Data spesa mancante o non valida.";
  }
  if (riga.importoDovuto === null || Number.isNaN(riga.importoDovuto)) {
    return "Importo dovuto mancante o non numerico.";
  }
  if (riga.importoDovuto < 0) return "Importo dovuto negativo.";
  if (!STATI_PAGAMENTO_VALIDI.has(riga.statoPagamento)) {
    return "Stato pagamento non valido (atteso: da_pagare, pagato, in_ritardo).";
  }
  if (riga.dataScadenza && !/^\d{4}-\d{2}-\d{2}$/.test(riga.dataScadenza)) {
    return "Data scadenza non valida.";
  }
  if (riga.dataPagamento && !/^\d{4}-\d{2}-\d{2}$/.test(riga.dataPagamento)) {
    return "Data pagamento non valida.";
  }
  return null;
}
