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

/* -------------------------------------------------------------------------
   Manutenzione, fornitori, archivio documenti, spazi comuni
   ------------------------------------------------------------------------- */

export type CategoriaFornitore =
  | "ascensore"
  | "caldaia_riscaldamento"
  | "idraulico"
  | "elettricista"
  | "pulizie"
  | "giardinaggio"
  | "antincendio"
  | "assicurazione"
  | "edile"
  | "altro";

export type Fornitore = {
  id: string;
  condominio_id: string;
  nome: string;
  categoria: CategoriaFornitore;
  referente: string | null;
  email: string | null;
  telefono: string | null;
  partita_iva: string | null;
  note: string | null;
  attivo: boolean;
  created_at: string;
};

export type Periodicita =
  | "nessuna"
  | "mensile"
  | "trimestrale"
  | "semestrale"
  | "annuale"
  | "biennale";

export type StatoManutenzione = "programmata" | "completata" | "annullata";

export type ManutenzioneProgrammata = {
  id: string;
  condominio_id: string;
  fornitore_id: string | null;
  spesa_id: string | null;
  titolo: string;
  descrizione: string | null;
  data_prossima: string;
  periodicita: Periodicita;
  stato: StatoManutenzione;
  data_completamento: string | null;
  costo_previsto: number | null;
  created_at: string;
};

export type CategoriaSegnalazione =
  | "ascensore"
  | "riscaldamento"
  | "idraulico"
  | "elettrico"
  | "pulizie"
  | "parti_comuni"
  | "infiltrazioni"
  | "altro";

export type PrioritaSegnalazione = "bassa" | "normale" | "alta";
export type StatoSegnalazione = "aperta" | "in_corso" | "chiusa";

export type Segnalazione = {
  id: string;
  condominio_id: string;
  /** null = parti comuni. */
  unita_id: string | null;
  titolo: string;
  descrizione: string;
  categoria: CategoriaSegnalazione;
  priorita: PrioritaSegnalazione;
  stato: StatoSegnalazione;
  fornitore_id: string | null;
  aperta_da: string;
  foto_url: string | null;
  chiusa_il: string | null;
  created_at: string;
  aggiornata_il: string;
};

export type SegnalazioneNota = {
  id: string;
  segnalazione_id: string;
  autore_id: string;
  testo: string;
  /** Nota di servizio dell'amministratore: non visibile al condòmino. */
  interna: boolean;
  created_at: string;
};

export type CategoriaDocumento =
  | "regolamento"
  | "planimetria"
  | "polizza"
  | "bilancio"
  | "contratto"
  | "certificazione"
  | "altro";

export type DocumentoCondominio = {
  id: string;
  condominio_id: string;
  titolo: string;
  descrizione: string | null;
  categoria: CategoriaDocumento;
  percorso: string;
  nome_file: string;
  dimensione_byte: number | null;
  mime_type: string | null;
  caricato_da: string;
  created_at: string;
};

export type SpazioComune = {
  id: string;
  condominio_id: string;
  nome: string;
  descrizione: string | null;
  /** Prenotazioni che possono coesistere nella stessa fascia oraria. */
  posti: number;
  ora_apertura: string;
  ora_chiusura: string;
  durata_massima_ore: number | null;
  attivo: boolean;
  created_at: string;
};

export type StatoPrenotazione = "confermata" | "annullata";

export type PrenotazioneSpazio = {
  id: string;
  spazio_id: string;
  unita_id: string;
  utente_id: string;
  inizio: string;
  fine: string;
  note: string | null;
  stato: StatoPrenotazione;
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
