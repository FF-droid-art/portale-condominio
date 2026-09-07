import Link from "next/link";
import { notFound } from "next/navigation";
import { ListChecks, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { PuntoOdg, StatoAssemblea } from "@/lib/types";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import {
  Card,
  CardHeader,
  CardHeaderText,
  CardTitle,
  CardDescription,
  Section,
} from "@/components/ui/card";
import { StatoBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDataOra, formatMillesimi } from "@/lib/format";
import { StatoAssembleaControls } from "./stato-assemblea";
import { PuntoOdgCard } from "./punto-card";
import { PuntoOdgForm } from "./punto-form";
import { LinkVideoconferenza } from "./link-videoconferenza";
import { VerbaleUpload } from "./verbale-upload";

export default async function AssembleaDettaglioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: assemblea } = await supabase
    .from("assemblee")
    .select(
      "id, data_assemblea, tipo, stato, condominio_id, link_videoconferenza, verbale_url, condominio:condominio_id(nome)"
    )
    .eq("id", id)
    .single();

  if (!assemblea) notFound();

  let verbaleSignedUrl: string | null = null;
  if (assemblea.verbale_url) {
    const { data } = await supabase.storage
      .from("documenti-condominio")
      .createSignedUrl(assemblea.verbale_url, 600);
    verbaleSignedUrl = data?.signedUrl ?? null;
  }

  const [{ data: unitaCondominio }, { data: puntiOdgData }, { data: delegheData }] =
    await Promise.all([
      supabase
        .from("unita")
        .select("id, millesimi_proprieta")
        .eq("condominio_id", assemblea.condominio_id),
      supabase
        .from("punti_odg")
        .select("*")
        .eq("assemblea_id", id)
        .order("numero_punto", { ascending: true }),
      supabase
        .from("deleghe")
        .select(
          "id, unita_delegante:unita_delegante_id(identificativo, millesimi_proprieta), utente_delegato:utente_delegato_id(nome, cognome)"
        )
        .eq("assemblea_id", id),
    ]);

  const puntiOdg = (puntiOdgData ?? []) as PuntoOdg[];
  const puntiIds = puntiOdg.map((p) => p.id);

  let voti: { unita_id: string }[] = [];
  if (puntiIds.length) {
    const { data } = await supabase.from("voti").select("unita_id").in("punto_id", puntiIds);
    voti = data ?? [];
  }

  const millesimiTotali = (unitaCondominio ?? []).reduce(
    (somma, u) => somma + u.millesimi_proprieta,
    0
  );
  const unitaMap = new Map((unitaCondominio ?? []).map((u) => [u.id, u.millesimi_proprieta]));
  const unitaPartecipanti = new Set(voti.map((v) => v.unita_id));
  const millesimiPartecipanti = Array.from(unitaPartecipanti).reduce(
    (somma, unitaId) => somma + (unitaMap.get(unitaId) ?? 0),
    0
  );
  const percentualePartecipazione =
    millesimiTotali > 0 ? Math.round((millesimiPartecipanti / millesimiTotali) * 100) : 0;

  const prossimoNumero = puntiOdg.length
    ? Math.max(...puntiOdg.map((p) => p.numero_punto)) + 1
    : 1;

  const nomeCondominio = (assemblea.condominio as unknown as { nome: string } | null)?.nome;

  return (
    <PageBody>
      <PageHeader
        indietro={{ href: "/admin/assemblee", label: "Assemblee" }}
        eyebrow={
          <Link
            href={`/admin/condomini/${assemblea.condominio_id}`}
            className="rounded hover:text-accent-ink"
          >
            {nomeCondominio}
          </Link>
        }
        titolo={<span className="capitalize">Assemblea {assemblea.tipo}</span>}
        descrizione={formatDataOra(assemblea.data_assemblea)}
        meta={<StatoBadge tipo="stato_assemblea" valore={assemblea.stato} />}
        azioni={
          <StatoAssembleaControls
            assembleaId={assemblea.id}
            stato={assemblea.stato as StatoAssemblea}
          />
        }
      />

      {/* Partecipazione: una barra invece di due soli numeri, perché la
          domanda vera è "quanto siamo lontani dal totale dell'edificio". */}
      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Partecipazione al voto</span>
              <span className="text-xs text-muted-foreground">
                Unità che hanno votato almeno un punto all&apos;ordine del giorno
              </span>
            </div>
            <span className="cifre text-lg font-semibold tracking-tight">
              {formatMillesimi(millesimiPartecipanti)}
              <span className="text-sm font-normal text-muted-foreground">
                {" / "}
                {formatMillesimi(millesimiTotali)} millesimi
              </span>
            </span>
          </div>

          <div
            className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"
            role="progressbar"
            aria-valuenow={percentualePartecipazione}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Millesimi rappresentati sul totale dell'edificio"
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-500"
              style={{ width: `${Math.min(percentualePartecipazione, 100)}%` }}
            />
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <Section
            titolo="Punti all'ordine del giorno"
            descrizione="L'esito è calcolato a maggioranza semplice tra i voti espressi: non è un calcolo legale rigoroso di tutte le maggioranze qualificate previste dal codice civile."
            azioni={<PuntoOdgForm assembleaId={assemblea.id} prossimoNumero={prossimoNumero} />}
          >
            {puntiOdg.length ? (
              <div className="flex flex-col gap-4">
                {puntiOdg.map((punto) => (
                  <PuntoOdgCard
                    key={punto.id}
                    punto={punto}
                    assembleaId={assemblea.id}
                    condominioId={assemblea.condominio_id}
                    millesimiTotali={millesimiTotali}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={ListChecks}
                title="Nessun punto all'ordine del giorno"
                description="Aggiungi i punti da mettere ai voti: i condòmini li vedranno subito, ma potranno votarli solo dopo che avrai aperto la votazione."
                action={<PuntoOdgForm assembleaId={assemblea.id} prossimoNumero={prossimoNumero} />}
              />
            )}
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardHeaderText>
                <CardTitle>Videoconferenza</CardTitle>
              </CardHeaderText>
            </CardHeader>
            <LinkVideoconferenza
              assembleaId={assemblea.id}
              link={assemblea.link_videoconferenza}
            />
          </Card>

          <Card>
            <CardHeader>
              <CardHeaderText>
                <CardTitle>Verbale</CardTitle>
                <CardDescription>
                  Una volta caricato resta disponibile per la consultazione.
                </CardDescription>
              </CardHeaderText>
            </CardHeader>
            <VerbaleUpload
              assembleaId={assemblea.id}
              verbaleUrl={assemblea.verbale_url}
              signedUrl={verbaleSignedUrl}
            />
          </Card>

          {delegheData && delegheData.length > 0 && (
            <Card>
              <CardHeader>
                <CardHeaderText>
                  <CardTitle>Deleghe</CardTitle>
                  <CardDescription>
                    {delegheData.length === 1
                      ? "Una unità ha delegato il proprio voto."
                      : `${delegheData.length} unità hanno delegato il proprio voto.`}
                  </CardDescription>
                </CardHeaderText>
              </CardHeader>

              <ul className="flex flex-col divide-y divide-border text-sm">
                {delegheData.map((d) => {
                  const delegante = d.unita_delegante as unknown as {
                    identificativo: string;
                    millesimi_proprieta: number;
                  } | null;
                  const delegato = d.utente_delegato as unknown as {
                    nome: string;
                    cognome: string;
                  } | null;
                  return (
                    <li key={d.id} className="flex items-start gap-2.5 py-3 first:pt-0 last:pb-0">
                      <Users
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="font-medium">
                          {delegante?.identificativo} → {delegato?.nome} {delegato?.cognome}
                        </span>
                        <span className="cifre text-xs text-muted-foreground">
                          {formatMillesimi(delegante?.millesimi_proprieta ?? 0)} millesimi
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </PageBody>
  );
}
