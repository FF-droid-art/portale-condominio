import { notFound } from "next/navigation";
import { ListChecks, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { richiedeUtente } from "@/lib/supabase/dal";
import type { PuntoOdg, SceltaVoto } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge, StatoBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDataOra, formatMillesimi } from "@/lib/format";
import { VotoForm } from "./voto-form";
import { CerchioVotiLive } from "@/components/ui/cerchio-voti";

export default async function AssembleaCondominoDettaglioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const utente = await richiedeUtente();
  const supabase = await createClient();

  const { data: assemblea } = await supabase
    .from("assemblee")
    .select(
      "id, data_assemblea, tipo, stato, condominio_id, link_videoconferenza, condominio:condominio_id(nome)"
    )
    .eq("id", id)
    .single();

  if (!assemblea) notFound();

  const [{ data: puntiOdgData }, { data: unitaProprietarieData }, { data: millesimiTotaliData }] =
    await Promise.all([
      supabase.from("punti_odg").select("*").eq("assemblea_id", id).order("numero_punto", { ascending: true }),
      supabase
        .from("unita_proprietari")
        .select("unita:unita_id(id, identificativo, condominio_id)")
        .eq("utente_id", utente.id),
      supabase.rpc("condominio_millesimi_totali", { p_condominio_id: assemblea.condominio_id }),
    ]);

  const millesimiTotali = millesimiTotaliData ?? 0;

  const puntiOdg = (puntiOdgData ?? []) as PuntoOdg[];
  const puntiIds = puntiOdg.map((p) => p.id);

  const unitaProprie = (unitaProprietarieData ?? [])
    .map((r) => r.unita as unknown as { id: string; identificativo: string; condominio_id: string } | null)
    .filter((u): u is { id: string; identificativo: string; condominio_id: string } =>
      Boolean(u && u.condominio_id === assemblea.condominio_id)
    );
  const unitaIds = unitaProprie.map((u) => u.id);

  let votiUtente: { punto_id: string; unita_id: string; scelta: SceltaVoto }[] = [];
  if (puntiIds.length && unitaIds.length) {
    const { data } = await supabase
      .from("voti")
      .select("punto_id, unita_id, scelta")
      .in("punto_id", puntiIds)
      .in("unita_id", unitaIds);
    votiUtente = data ?? [];
  }

  return (
    <div className="flex flex-col gap-8">
      <Card>
        <p className="text-sm text-muted-foreground">
          {(assemblea.condominio as unknown as { nome: string } | null)?.nome}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight capitalize">
            Assemblea {assemblea.tipo}
          </h1>
          <StatoBadge tipo="stato_assemblea" valore={assemblea.stato} />
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {formatDataOra(assemblea.data_assemblea)}
        </p>
        {assemblea.link_videoconferenza && (
          <Button
            href={assemblea.link_videoconferenza}
            target="_blank"
            rel="noopener noreferrer"
            size="sm"
            className="w-fit mt-3"
          >
            <Video className="size-4" />
            Partecipa online
          </Button>
        )}
      </Card>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Punti all&apos;ordine del giorno</h2>

        {!puntiOdg.length && (
          <EmptyState
            icon={ListChecks}
            title="Nessun punto all'ordine del giorno"
            description="L'amministratore non ha ancora pubblicato punti da votare."
          />
        )}

        {puntiOdg.map((punto) => {
          const votazioneAperta = punto.stato_votazione === "aperta";
          const votazioneConclusa = punto.stato_votazione === "chiusa" && punto.esito !== null;
          const nonAncoraAperta = punto.stato_votazione === "chiusa" && punto.esito === null;

          return (
            <Card key={punto.id} className="gap-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Punto {punto.numero_punto}</p>
                  <p className="font-medium">{punto.descrizione}</p>
                </div>
                {votazioneConclusa ? (
                  <StatoBadge tipo="esito" valore={punto.esito} />
                ) : (
                  <StatoBadge tipo="stato_votazione" valore={punto.stato_votazione} />
                )}
              </div>

              {(votazioneAperta || votazioneConclusa) && (
                <div className="flex flex-wrap items-center gap-4 rounded-xl bg-surface-muted/50 p-4">
                  <CerchioVotiLive
                    puntoId={punto.id}
                    millesimiTotali={millesimiTotali}
                    tallyIniziale={{
                      favorevole: votazioneConclusa
                        ? punto.esito_favorevole ?? 0
                        : punto.tally_favorevole,
                      contrario: votazioneConclusa
                        ? punto.esito_contrario ?? 0
                        : punto.tally_contrario,
                      astenuto: votazioneConclusa
                        ? punto.esito_astenuto ?? 0
                        : punto.tally_astenuto,
                    }}
                    size={104}
                  />

                  <div className="flex flex-1 min-w-[220px] flex-col gap-2">
                    {votazioneAperta && !unitaProprie.length && (
                      <p className="text-sm text-muted-foreground">
                        Nessuna unità di tua proprietà in questo condominio.
                      </p>
                    )}

                    {votazioneAperta &&
                      unitaProprie.map((u) => {
                        const votoEsistente = votiUtente.find(
                          (v) => v.punto_id === punto.id && v.unita_id === u.id
                        );
                        return (
                          <VotoForm
                            key={u.id}
                            puntoId={punto.id}
                            unitaId={u.id}
                            assembleaId={assemblea.id}
                            unitaLabel={u.identificativo}
                            votoAttuale={votoEsistente?.scelta}
                          />
                        );
                      })}

                    {votazioneConclusa && (
                      <Badge variant="accent" className="w-fit">
                        Quorum edificio {formatMillesimi(punto.esito_quorum_totale ?? 0)}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {nonAncoraAperta && (
                <p className="text-sm text-muted-foreground">
                  La votazione non è ancora stata aperta dall&apos;amministratore.
                </p>
              )}
            </Card>
          );
        })}
      </section>
    </div>
  );
}
