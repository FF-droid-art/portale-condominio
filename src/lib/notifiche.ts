/**
 * Preferenze di notifica via email, evento per evento.
 *
 * MODELLO A OPT-OUT. L'assenza di una riga vale "sì": chi non ha mai aperto la
 * pagina delle impostazioni continua a ricevere tutto, esattamente come prima
 * che questa funzione esistesse. Solo chi disattiva esplicitamente un tipo di
 * evento smette di ricevere quelle email. È la scelta prudente per un portale
 * condominiale, dove il messaggio che non arriva (una convocazione, un avviso
 * di pagamento) fa danno più di uno di troppo.
 *
 * Il tipo di evento è una colonna `text` e non un enum di Postgres: aggiungere
 * un evento nuovo deve essere una modifica di codice, non una migrazione. Le
 * righe di tipo sconosciuto (per esempio scritte da una versione più recente
 * dell'applicazione) vengono semplicemente ignorate qui.
 *
 * Restano SEMPRE fuori da questo meccanismo, e vanno spedite direttamente:
 *  - le email di autenticazione (recupero password, codice usa-e-getta della
 *    conferma del verbale): disattivarle bloccherebbe l'accesso;
 *  - gli avvisi che l'amministratore scrive a mano dalla scheda del
 *    condominio, che vanno alle anagrafiche e non agli account.
 */

export type TipoEvento =
  | "nuova_assemblea"
  | "verbale_assemblea"
  | "nuovo_sondaggio"
  | "nuova_segnalazione"
  | "aggiornamento_segnalazione"
  | "nuovo_documento"
  | "sollecito_pagamento"
  | "avviso_pagamento"
  | "prenotazione_confermata"
  | "scadenza_manutenzione";

export type GruppoNotifiche = "Assemblee" | "Pagamenti" | "Segnalazioni e manutenzioni" | "Servizi";

export type VoceCatalogo = {
  tipo: TipoEvento;
  etichetta: string;
  descrizione: string;
  gruppo: GruppoNotifiche;
};

/**
 * Catalogo mostrato nella pagina delle impostazioni: una voce per tipo di
 * evento, con il testo che spiega quando quell'email parte davvero. L'ordine è
 * quello in cui le caselle compaiono a schermo.
 */
export const CATALOGO_NOTIFICHE: VoceCatalogo[] = [
  {
    tipo: "nuova_assemblea",
    etichetta: "Nuova assemblea convocata",
    descrizione: "Quando l'amministratore convoca un'assemblea del tuo condominio.",
    gruppo: "Assemblee",
  },
  {
    tipo: "verbale_assemblea",
    etichetta: "Verbale disponibile",
    descrizione: "Quando il verbale di un'assemblea viene pubblicato sul portale.",
    gruppo: "Assemblee",
  },
  {
    tipo: "nuovo_sondaggio",
    etichetta: "Nuovo sondaggio",
    descrizione: "Quando viene aperta una consultazione a cui puoi rispondere.",
    gruppo: "Assemblee",
  },
  {
    tipo: "avviso_pagamento",
    etichetta: "Nuova quota a tuo carico",
    descrizione: "Quando una spesa viene ripartita e ti viene addebitata una quota.",
    gruppo: "Pagamenti",
  },
  {
    tipo: "sollecito_pagamento",
    etichetta: "Solleciti di pagamento",
    descrizione:
      "Quando risultano quote scadute e non versate. Se disattivi questa voce l'amministratore " +
      "continuerà comunque a poterti recapitare il sollecito per altre vie.",
    gruppo: "Pagamenti",
  },
  {
    tipo: "nuova_segnalazione",
    etichetta: "Nuove segnalazioni",
    descrizione: "Quando viene aperta una segnalazione che ti riguarda o sulle parti comuni.",
    gruppo: "Segnalazioni e manutenzioni",
  },
  {
    tipo: "aggiornamento_segnalazione",
    etichetta: "Avanzamento delle segnalazioni",
    descrizione: "Quando una segnalazione che segui cambia stato o riceve una nota.",
    gruppo: "Segnalazioni e manutenzioni",
  },
  {
    tipo: "scadenza_manutenzione",
    etichetta: "Scadenze di manutenzione",
    descrizione: "Quando si avvicina un intervento programmato sullo stabile.",
    gruppo: "Segnalazioni e manutenzioni",
  },
  {
    tipo: "nuovo_documento",
    etichetta: "Nuovi documenti in archivio",
    descrizione: "Quando l'amministratore carica un documento del condominio.",
    gruppo: "Servizi",
  },
  {
    tipo: "prenotazione_confermata",
    etichetta: "Prenotazione degli spazi comuni",
    descrizione: "Conferma della prenotazione di una sala o di un posto auto.",
    gruppo: "Servizi",
  },
];

