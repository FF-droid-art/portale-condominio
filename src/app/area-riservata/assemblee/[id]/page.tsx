import { notFound } from "next/navigation";
import { ListChecks, Users, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { richiedeUtente } from "@/lib/supabase/dal";
import type { PuntoOdg, SceltaVoto } from "@/lib/types";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardHeaderText, CardTitle, CardDescription, Section } from "@/components/ui/card";
import { Badge, StatoBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { formatDataOra, formatMillesimi } from "@/lib/format";
import { VotoForm } from "./voto-form";
import { DelegaForm } from "./delega-form";
import { RevocaDelegaButton } from "./revoca-delega-button";
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

  const [
    { data: puntiOdgData },
    { data: unitaProprietarieData },
    { data: millesimiTotaliData },
    { data: candidatiDelegaData },
    { data: delegheDate },
    { data: delegheRicevute },
  ] = await Promise.all([
    supabase.from("punti_odg").select("*").eq("assemblea_id", id).order("numero_punto", { ascending: true }),
    supabase
      .from("unita_proprietari")
      .select("diritto_voto, unita:unita_id(id, identificativo, condominio_id)")
      .eq("utente_id", utente.id),
    supabase.rpc("condominio_millesimi_totali", { p_condominio_id: assemblea.condominio_id }),
    supabase.rpc("candidati_delega", { p_condominio_id: assemblea.condominio_id }),
    supabase
      .from("deleghe")
      .select(
        "id, unita_delegante_id, unita:unita_delegante_id(identificativo), utente_delegato:utente_delegato_id(nome, cognome)"
      )
      .eq("assemblea_id", id),
    supabase
      .from("deleghe")
      .select("unita_delegante_id, unita:unita_delegante_id(id, identificativo, condominio_id)")
      .eq("assemblea_id", id)
      .eq("utente_delegato_id", utente.id),
  ]);

  const millesimiTotali = millesimiTotaliData ?? 0;

  const puntiOdg = (puntiOdgData ?? []) as PuntoOdg[];
  const puntiIds = puntiOdg.map((p) => p.id);

  type UnitaBase = { id: string; identificativo: string; condominio_id: string };

  const proprie = (unitaProprietarieData ?? []) as unknown as {
    diritto_voto: boolean;
    unita: UnitaBase | null;
  }[];
  const unitaProprie = proprie
    .map((r) => r.unita)
    .filter((u): u is UnitaBase => Boolean(u && u.condominio_id === assemblea.condominio_id));
  const unitaDelegabili = proprie
    .filter((r) => r.diritto_voto)
    .map((r) => r.unita)
    .filter((u): u is UnitaBase => Boolean(u && u.condominio_id === assemblea.condominio_id));

  const unitaDelegate = (delegheRicevute ?? [])
    .map((d) => d.unita as unknown as UnitaBase | null)
    .filter((u): u is UnitaBase => Boolean(u && u.condominio_id === assemblea.condominio_id));

  const unitaVotabili = [...unitaProprie, ...unitaDelegate];
  const unitaIds = unitaVotabili.map((u) => u.id);
  const propriIds = new Set(unitaProprie.map((u) => u.id));

  // "deleghe" espone anche le righe dove possiedo la sola unità
  // delegataria (RLS lo permette): qui interessano solo quelle date
  // da una MIA unità delegante.
  const mieDelegheDate = (delegheDate ?? []).filter((d) => propriIds.has(d.unita_delegante_id));
  const delegheGiaDate = new Set(mieDelegheDate.map((d) => d.unita_delegante_id));

  const candidatiDelega = (candidatiDelegaData ?? []) as {
    utente_id: string;
    nome: string;
    cognome: string;
    unita_id: string;
    identificativo: string;
  }[];

  let votiUtente: { punto_id: string; unita_id: string; scelta: SceltaVoto }[] = [];
  if (puntiIds.length && unitaIds.length) {
    const { data } = await supabase
      .from("voti")
      .select("punto_id, unita_id, scelta")
      .in("punto_id", puntiIds)
      .in("unita_id", unitaIds);
    votiUtente = data ?? [];
  }

  const nomeCondominio = (assemblea.condominio as unknown as { nome: string } | null)?.nome;
  const puntiDaVotare = puntiOdg.filter(
    (p) =>
      p.stato_votazione === "aperta" &&
      unitaVotabili.some((u) => !votiUtente.some((v) => v.punto_id === p.id && v.unita_id === u.id))
  ).length;

  return (
    <PageBody>
      <PageHeader
        indietro={{ href: "/area-riservata/assemblee", label: "Assemblee" }}
        eyebrow={nomeCondominio}
        titolo={<span className="capitalize">Assemblea {assemblea.tipo}</span>}
        descrizione={formatDataOra(assemblea.data_assemblea)}
        meta={<StatoBadge tipo="stato_assemblea" valore={assemblea.stato} />}
        azioni={
          assemblea.link_videoconferenza ? (
            <Button
              href={assemblea.link_videoconferenza}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Video className="size-4" aria-hidden="true" />
              Partecipa online
            </Button>
          ) : undefined
        }
      />

      {puntiDaVotare > 0 && (
        <Alert tono="info" titolo="C'è una votazione aperta">
          {puntiDaVotare === 1
            ? "Un punto all'ordine del giorno è in votazione e non hai ancora espresso il tuo voto."
            : `${puntiDaVotare} punti all'ordine del giorno sono in votazione e non hai ancora espresso il tuo voto.`}
        </Alert>
      )}

      {unitaProprie.length > 0 && (
        <Card>
          <CardHeader>
            <CardHeaderText>
              <CardTitle>Deleghe</CardTitle>
              <CardDescription>
                Non puoi partecipare all&apos;assemblea? Delega il voto della tua unità a un altro
                condòmino con diritto di voto: potrai revocare la delega finché l&apos;assemblea
                non è conclusa.
              </CardDescription>
            </CardHeaderText>
          </CardHeader>

          <div className="flex flex-col gap-5">
            {mieDelegheDate.length > 0 && (
              <ul className="flex flex-col gap-2">
                {mieDelegheDate.map((d) => {
                  const delegato = d.utente_delegato as unknown as {
                    nome: string;
                    cognome: string;
                  } | null;
                  const unitaDelegante = d.unita as unknown as { identificativo: string } | null;
                  return (
                    <li
                      key={d.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-muted/50 px-4 py-3 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span>
                          <strong className="font-semibold">
                            {unitaDelegante?.identificativo}
                          </strong>{" "}
                          delegata a {delegato?.nome} {delegato?.cognome}
                        </span>
                      </span>
                      <RevocaDelegaButton
                        delegaId={d.id}
                        assembleaId={assemblea.id}
                        unitaLabel={unitaDelegante?.identificativo}
                      />
                    </li>
                  );
                })}
              </ul>
            )}

            {unitaDelegate.length > 0 && (
              <Alert tono="info">
                Voti anche per delega di:{" "}
                <strong>{unitaDelegate.map((u) => u.identificativo).join(", ")}</strong>
              </Alert>
            )}

            <DelegaForm
              assembleaId={assemblea.id}
              unitaDelegabili={unitaDelegabili.filter((u) => !delegheGiaDate.has(u.id))}
              candidati={candidatiDelega.map((c) => ({
                utenteId: c.utente_id,
                nome: c.nome,
                cognome: c.cognome,
                unitaId: c.unita_id,
                identificativo: c.identificativo,
              }))}
            />
          </div>
        </Card>
      )}

      <Section
        titolo="Punti all'ordine del giorno"
        descrizione={
          puntiOdg.length
            ? "I risultati si aggiornano da soli mentre gli altri condòmini votano."
            : undefined
        }
      >
        {!puntiOdg.length && (
          <EmptyState
            icon={ListChecks}
            title="Nessun punto all'ordine del giorno"
            description="L'amministratore non ha ancora pubblicato i punti da votare per questa assemblea."
          />
        )}

        <div className="flex flex-col gap-4">
          {puntiOdg.map((punto) => {
            const votazioneAperta = punto.stato_votazione === "aperta";
            const votazioneConclusa = punto.stato_votazione === "chiusa" && punto.esito !== null;
            const nonAncoraAperta = punto.stato_votazione === "chiusa" && punto.esito === null;

            return (
              <Card key={punto.id}>
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Punto {punto.numero_punto}
                    </span>
                    <h3 className="text-base font-semibold leading-snug text-pretty">
                      {punto.descrizione}
                    </h3>
                  </div>
                  {votazioneConclusa ? (
                    <StatoBadge tipo="esito" valore={punto.esito} />
                  ) : (
                    <StatoBadge tipo="stato_votazione" valore={punto.stato_votazione} />
                  )}
                </div>

                {(votazioneAperta || votazioneConclusa) && (
                  <div className="mt-4 flex flex-col gap-5 rounded-xl border border-border bg-surface-muted/40 p-4 sm:flex-row sm:items-start sm:gap-6">
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

                    <div className="flex min-w-0 flex-1 flex-col gap-4">
                      {votazioneAperta && !unitaVotabili.length && (
                        <p className="text-sm text-muted-foreground">
                          Non possiedi (né rappresenti per delega) unità in questo condominio,
                          quindi non puoi votare questo punto.
                        </p>
                      )}

                      {votazioneAperta &&
                        unitaVotabili.map((u) => {
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
                              perDelega={!propriIds.has(u.id)}
                              votoAttuale={votoEsistente?.scelta}
                            />
                          );
                        })}

                      {votazioneConclusa && (
                        <div className="flex flex-col gap-1.5">
                          <span className="text-sm text-muted-foreground">
                            Quorum dell&apos;edificio
                          </span>
                          <Badge variant="accent" className="w-fit">
                            <span className="cifre">
                              {formatMillesimi(punto.esito_quorum_totale ?? 0)}
                            </span>{" "}
                            millesimi
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {nonAncoraAperta && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    La votazione non è ancora stata aperta dall&apos;amministratore.
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      </Section>
    </PageBody>
  );
}
