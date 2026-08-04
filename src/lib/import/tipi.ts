export type TipoCampo = "testo" | "numero" | "data";

export type CampoImport = {
  chiave: string;
  etichetta: string;
  obbligatorio: boolean;
  tipo: TipoCampo;
  sinonimi: string[];
};

export type ErroreRiga = { indice: number; messaggio: string };

export type FoglioAnalizzato = {
  intestazioni: string[];
  righe: unknown[][];
};

// Un foglio "grezzo": tutte le righe (intestazioni comprese) prima di
// decidere quale sia la riga d'intestazione. I gestionali veri esportano
// spesso righe-titolo iniziali e più fogli nello stesso file, quindi non
// si può più assumere che l'intestazione sia sempre la prima riga.
export type FoglioGrezzo = {
  nome: string;
  righe: unknown[][];
};

export type FileAnalizzato = {
  fogli: FoglioGrezzo[];
};

export type RigaImportUnita = {
  identificativo: string;
  piano: string | null;
  millesimi_proprieta: number;
};

export type RigaImportCondominioUnita = {
  nomeCondominio: string;
  indirizzoCondominio: string;
  codiceFiscaleCondominio: string | null;
  identificativo: string;
  piano: string | null;
  millesimiProprieta: number;
  // Dati della persona legata all'unità (Fase 3). Opzionali: un file può
  // contenere solo condomìni e unità. Una riga = un occupante dell'unità.
  nominativo: string | null;
  email: string | null;
  qualifica: string | null; // testo grezzo dal file (es. "Ex proprietario")
  quota: number; // quota di titolarità %, NaN se non indicata
};

// Un valore di millesimi per (unità, tipo di tabella). Il file può avere più
// colonne di millesimi (Generali, Ascensore, Garage, Scala...): ognuna diventa
// una tabella millesimale.
export type RigaMillesimo = {
  nomeCondominio: string;
  indirizzoCondominio: string;
  identificativo: string;
  nomeTabella: string;
  valore: number;
};

export type RigaImportSpesa = {
  identificativoUnita: string;
  descrizione: string;
  categoria: string;
  dataSpesa: string;
  importoDovuto: number;
  fornitore: string | null;
  statoPagamento: "da_pagare" | "pagato" | "in_ritardo";
  dataScadenza: string | null;
  dataPagamento: string | null;
};
