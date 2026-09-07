import { CalendarClock, Home, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { richiedeUtente } from "@/lib/supabase/dal";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/card";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatData, formatMillesimi, formatValuta } from "@/lib/format";
import { ElencoRipartizioni, type RipartizioneCondomino } from "./elenco-ripartizioni";

export const metadata = { title: "Riepilogo" };

type UnitaPosseduta = {
  quota_possesso: number;
  unita: {
    id: string;
    identificativo: string;
    piano: string | null;
    millesimi_proprieta: number;
    condominio: { nome: string } | null;
  } | null;
};

export default async function AreaRiservataPage() {
  const utente = await richiedeUtente();
  const supabase = await createClient();

  const { data } = await supabase
    .from("unita_proprietari")
    .select(
      "quota_possesso, unita:unita_id(id, identificativo, piano, millesimi_proprieta, condominio:condominio_id(nome))"
    )
    .eq("utente_id", utente.id);
  const unitaPossedute = (data ?? []) as unknown as UnitaPosseduta[];

  const unitaIds = unitaPossedute
    .map((r) => r.unita?.id)
    .filter((id): id is string => Boolean(id));

  let ripartizioni: RipartizioneCondomino[] = [];
  if (unitaIds.length) {
    const { data: dataRipartizioni } = await supabase
      .from("ripartizioni")
      .select(
        "id, importo_dovuto, stato_pagamento, data_scadenza, codice_avviso, spesa:spesa_id(descrizione, categoria)"
      )
      .in("unita_id", unitaIds)
      .order("data_scadenza", { ascending: true });
    ripartizioni = (dataRipartizioni ?? []) as unknown as RipartizioneCondomino[];
  }

  // Sintesi ricavata dai dati già caricati sopra: nessuna query in più.
  const daPagare = ripartizioni.filter((r) => r.stato_pagamento !== "pagato");
  const totaleDaPagare = daPagare.reduce((somma, r) => somma + r.importo_dovuto, 0);
  const prossimaScadenza = daPagare
    .map((r) => r.data_scadenza)
    .filter((d): d is string => Boolean(d))
    .sort()[0];
  const inRitardo = ripartizioni.filter((r) => r.stato_pagamento === "in_ritardo").length;

  return (
    <PageBody>
      <PageHeader
        titolo={`Ciao, ${utente.nome}`}
        descrizione="Qui trovi le tue unità immobiliari, le quote a tuo carico e le assemblee del tuo condominio."
      />

      <StatGrid>
        <StatCard
          label="Le tue unità"
          value={unitaPossedute.length}
          icon={Home}
          hint={unitaPossedute.length === 1 ? "unità collegata" : "unità collegate"}
        />
        <StatCard
          label="Totale da pagare"
          value={formatValuta(totaleDaPagare)}
          icon={Wallet}
          tono={totaleDaPagare > 0 ? "warning" : "success"}
          hint={
            daPagare.length
              ? `${daPagare.length} ${daPagare.length === 1 ? "quota aperta" : "quote aperte"}`
              : "Sei in regola"
          }
        />
        <StatCard
          label="Prossima scadenza"
          value={prossimaScadenza ? formatData(prossimaScadenza) : "—"}
          icon={CalendarClock}
          hint={prossimaScadenza ? "prima quota in scadenza" : "nessuna scadenza aperta"}
        />
        <StatCard
          label="Quote in ritardo"
          value={inRitardo}
          icon={Wallet}
          tono={inRitardo > 0 ? "danger" : "neutral"}
          hint={inRitardo > 0 ? "da saldare al più presto" : "nessun ritardo"}
        />
      </StatGrid>

      <Section
        titolo="Le tue unità"
        descrizione="Le unità immobiliari collegate al tuo account, con i millesimi su cui vengono calcolate le tue quote."
      >
        {!unitaPossedute.length ? (
          <EmptyState
            icon={Home}
            title="Nessuna unità collegata"
            description="Il tuo account non è ancora associato a un'unità immobiliare. Chiedi all'amministratore del tuo condominio di collegarti."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {unitaPossedute.map((riga, i) => {
              const u = riga.unita;
              return (
                <div
                  key={u?.id ?? i}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 shadow-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-semibold tracking-tight">
                        {u?.identificativo ?? "—"}
                      </span>
                      <span className="truncate text-sm text-muted-foreground">
                        {u?.condominio?.nome ?? "—"}
                      </span>
                    </div>
                    <span
                      className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-muted text-muted-foreground"
                      aria-hidden="true"
                    >
                      <Home className="size-4" />
                    </span>
                  </div>

                  <dl className="flex flex-col gap-1.5 text-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-muted-foreground">Piano</dt>
                      <dd className="font-medium">{u?.piano ?? "—"}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-muted-foreground">Millesimi</dt>
                      <dd className="cifre font-medium">
                        {u ? formatMillesimi(u.millesimi_proprieta) : "—"}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-muted-foreground">La tua quota</dt>
                      <dd>
                        <Badge variant={riga.quota_possesso === 100 ? "neutral" : "accent"}>
                          {riga.quota_possesso}%
                        </Badge>
                      </dd>
                    </div>
                  </dl>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section
        titolo="Spese e ripartizioni"
        descrizione="Le quote a tuo carico, con importo, scadenza e stato del pagamento."
      >
        <ElencoRipartizioni ripartizioni={ripartizioni} />
      </Section>
    </PageBody>
  );
}
