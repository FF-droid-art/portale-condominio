import "server-only";
import { createClient } from "@/lib/supabase/server";
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

type RipartizioneUnita = {
  importo_dovuto: number;
  stato_pagamento: string;
  data_scadenza: string | null;
  data_pagamento: string | null;
  codice_avviso: string | null;
  spesa: { descrizione: string; categoria: string; data_spesa: string } | null;
};

/** Riga di `unita_soggetti`. */
type SoggettoRpc = {
  nominativo: string;
  tipo_soggetto: string;
  quota_possesso: number;
  attivo: boolean;
};

/** Riga di `condominio_amministratore`. */
type AmministratoreRpc = { nome: string; cognome: string; email: string };

/**
 * Raccoglie tutto ciò che serve allo "stato patrimoniale" di una unità.
 *
 * Sta in `src/lib/documenti/` e non dentro la cartella di una route perché lo
 * usano due aree: l'amministratore (`/admin/unita/[id]/stato-patrimoniale`) e
 * il titolare dell'unità (`/area-riservata/unita/[id]/stato-patrimoniale`).
 * Come per il rendiconto, non esiste una variante per ruolo: la funzione
 * riceve l'id dell'unità e lascia decidere alla RLS e alle funzioni
 * `security definer`.
 *
 * Unità, condominio, ripartizioni e valori millesimali passano dalla sessione
 * dell'utente: la RLS restituisce l'unità al solo amministratore che la
 * gestisce e a chi la possiede, e per tutti gli altri il documento non esiste
 * (404). Fanno eccezione due dati che la RLS stringe più del dovuto per questo
 * documento:
 *
 *  - i SOGGETTI collegati: `unita_proprietari_select` mostra al condòmino solo
 *    la propria riga, quindi un comproprietario leggerebbe un documento che
 *    dichiara il suo 50% e tace sull'altro. Si passa da `unita_soggetti`, che
 *    verifica `possiede_unita()` al proprio interno;
 *  - l'AMMINISTRATORE: un condòmino non può leggere la riga "utenti" di chi
 *    amministra. Si passa da `condominio_amministratore`, e il nome che
 *    compare è quello di chi amministra lo stabile — non di chi sta
 *    scaricando il documento.
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

  const [
    { data: soggettiData, error: soggettiErrore },
    { data: ripartizioniData },
    { data: valoriData },
    { data: amministratoreData },
  ] = await Promise.all([
    supabase.rpc("unita_soggetti", { p_unita_id: unitaId }),
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
    supabase
      .rpc("condominio_amministratore", { p_condominio_id: unita.condominio_id })
      .maybeSingle(),
  ]);

  // Un elenco di soggetti vuoto per un guasto si leggerebbe come "unità senza
  // titolari": su un documento che accompagna una compravendita non è una
  // sfumatura. Si interrompe.
  if (soggettiErrore) {
    console.error("Lettura dei soggetti dell'unità fallita", { unitaId, soggettiErrore });
    throw new Error("Impossibile leggere i soggetti collegati all'unità.");
  }

  const soggetti = ((soggettiData ?? []) as SoggettoRpc[])
    .filter((s) => s.attivo !== false)
    .map((s) => ({
      nominativo: s.nominativo,
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

  return costruisciDocumento({
    condominio,
    unita,
    soggetti,
    partite,
    millesimiPerTabella,
    amministratore: amministratoreData as AmministratoreRpc | null,
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
  amministratore: { nome: string; cognome: string; email: string } | null;
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
    amministratore: input.amministratore
      ? {
          nome: input.amministratore.nome,
          cognome: input.amministratore.cognome,
          email: input.amministratore.email,
        }
      : null,
    generatoIl: new Date().toISOString(),
  });
}
