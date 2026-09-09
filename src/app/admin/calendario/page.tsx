import { createClient } from "@/lib/supabase/server";
import { richiedeAmministratore } from "@/lib/supabase/dal";
import { PageBody, PageHeader } from "@/components/ui/page-header";
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
  fornitore: { nome: string } | null;
};

type PrenotazioneRiga = {
  id: string;
  inizio: string;
  fine: string;
  stato: string;
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
 * Calendario dell'amministratore: tutto quello che le sue policy gli lasciano
 * vedere, cioè i condomìni che gestisce. Non c'è un filtro per condominio
 * perché il sottotitolo di ogni evento porta già il nome dello stabile, e chi
 * amministra tre palazzi vuole vedere la settimana intera, non un palazzo per
 * volta.
 */
export default async function CalendarioAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ mese?: string }>;
}) {
  await richiedeAmministratore();
  const supabase = await createClient();

  const { mese: meseRichiesto } = await searchParams;
  const oggi = oggiLocale();
  const mese = meseDi(meseRichiesto ? `${meseRichiesto}-01` : oggi);

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
      .select(
        "id, data_prossima, titolo, stato, condominio:condominio_id(nome), fornitore:fornitore_id(nome)"
      )
      .eq("stato", "programmata"),
    supabase
      .from("prenotazioni_spazi")
      .select(
        "id, inizio, fine, stato, spazio:spazio_id(nome), unita:unita_id(identificativo)"
      )
      .eq("stato", "confermata"),
    supabase
      .from("ripartizioni")
      .select(
        "id, data_scadenza, stato_pagamento, importo_dovuto, unita:unita_id(identificativo), spesa:spesa_id(descrizione)"
      )
      .neq("stato_pagamento", "pagato")
      .not("data_scadenza", "is", null),
  ]);

  const eventi = raccogliEventi({
    area: "admin",
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
      fornitore: m.fornitore?.nome ?? null,
    })),
    prenotazioni: ((prenotazioniData ?? []) as unknown as PrenotazioneRiga[]).map((p) => ({
      id: p.id,
      inizio: p.inizio,
      fine: p.fine,
      stato: p.stato,
      spazio: p.spazio?.nome ?? null,
      unita: p.unita?.identificativo ?? null,
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
        descrizione="Tutto ciò che ha una data nei condomìni che gestisci, in un posto solo. È una vista di consultazione: per creare o modificare qualcosa si passa dalla sua sezione."
      />

      <VistaCalendario
        eventi={eventi}
        mese={mese}
        baseHref="/admin/calendario"
        oggi={oggi}
      />
    </PageBody>
  );
}