export const TIPI_EVENTO = CATALOGO_NOTIFICHE.map((v) => v.tipo);

export const ETICHETTE_EVENTO = Object.fromEntries(
  CATALOGO_NOTIFICHE.map((v) => [v.tipo, v.etichetta])
) as Record<TipoEvento, string>;

/** Gruppi nell'ordine in cui vanno mostrati, senza ripetizioni. */
export const GRUPPI_NOTIFICHE = CATALOGO_NOTIFICHE.reduce<GruppoNotifiche[]>((acc, v) => {
  if (!acc.includes(v.gruppo)) acc.push(v.gruppo);
  return acc;
}, []);

export function isTipoEvento(valore: string): valore is TipoEvento {
  return (TIPI_EVENTO as string[]).includes(valore);
}

/** Una riga di `preferenze_notifiche`, ridotta a ciò che serve alla decisione. */
export type PreferenzaNotifica = {
  tipo_evento: string;
  email_attiva: boolean;
};

/**
 * Decide se una email di quel tipo va spedita a quell'utente.
 *
 * L'unico caso in cui la risposta è "no" è una riga esplicita con
 * `email_attiva = false`: nessuna riga, riga di un altro evento o elenco vuoto
 * significano tutti "sì" (vedi il modello a opt-out in testa al file).
 */
export function deveInviareEmail(
  preferenze: PreferenzaNotifica[] | null | undefined,
  tipo: TipoEvento
): boolean {
  const riga = (preferenze ?? []).find((p) => p.tipo_evento === tipo);
  return riga ? riga.email_attiva : true;
}

/** Riga come arriva dal database quando si leggono le preferenze di più utenti. */
export type RigaPreferenza = PreferenzaNotifica & { utente_id: string };

/**
 * Filtra un elenco di destinatari in un colpo solo: serve agli invii massivi
 * (una convocazione va a tutto il condominio) per non interrogare il database
 * una volta per persona.
 *
 * Gli utenti senza alcuna riga restano nell'elenco, sempre per il modello a
 * opt-out. L'ordine dei destinatari in ingresso viene mantenuto.
 */
export function utentiDaNotificare(
  righe: RigaPreferenza[] | null | undefined,
  tipo: TipoEvento,
  utentiIds: string[]
): string[] {
  const disattivati = new Set(
    (righe ?? [])
      .filter((r) => r.tipo_evento === tipo && r.email_attiva === false)
      .map((r) => r.utente_id)
  );
  return utentiIds.filter((id) => !disattivati.has(id));
}

/**
 * Riordina le preferenze salvate nella forma che serve al modulo delle
 * impostazioni: una voce per ogni tipo di evento del catalogo, con lo stato
 * corrente (attivo per difetto).
 */
export function statoPreferenze(
  preferenze: PreferenzaNotifica[] | null | undefined
): { tipo: TipoEvento; attiva: boolean }[] {
  return TIPI_EVENTO.map((tipo) => ({ tipo, attiva: deveInviareEmail(preferenze, tipo) }));
}
