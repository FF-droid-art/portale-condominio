import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getUtenteCorrente } from "@/lib/supabase/dal";
import type { Documento } from "@/lib/documenti/modello";
import {
  costruisciStatoPatrimoniale,
  type PartitaUnita,
} from "@/lib/documenti/stato-patrimoniale";
import { oggiLocale } from "@/lib/fuso";

const ETICHETTA_QUALIFICA: Record<string, string> = {
  proprietario: "Proprietario",
  nudo_proprietario: "Nudo proprietario",
  usufruttuario: "Usufruttuario",
  conduttore: "Conduttore",
  comodatario: "Comodatario",
  assegnatario: "Assegnatario",
};

type SoggettoUnita = {
  quota_possesso: number;
  tipo_soggetto: string;
  attivo: boolean;
  utente: { nome: string; cognome: string } | null;
  anagrafica: { nominativo: string } | null;
};

type RipartizioneUnita = {
  importo_dovuto: number;
  stato_pagamento: string;
  data_scadenza: string | null;
  data_pagamento: string | null;
  codice_avviso: string | null;
  spesa: { descrizione: string; categoria: string; data_spesa: string } | null;
};

/**
 * Raccoglie tutto ciò che serve allo "stato patrimoniale" di una unità.
 *
 * Sta in un modulo a parte, come `documenti-dati.ts` per le assemblee: le query
 * passano dal client con la sessione dell'utente, quindi la RLS resta l'unico
 * controllo di accesso — un amministratore non può generare il documento di
 * un'unità che non gestisce, perché per lui quell'unità non esiste.
 */
export async function costruisciDocumentoStatoPatrimoniale(
  unitaId: string
): Promise<Documento | null> {
  const supabase = await createClient();

  const { data: unita } = await supabase
    .from("unita")
    // Una sola stringa letterale, senza concatenazioni: il client Supabase
    // deduce i tipi del risultato leggendo il testo del select, e un'espressione
    // composta gli farebbe perdere l'informazione.
    .select(
      "id, identificativo, piano, millesimi_proprieta, condominio_id, condominio:condominio_id(nome, indirizzo, codice_fiscale, iban, banca, intestatario_conto)"
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

  const [{ data: soggettiData }, { data: ripartizioniData }, { data: valoriData }] =
    await Promise.all([
      supabase
        .from("unita_proprietari")
        .select(
          "quota_possesso, tipo_soggetto, attivo, utente:utente_id(nome, cognome), anagrafica:anagrafica_id(nominativo)"
        )
        .eq("unita_id", unitaId)
        .order("created_at"),
      supabase
        .from("ripartizioni")
        .select(
          "importo_dovuto, stato_pagamento, data_scadenza, data_pagamento, codice_avviso, spesa:spesa_id(descrizione, categoria, data_spesa)"
        )
        .eq("unita_id", unitaId),
      supabase
        .from("valori_millesimali")
        .select("valore, tabella:tabella_id(nome)")
        .eq("unita_id", unitaId),
    ]);

  const soggetti = ((soggettiData ?? []) as unknown as SoggettoUnita[])
    .filter((s) => s.attivo !== false)
    .map((s) => ({
      nominativo:
        s.anagrafica?.nominativo ??
        (s.utente ? `${s.utente.nome} ${s.utente.cognome}` : "Soggetto non indicato"),
      qualifica: ETICHETTA_QUALIFICA[s.tipo_soggetto] ?? s.tipo_soggetto,
      quota: s.quota_possesso,
    }));

  // L'anno di competenza è quello della scadenza; se manca, quello della spesa:
  // è la data che l'amministratore userebbe per collocare la partita.
  const partite: PartitaUnita[] = ((ripartizioniData ?? []) as unknown as RipartizioneUnita[]).map(
    (r) => ({
      descrizione: r.spesa?.descrizione ?? "Ripartizione",
      categoria: r.spesa?.categoria ?? "—",
      dataCompetenza: r.data_scadenza ?? r.spesa?.data_spesa ?? "",
      dataScadenza: r.data_scadenza,
      importo: r.importo_dovuto,
      statoPagamento: r.stato_pagamento,
      dataPagamento: r.data_pagamento,
      codiceAvviso: r.codice_avviso,
    })
  );

  const millesimiPerTabella = ((valoriData ?? []) as unknown as {
    valore: number;
    tabella: { nome: string } | null;
  }[])
    .filter((v) => v.tabella && v.tabella.nome !== "Generali")
    .map((v) => ({ nome: v.tabella!.nome, valore: v.valore }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "it"));

  const utente = await getUtenteCorrente();

  return costruisciDocumento({
    condominio,
    unita,
    soggetti,
    partite,
    millesimiPerTabella,
    utente,
  });
}

function costruisciDocumento(input: {
  condominio: {
    nome: string;
    indirizzo: string;
    codice_fiscale: string | null;
    iban: string | null;
    banca: string | null;
    intestatario_conto: string | null;
  } | null;
  unita: { identificativo: string; piano: string | null; millesimi_proprieta: number };
  soggetti: { nominativo: string; qualifica: string; quota: number }[];
  partite: PartitaUnita[];
  millesimiPerTabella: { nome: string; valore: number }[];
  utente: { nome: string; cognome: string; email: string } | null;
}): Documento {
  return costruisciStatoPatrimoniale({
    condominio: {
      nome: input.condominio?.nome ?? "—",
      indirizzo: input.condominio?.indirizzo ?? "—",
      codiceFiscale: input.condominio?.codice_fiscale ?? null,
      iban: input.condominio?.iban ?? null,
      banca: input.condominio?.banca ?? null,
      intestatarioConto: input.condominio?.intestatario_conto ?? null,
    },
    unita: {
      identificativo: input.unita.identificativo,
      piano: input.unita.piano,
      millesimiProprieta: input.unita.millesimi_proprieta,
      millesimiPerTabella: input.millesimiPerTabella,
    },
    soggetti: input.soggetti,
    partite: input.partite,
    annoRiferimento: Number(oggiLocale().slice(0, 4)),
    amministratore: input.utente
      ? { nome: input.utente.nome, cognome: input.utente.cognome, email: input.utente.email }
      : null,
    generatoIl: new Date().toISOString(),
  });
}
