import Link from "next/link";
import { notFound } from "next/navigation";
import { ListChecks } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { PuntoOdg, StatoAssemblea } from "@/lib/types";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
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

  const [{ data: unitaCondominio }, { data: puntiOdgData }, { data: delegheData }] = await Promise.all([
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

  const prossimoNumero = puntiOdg.length
    ? Math.max(...puntiOdg.map((p) => p.numero_punto)) + 1
    : 1;

  return (
    <div className="flex flex-col gap-8">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={`/admin/condomini/${assemblea.condominio_id}`} className="hover:text-accent">
                {(assemblea.condominio as unknown as { nome: string } | null)?.nome}
              </Link>
            </p>
            <h1 className="text-3xl font-bold tracking-tight">
              Assemblea {assemblea.tipo}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {formatDataOra(assemblea.data_assemblea)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatoBadge tipo="stato_assemblea" valore={assemblea.stato} />
            <StatoAssembleaControls
              assembleaId={assemblea.id}
              stato={assemblea.stato as StatoAssemblea}
            />
          </div>
        </div>
      </Card>

      <Card>
        <LinkVideoconferenza
          assembleaId={assemblea.id}
          link={assemblea.link_videoconferenza}
        />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Verbale</CardTitle>
        </CardHeader>
        <VerbaleUpload
          assembleaId={assemblea.id}
          verbaleUrl={assemblea.verbale_url}
          signedUrl={verbaleSignedUrl}
        />
      </Card>

      <Card className="gap-1">
        <p className="text-sm text-muted-foreground">Partecipazione (unità che hanno votato almeno un punto)</p>
        <p className="text-2xl font-semibold">
          {formatMillesimi(millesimiPartecipanti)} / {formatMillesimi(millesimiTotali)} millesimi
        </p>
      </Card>

      {delegheData && delegheData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Deleghe</CardTitle>
          </CardHeader>
          <ul className="flex flex-col gap-2 text-sm">
            {delegheData.map((d) => {
              const delegante = d.unita_delegante as unknown as {
                identificativo: string;
                millesimi_proprieta: number;
              } | null;
              const delegato = d.utente_delegato as unknown as { nome: string; cognome: string } | null;
              return (
                <li key={d.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface-muted/50 p-3">
                  <span>
                    <strong>{delegante?.identificativo}</strong> ({formatMillesimi(delegante?.millesimi_proprieta ?? 0)}{" "}
                    millesimi) → {delegato?.nome} {delegato?.cognome}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-medium">Punti all&apos;ordine del giorno</h2>
          <p className="text-xs text-muted-foreground">
            L&apos;esito è calcolato a maggioranza semplice tra i voti espressi: non è un
            calcolo legale rigoroso di tutte le maggioranze qualificate previste dal codice civile.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <div className="w-full lg:w-80 shrink-0 lg:sticky lg:top-24">
            <Card>
              <CardHeader>
                <CardTitle>Aggiungi punto</CardTitle>
              </CardHeader>
              <PuntoOdgForm assembleaId={assemblea.id} prossimoNumero={prossimoNumero} />
            </Card>
          </div>

          <div className="flex-1 min-w-0 flex flex-col gap-3">
            {puntiOdg.map((punto) => (
              <PuntoOdgCard
                key={punto.id}
                punto={punto}
                assembleaId={assemblea.id}
                condominioId={assemblea.condominio_id}
                millesimiTotali={millesimiTotali}
              />
            ))}
            {!puntiOdg.length && (
              <EmptyState
                icon={ListChecks}
                title="Nessun punto all'ordine del giorno"
                description="Aggiungi il primo punto dal modulo a sinistra."
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
