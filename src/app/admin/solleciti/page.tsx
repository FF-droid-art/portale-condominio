import Link from "next/link";
import { AlarmClock, HandCoins, Home, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { richiedeAmministratore } from "@/lib/supabase/dal";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/card";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { StatoBadge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  RowIcon,
  Vuoto,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { formatData, formatValuta } from "@/lib/format";
import { oggiLocale } from "@/lib/fuso";
import { SOGLIE_LIVELLO, posizioniPerUnita, type LivelloSollecito } from "@/lib/solleciti";
import { GeneraSollecitoButton } from "./genera-sollecito-button";

export const metadata = { title: "Morosità e solleciti" };

type UnitaRiga = {
  id: string;
  identificativo: string;
  condominio_id: string;
  condominio: { nome: string } | null;
  unita_proprietari: { utente_id: string | null }[] | null;
};

type RipartizioneRiga = {
  unita_id: string;
  importo_dovuto: number;
  stato_pagamento: string;
  data_scadenza: string | null;
  data_pagamento: string | null;
};

type SollecitoRiga = {
  unita_id: string;
  livello: LivelloSollecito;
  data_invio: string;
};

/** Quanto tempo è passato dalla scadenza, in parole. */
function testoRitardo(giorni: number): string {
  if (giorni <= 0) return "senza data";
  if (giorni === 1) return "1 giorno";
  if (giorni < 60) return `${giorni} giorni`;
  const mesi = Math.floor(giorni / 30);
  return `circa ${mesi} mesi`;
}

export default async function SollecitiPage() {
  await richiedeAmministratore();
  const supabase = await createClient();

  // Le unità arrivano già filtrate dalla RLS ai soli condomìni gestiti; le
  // ripartizioni si prendono per unità, che è la strada che la RLS conosce.
  const { data: unitaData } = await supabase
    .from("unita")
    .select("id, identificativo, condominio_id, condominio:condominio_id(nome), unita_proprietari(utente_id)")
    .order("identificativo");

  const unita = (unitaData ?? []) as unknown as UnitaRiga[];
  const unitaIds = unita.map((u) => u.id);

  const [{ data: ripartizioniData }, { data: sollecitiData }] = await Promise.all([
    unitaIds.length
      ? supabase
          .from("ripartizioni")
          .select("unita_id, importo_dovuto, stato_pagamento, data_scadenza, data_pagamento")
          .in("unita_id", unitaIds)
          .neq("stato_pagamento", "pagato")
      : Promise.resolve({ data: [] }),
    supabase
      .from("solleciti")
      .select("unita_id, livello, data_invio")
      .order("data_invio", { ascending: false }),
  ]);

  const oggi = oggiLocale();
  const posizioni = posizioniPerUnita(
    (ripartizioniData ?? []) as unknown as RipartizioneRiga[],
    oggi
  );

  const perId = new Map(unita.map((u) => [u.id, u]));

  // Solo l'ultimo sollecito per unità: la cronologia completa è nella riga
  // della singola unità, qui interessa "a che punto siamo".
  const ultimoSollecito = new Map<string, SollecitoRiga>();
  for (const s of ((sollecitiData ?? []) as unknown as SollecitoRiga[])) {
    if (!ultimoSollecito.has(s.unita_id)) ultimoSollecito.set(s.unita_id, s);
  }

  const righe = posizioni
    .map((p) => ({ ...p, unita: perId.get(p.unitaId) }))
    .filter((r): r is typeof r & { unita: UnitaRiga } => Boolean(r.unita));

  const totaleScaduto = righe.reduce((s, r) => s + r.posizione.totaleScaduto, 0);
  const daDiffidare = righe.filter((r) => r.posizione.livello === 3).length;
  const senzaSollecito = righe.filter((r) => !ultimoSollecito.has(r.unitaId)).length;

  return (
    <PageBody>
      <PageHeader
        titolo="Morosità e solleciti"
        descrizione={`Le unità con quote scadute e non versate, con il tono di sollecito che il ritardo suggerisce: promemoria dal giorno dopo la scadenza, sollecito formale dopo ${SOGLIE_LIVELLO[2]} giorni, diffida dopo ${SOGLIE_LIVELLO[3]}.`}
      />

      <StatGrid colonne={3}>
        <StatCard
          label="Unità in ritardo"
          value={righe.length}
          icon={Home}
          tono={righe.length > 0 ? "warning" : "success"}
          hint={righe.length === 1 ? "posizione aperta" : "posizioni aperte"}
        />
        <StatCard
          label="Totale scaduto"
          value={formatValuta(totaleScaduto)}
          icon={HandCoins}
          tono={totaleScaduto > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Da diffidare"
          value={daDiffidare}
          icon={AlarmClock}
          tono={daDiffidare > 0 ? "danger" : "success"}
          hint={`oltre ${SOGLIE_LIVELLO[3]} giorni di ritardo`}
        />
      </StatGrid>

      <Section
        titolo="Posizioni aperte"
        descrizione={
          senzaSollecito > 0
            ? `${senzaSollecito} ${
                senzaSollecito === 1 ? "unità non ha" : "unità non hanno"
              } ancora ricevuto alcun sollecito.`
            : "Ogni unità in ritardo ha già ricevuto almeno un sollecito."
        }
      >
        {righe.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unità</TableHead>
                <TableHead>Condominio</TableHead>
                <TableHead numeric>Scaduto</TableHead>
                <TableHead numeric>Rate</TableHead>
                <TableHead>Ritardo</TableHead>
                <TableHead>Ultimo sollecito</TableHead>
                <TableHead>
                  <span className="sr-only">Azioni</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {righe.map((r) => {
                const ultimo = ultimoSollecito.get(r.unitaId);
                const conAccount = new Set(
                  (r.unita.unita_proprietari ?? [])
                    .map((p) => p.utente_id)
                    .filter((id): id is string => !!id)
                ).size;

                return (
                  <TableRow key={r.unitaId}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/admin/unita/${r.unitaId}`}
                        className="rounded transition-colors hover:text-accent-ink"
                      >
                        <RowIcon icon={Home}>{r.unita.identificativo}</RowIcon>
                      </Link>
                    </TableCell>
                    <TableCell etichetta="Condominio">
                      {r.unita.condominio?.nome ?? <Vuoto />}
                    </TableCell>
                    <TableCell etichetta="Scaduto" numeric className="font-medium">
                      {formatValuta(r.posizione.totaleScaduto)}
                    </TableCell>
                    <TableCell etichetta="Rate" numeric>
                      {r.posizione.rateScadute}
                    </TableCell>
                    <TableCell etichetta="Ritardo">
                      <span className="flex flex-col">
                        <span>{testoRitardo(r.posizione.giorniRitardoMax)}</span>
                        <span className="text-xs text-muted-foreground">
                          <StatoBadge
                            tipo="livello_sollecito"
                            valore={r.posizione.livello ? String(r.posizione.livello) : null}
                          />
                        </span>
                      </span>
                    </TableCell>
                    <TableCell etichetta="Ultimo sollecito">
                      {ultimo ? (
                        <span className="flex flex-col">
                          <span className="cifre">{formatData(ultimo.data_invio)}</span>
                          <span className="text-xs text-muted-foreground">
                            livello {ultimo.livello}
                          </span>
                        </span>
                      ) : (
                        <Vuoto />
                      )}
                    </TableCell>
                    <TableCell className="md:text-right">
                      <GeneraSollecitoButton
                        unitaId={r.unitaId}
                        identificativo={r.unita.identificativo}
                        livelloSuggerito={r.posizione.livello ?? 1}
                        destinatariConAccount={conAccount}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={ShieldCheck}
            title="Nessuna unità in ritardo"
            description="Tutte le quote con una scadenza già passata risultano versate. Quando qualcuna resterà indietro, la troverai qui con la lettera già pronta."
          />
        )}
      </Section>

      <p className="text-xs leading-relaxed text-muted-foreground">
        La lettera generata dal portale è una comunicazione dell&apos;amministratore, non un atto
        con valore legale: va riletta e sottoscritta prima dell&apos;invio. Per il recupero
        coattivo delle somme serve un legale.
      </p>
    </PageBody>
  );
}
