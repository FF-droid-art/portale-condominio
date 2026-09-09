import { createClient } from "@/lib/supabase/server";
import { richiedeUtente } from "@/lib/supabase/dal";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { VistaCalendario } from "@/components/calendario/vista-calendario";
import { oggiLocale } from "@/lib/fuso";
import { meseDi, raccogliEventi } from "@/lib/calendario";

export const metadata = { title: "Calendario" };

type AssembleaRiga = {
  id: string;
  data_assemblea: string;
  tipo: string;
  stato: string;
  condominio: { nome: string } | null;
};

type ManutenzioneRiga = {
  id: string;
  data_prossima: string;
  titolo: string;
  stato: string;
  condominio: { nome: string } | null;
};

type PrenotazioneRiga = {
  id: string;
  inizio: string;
  fine: string;
  stato: string;
  utente_id: string;
  spazio: { nome: string } | null;
  unita: { identificativo: string } | null;
};

type RipartizioneRiga = {
  id: string;
  data_scadenza: string | null;
  stato_pagamento: string;
  importo_dovuto: number;
  unita: { identificativo: string } | null;
  spesa: { descrizione: string } | null;
};

/**
 * Calendario del condòmino.
 *
 * Il perimetro lo disegna già la RLS: assemblee e manutenzioni del proprio
 * condominio, prenotazioni degli spazi che può vedere, e — questo va filtrato
 * qui — le scadenze delle sole unità che possiede. Le quote altrui non sono
 * affar suo, e la RLS delle ripartizioni glielo impedirebbe comunque: il
 * filtro esplicito serve a rendere evidente l'intenzione a chi legge.
 */
export default async function CalendarioCondominoPage({
  searchParams,
}: {
  searchParams: Promise<{ mese?: string }>;
}) {
  const utente = await richiedeUtente();
  const supabase = await createClient();

  const { mese: meseRichiesto } = await searchParams;
  const oggi = oggiLocale();
  const mese = meseDi(meseRichiesto ? `${meseRichiesto}-01` : oggi);

  const { data: legami } = await supabase
    .from("unita_proprietari")
    .select("unita_id")
    .eq("utente_id", utente.id);
  const mieUnita = [...new Set((legami ?? []).map((l) => l.unita_id as string))];

  const [
    { data: assembleeData },
    { data: manutenzioniData },
    { data: prenotazioniData },
    { data: ripartizioniData },
  ] = await Promise.all([
    supabase
      .from("assemblee")
      .select("id, data_assemblea, tipo, stato, condominio:condominio_id(nome)"),
    supabase
      .from("manutenzioni_programmate")
      .select("id, data_prossima, titolo, stato, condominio:condominio_id(nome)")
      .eq("stato", "programmata"),
    supabase
      .from("prenotazioni_spazi")
      .select(
        "id, inizio, fine, stato, utente_id, spazio:spazio_id(nome), unita:unita_id(identificativo)"
      )
      .eq("stato", "confermata"),
    mieUnita.length
      ? supabase
          .from("ripartizioni")
          .select(
            "id, data_scadenza, stato_pagamento, importo_dovuto, unita:unita_id(identificativo), spesa:spesa_id(descrizione)"
          )
          .in("unita_id", mieUnita)
          .neq("stato_pagamento", "pagato")
          .not("data_scadenza", "is", null)
      : Promise.resolve({ data: [] }),
  ]);

  const prenotazioni = (prenotazioniData ?? []) as unknown as PrenotazioneRiga[];

  const eventi = raccogliEventi({
    area: "condomino",
    oggi,
    assemblee: ((assembleeData ?? []) as unknown as AssembleaRiga[]).map((a) => ({
      id: a.id,
      dataOra: a.data_assemblea,
      tipo: a.tipo,
      stato: a.stato,
      condominio: a.condominio?.nome ?? null,
    })),
    manutenzioni: ((manutenzioniData ?? []) as unknown as ManutenzioneRiga[]).map((m) => ({
      id: m.id,
      dataProssima: m.data_prossima,
      titolo: m.titolo,
      stato: m.stato,
      condominio: m.condominio?.nome ?? null,
      fornitore: null,
    })),
    // Le fasce occupate sono informazione condominiale (servono a sapere
    // quando lo spazio è libero), ma il nome dell'unità si mostra solo per le
    // proprie: per le altre basta sapere che è occupato.
    prenotazioni: prenotazioni.map((p) => ({
      id: p.id,
      inizio: p.inizio,
      fine: p.fine,
      stato: p.stato,
      spazio: p.spazio?.nome ?? null,
      unita: p.utente_id === utente.id ? (p.unita?.identificativo ?? "la tua") : null,
    })),
    ripartizioni: ((ripartizioniData ?? []) as unknown as RipartizioneRiga[]).map((r) => ({
      id: r.id,
      dataScadenza: r.data_scadenza,
      statoPagamento: r.stato_pagamento,
      importo: r.importo_dovuto,
      descrizione: r.spesa?.descrizione ?? "Quota condominiale",
      unita: r.unita?.identificativo ?? null,
    })),
  });

  return (
    <PageBody>
      <PageHeader
        titolo="Calendario"
        descrizione="Assemblee, interventi programmati sullo stabile, prenotazioni degli spazi comuni e le tue scadenze di pagamento, tutti insieme."
      />

      {mieUnita.length === 0 && (
        <Alert tono="warning" titolo="Nessuna unità collegata">
          Il tuo account non è ancora associato a un&apos;unità immobiliare: le scadenze di
          pagamento non compaiono. Chiedi all&apos;amministratore di collegarti.
        </Alert>
      )}

      <VistaCalendario
        eventi={eventi}
        mese={mese}
        baseHref="/area-riservata/calendario"
        oggi={oggi}
      />
    </PageBody>
  );
}
