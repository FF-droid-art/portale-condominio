export type Ruolo = "amministratore" | "condomino";

export type Condominio = {
  id: string;
  nome: string;
  indirizzo: string;
  codice_fiscale: string | null;
  iban: string | null;
  banca: string | null;
  intestatario_conto: string | null;
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
  codice_avviso: string | null;
  stripe_checkout_session_id: string | null;
};

export type TabellaMillesimale = {
  id: string;
  condominio_id: string;
  nome: string;
  created_at: string;
};

export type ValoreMillesimale = {
  id: string;
  tabella_id: string;
  unita_id: string;
  valore: number;
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

export type TipoSoggetto =
  | "proprietario"
  | "nudo_proprietario"
  | "usufruttuario"
  | "conduttore"
  | "comodatario"
  | "assegnatario";

export type UnitaProprietario = {
  id: string;
  unita_id: string;
  utente_id: string;
  quota_possesso: number;
  tipo_soggetto: TipoSoggetto;
  diritto_voto: boolean;
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
  /** 1 = prima convocazione, 2 = seconda: cambia le soglie di quorum (art. 1136 c.c.). */
  convocazione: number;
  luogo: string | null;
  verbale_url: string | null;
  link_videoconferenza: string | null;
  created_at: string;
};

export type ModalitaPresenza = "presenza" | "remoto" | "delega";

export type Presenza = {
  id: string;
  assemblea_id: string;
  unita_id: string;
  utente_id: string | null;
  modalita: ModalitaPresenza;
  millesimi_rappresentati: number;
  ora_ingresso: string;
  ora_uscita: string | null;
  registrata_da: string | null;
  nota: string | null;
};

export type RuoloFirmatario = "presidente" | "segretario" | "amministratore" | "altro";

export type FirmaVerbale = {
  id: string;
  assemblea_id: string;
  nominativo: string;
  email: string;
  ruolo: RuoloFirmatario;
  token: string;
  otp_hash: string | null;
  otp_scadenza: string | null;
  otp_tentativi: number;
  otp_inviato_il: string | null;
  richiesta_inviata_il: string | null;
  confermato_il: string | null;
  verbale_url_confermato: string | null;
  created_at: string;
};

export type StatoSondaggio = "aperto" | "chiuso";

export type Sondaggio = {
  id: string;
  condominio_id: string;
  domanda: string;
  descrizione: string | null;
  scadenza: string | null;
  ponderato: boolean;
  stato: StatoSondaggio;
  creato_da: string;
  created_at: string;
};

export type SondaggioOpzione = {
  id: string;
  sondaggio_id: string;
  testo: string;
  ordine: number;
};

export type SondaggioRisposta = {
  id: string;
  sondaggio_id: string;
  opzione_id: string;
  unita_id: string;
  utente_id: string;
  millesimi_rappresentati: number;
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
  /** Conteggio dei voti per testa: serve alla "maggioranza degli intervenuti". */
  tally_n_favorevole: number;
  tally_n_contrario: number;
  tally_n_astenuto: number;
  created_at: string;
};

export type Delega = {
  id: string;
  assemblea_id: string;
  unita_delegante_id: string;
  unita_delegataria_id: string;
  utente_delegato_id: string;
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
