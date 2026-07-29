export type Ruolo = "amministratore" | "condomino";

export type Condominio = {
  id: string;
  nome: string;
  indirizzo: string;
  codice_fiscale: string | null;
  amministratore_id: string;
  import_batch_id: string | null;
  created_at: string;
};

export type Unita = {
  id: string;
  condominio_id: string;
  identificativo: string;
  piano: string | null;
  millesimi_proprieta: number;
  import_batch_id: string | null;
  created_at: string;
};

export type StatoPagamento = "da_pagare" | "pagato" | "in_ritardo";

export type Spesa = {
  id: string;
  condominio_id: string;
  descrizione: string;
  importo_totale: number;
  categoria: string;
  data_spesa: string;
  fornitore: string | null;
  documento_url: string | null;
  import_batch_id: string | null;
  created_at: string;
};

export type Ripartizione = {
  id: string;
  spesa_id: string;
  unita_id: string;
  importo_dovuto: number;
  stato_pagamento: StatoPagamento;
  data_scadenza: string | null;
  data_pagamento: string | null;
};

export type TipoImportBatch = "unita" | "spese" | "condomini_unita";

export type ImportBatch = {
  id: string;
  condominio_id: string | null;
  tipo: TipoImportBatch;
  nome_file: string;
  righe_importate: number;
  creato_da: string;
  created_at: string;
};

export type Utente = {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  ruolo: Ruolo;
  created_at: string;
};

export type TipoAssemblea = "ordinaria" | "straordinaria";
export type StatoAssemblea = "convocata" | "in_corso" | "conclusa";
export type StatoVotazione = "aperta" | "chiusa";
export type EsitoPunto = "approvato" | "respinto" | null;
export type SceltaVoto = "favorevole" | "contrario" | "astenuto";

export type Assemblea = {
  id: string;
  condominio_id: string;
  data_assemblea: string;
  tipo: TipoAssemblea;
  stato: StatoAssemblea;
  verbale_url: string | null;
  link_videoconferenza: string | null;
  created_at: string;
};

export type PuntoOdg = {
  id: string;
  assemblea_id: string;
  numero_punto: number;
  descrizione: string;
  tipo_maggioranza: string;
  stato_votazione: StatoVotazione;
  esito: EsitoPunto;
  esito_favorevole: number | null;
  esito_contrario: number | null;
  esito_astenuto: number | null;
  esito_quorum_totale: number | null;
  tally_favorevole: number;
  tally_contrario: number;
  tally_astenuto: number;
  created_at: string;
};

export type Voto = {
  id: string;
  punto_id: string;
  unita_id: string;
  utente_id: string;
  scelta: SceltaVoto;
  millesimi_rappresentati: number;
  data_voto: string;
};
