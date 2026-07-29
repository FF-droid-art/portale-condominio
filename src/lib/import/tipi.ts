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
