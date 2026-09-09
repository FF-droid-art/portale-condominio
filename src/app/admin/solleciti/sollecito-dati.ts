import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getUtenteCorrente } from "@/lib/supabase/dal";
import type { Documento } from "@/lib/documenti/modello";
import { costruisciSollecito, type RataSollecito } from "@/lib/documenti/sollecito";
import { calcolaPosizione, type LivelloSollecito } from "@/lib/solleciti";
import { oggiLocale } from "@/lib/fuso";

type RipartizioneUnita = {
  importo_dovuto: number;
  stato_pagamento: string;
  data_scadenza: string | null;
  data_pagamento: string | null;
  codice_avviso: string | null;
  spesa: { descrizione: string } | null;
};

type SoggettoUnita = {
  attivo: boolean;
  utente: { nome: string; cognome: string; email: string } | null;
  anagrafica: { nominativo: string; email: string | null } | null;
};

export type PosizioneUnitaCompleta = {
  unita: { id: string; identificativo: string; piano: string | null; condominioId: string };
  condominio: {
    nome: string;
    indirizzo: string;
    codiceFiscale: string | null;
    iban: string | null;
    banca: string | null;
    intestatarioConto: string | null;
  };
  destinatari: string[];
  /** Chi può ricevere il sollecito per email: serve un account, non solo un nome. */
  utentiCollegati: { utenteId: string; email: string }[];
  rate: RataSollecito[];
  totale: number;
  giorniRitardoMax: number;
};

/**
 * Raccoglie la posizione arretrata di una unità: le rate scadute, il totale, i
 * soggetti a cui indirizzare la lettera.
 *
 * Come per gli altri documenti, le query passano dal client con la sessione
 * dell'utente: la RLS è l'unico controllo di accesso, quindi un amministratore
 * che non gestisce l'unità non la trova affatto.
 */
export async function leggiPosizioneUnita(
  unitaId: string,
  oggi: string = oggiLocale()
): Promise<PosizioneUnitaCompleta | null> {
  const supabase = await createClient();

  const { data: unita } = await supabase
    .from("unita")
    .select(
      "id, identificativo, piano, condominio_id, condominio:condominio_id(nome, indirizzo, codice_fiscale, iban, banca, intestatario_conto)"
    )
    .eq("id", unitaId)
    .single();

  if (!unita) return null;

  const condominio = unita.condominio as unknown as {
    nome: string;
    indirizzo: string;
    codice_fiscale: string | null;
    iban: string | null;
    banca: string | null;
    intestatario_conto: string | null;
  } | null;

  const [{ data: ripartizioniData }, { data: soggettiData }] = await Promise.all([
    supabase
      .from("ripartizioni")
      .select(
        "importo_dovuto, stato_pagamento, data_scadenza, data_pagamento, codice_avviso, spesa:spesa_id(descrizione)"
      )
      .eq("unita_id", unitaId),
    supabase
      .from("unita_proprietari")
      .select(
        "attivo, utente:utente_id(nome, cognome, email), anagrafica:anagrafica_id(nominativo, email)"
      )
      .eq("unita_id", unitaId),
  ]);

  const ripartizioni = (ripartizioniData ?? []) as unknown as RipartizioneUnita[];
  const posizione = calcolaPosizione(ripartizioni, oggi);

  const rate: RataSollecito[] = posizione.partite.map((p) => ({
    descrizione: p.rata.spesa?.descrizione ?? "Quota condominiale",
    dataScadenza: p.rata.data_scadenza,
    importo: p.rata.importo_dovuto,
    giorniRitardo: p.giorniRitardo,
    codiceAvviso: p.rata.codice_avviso,
  }));

  const soggetti = ((soggettiData ?? []) as unknown as SoggettoUnita[]).filter(
    (s) => s.attivo !== false
  );

  const destinatari = [
    ...new Set(
      soggetti
        .map(
          (s) =>
            s.anagrafica?.nominativo ?? (s.utente ? `${s.utente.nome} ${s.utente.cognome}` : null)
        )
        .filter((n): n is string => !!n)
    ),
  ];

  // Solo chi ha un account può ricevere la notifica dal portale: alle
  // anagrafiche senza utente il sollecito va recapitato in altro modo.
  const utentiCollegati: { utenteId: string; email: string }[] = [];
  const { data: legami } = await supabase
    .from("unita_proprietari")
    .select("utente_id, utente:utente_id(email)")
    .eq("unita_id", unitaId);
  for (const l of legami ?? []) {
    const utenteId = l.utente_id as string | null;
    const email = (l.utente as unknown as { email: string } | null)?.email;
    if (utenteId && email && !utentiCollegati.some((u) => u.utenteId === utenteId)) {
      utentiCollegati.push({ utenteId, email });
    }
  }

  return {
    unita: {
      id: unita.id,
      identificativo: unita.identificativo,
      piano: unita.piano,
      condominioId: unita.condominio_id,
    },
    condominio: {
      nome: condominio?.nome ?? "—",
      indirizzo: condominio?.indirizzo ?? "—",
      codiceFiscale: condominio?.codice_fiscale ?? null,
      iban: condominio?.iban ?? null,
      banca: condominio?.banca ?? null,
      intestatarioConto: condominio?.intestatario_conto ?? null,
    },
    destinatari,
    utentiCollegati,
    rate,
    totale: posizione.totaleScaduto,
    giorniRitardoMax: posizione.giorniRitardoMax,
  };
}

/** La lettera vera e propria, pronta per `generaPdf`. */
export async function costruisciDocumentoSollecito(
  unitaId: string,
  livello: LivelloSollecito
): Promise<Documento | null> {
  const posizione = await leggiPosizioneUnita(unitaId);
  if (!posizione) return null;

  const utente = await getUtenteCorrente();

  return costruisciSollecito({
    condominio: {
      nome: posizione.condominio.nome,
      indirizzo: posizione.condominio.indirizzo,
      codiceFiscale: posizione.condominio.codiceFiscale,
      iban: posizione.condominio.iban,
      banca: posizione.condominio.banca,
      intestatarioConto: posizione.condominio.intestatarioConto,
    },
    unita: {
      identificativo: posizione.unita.identificativo,
      piano: posizione.unita.piano,
    },
    destinatari: posizione.destinatari,
    livello,
    rate: posizione.rate,
    totale: posizione.totale,
    giorniRitardoMax: posizione.giorniRitardoMax,
    amministratore: utente
      ? { nome: utente.nome, cognome: utente.cognome, email: utente.email }
      : null,
    generatoIl: new Date().toISOString(),
  });
}
