import { notFound } from "next/navigation";
import { Home } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { richiedeUtente } from "@/lib/supabase/dal";
import type { Sondaggio, SondaggioOpzione } from "@/lib/types";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardHeaderText, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDataOra } from "@/lib/format";
import { aggregaRisultati, motivoChiusura, type ConteggioOpzione } from "@/lib/sondaggi";
import { RisultatiSondaggio } from "@/components/risultati-sondaggio";
import { RispostaForm, type UnitaRispondente } from "./risposta-form";

export default async function SondaggioCondominoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const utente = await richiedeUtente();
  const supabase = await createClient();

  const { data: sondaggioData } = await supabase
    .from("sondaggi")
    .select("*, condominio:condominio_id(nome)")
    .eq("id", id)
    .single();

  if (!sondaggioData) notFound();

  const sondaggio = sondaggioData as unknown as Sondaggio & {
    condominio: { nome: string } | null;
  };

  const [
    { data: opzioniData },
    { data: conteggiData },
    { data: unitaProprietarieData },
    { data: mieRisposte },
    { data: millesimiTotaliData },
    { data: unitaTotaliData },
  ] = await Promise.all([
    supabase
      .from("sondaggio_opzioni")
      .select("id, sondaggio_id, testo, ordine")
      .eq("sondaggio_id", id)
      .order("ordine"),
    supabase.rpc("sondaggio_risultati", { p_sondaggio_id: id }),
    supabase
      .from("unita_proprietari")
      .select("unita:unita_id(id, identificativo, millesimi_proprieta, condominio_id)")
      .eq("utente_id", utente.id),
    supabase
      .from("sondaggio_risposte")
      .select("unita_id, opzione_id")
      .eq("sondaggio_id", id)
      .eq("utente_id", utente.id),
    supabase.rpc("condominio_millesimi_totali", { p_condominio_id: sondaggio.condominio_id }),
    supabase.rpc("condominio_conteggio_unita", { p_condominio_id: sondaggio.condominio_id }),
  ]);

  const opzioni = (opzioniData ?? []) as SondaggioOpzione[];
  const conteggi = (conteggiData ?? []) as ConteggioOpzione[];

  type UnitaBase = {
    id: string;
    identificativo: string;
    millesimi_proprieta: number;
    condominio_id: string;
  };

  const scelte = new Map((mieRisposte ?? []).map((r) => [r.unita_id, r.opzione_id]));

  const unitaRispondenti: UnitaRispondente[] = ((unitaProprietarieData ?? []) as unknown as {
    unita: UnitaBase | null;
  }[])
    .map((r) => r.unita)
    .filter((u): u is UnitaBase => Boolean(u && u.condominio_id === sondaggio.condominio_id))
    .map((u) => ({
      id: u.id,
      identificativo: u.identificativo,
      millesimi: u.millesimi_proprieta,
      opzioneScelta: scelte.get(u.id) ?? null,
    }));

  const risultati = aggregaRisultati({
    opzioni,
    conteggi,
    unitaTotali: unitaTotaliData ?? 0,
    millesimiTotali: millesimiTotaliData ?? 0,
    ponderato: sondaggio.ponderato,
  });

  const chiusura = motivoChiusura(sondaggio);
  const aperto = chiusura === null;
  // Chi non ha ancora risposto non vede i risultati: leggerli prima
  // orienterebbe la risposta e falserebbe la consultazione.
  const haRisposto = unitaRispondenti.some((u) => u.opzioneScelta);
  const mostraRisultati = !aperto || haRisposto;

  return (
    <PageBody>
      <PageHeader
        indietro={{ href: "/area-riservata/sondaggi", label: "Sondaggi" }}
        eyebrow={sondaggio.condominio?.nome}
        titolo={sondaggio.domanda}
        descrizione={sondaggio.descrizione ?? undefined}
        meta={
          <>
            {aperto ? (
              <Badge variant="success" punto>
                Aperto
              </Badge>
            ) : (
              <Badge variant="neutral" punto>
                {chiusura === "scaduto" ? "Scaduto" : "Chiuso"}
              </Badge>
            )}
            {sondaggio.scadenza && (
              <span className="text-sm text-muted-foreground">
                {aperto ? "Scade il" : "Scaduto il"} {formatDataOra(sondaggio.scadenza)}
              </span>
            )}
          </>
        }
      />

      <Alert tono="info">
        È una consultazione informale: non è una votazione assembleare e non delibera nulla.
      </Alert>

      {!unitaRispondenti.length ? (
        <EmptyState
          icon={Home}
          title="Non puoi rispondere a questo sondaggio"
          description="Il tuo account non è collegato a un'unità di questo condominio."
        />
      ) : aperto ? (
        <Card>
          <CardHeader>
            <CardHeaderText>
              <CardTitle>La tua risposta</CardTitle>
              <CardDescription>
                {unitaRispondenti.length === 1
                  ? "Puoi cambiare la risposta finché il sondaggio è aperto."
                  : "Rispondi per ciascuna delle tue unità: ognuna pesa per i propri millesimi."}
              </CardDescription>
            </CardHeaderText>
          </CardHeader>

          <div className="flex flex-col gap-6 divide-y divide-border [&>*:not(:first-child)]:pt-6">
            {unitaRispondenti.map((u) => (
              <RispostaForm
                key={u.id}
                sondaggioId={sondaggio.id}
                unita={u}
                opzioni={opzioni.map((o) => ({ id: o.id, testo: o.testo }))}
                mostraIdentificativo={unitaRispondenti.length > 1}
              />
            ))}
          </div>
        </Card>
      ) : (
        <Alert tono="warning">
          Il sondaggio è {chiusura === "scaduto" ? "scaduto" : "stato chiuso"}: non è più possibile
          rispondere.
        </Alert>
      )}

      {mostraRisultati && (
        <Card>
          <CardHeader>
            <CardHeaderText>
              <CardTitle>Risultati</CardTitle>
              <CardDescription>
                Solo dati aggregati: nessuno vede la risposta delle singole unità.
              </CardDescription>
            </CardHeaderText>
          </CardHeader>
          {risultati.risposteTotali === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna risposta finora.</p>
          ) : (
            <RisultatiSondaggio
              risultati={risultati}
              ponderato={sondaggio.ponderato}
              opzioneScelta={unitaRispondenti.find((u) => u.opzioneScelta)?.opzioneScelta}
            />
          )}
        </Card>
      )}
    </PageBody>
  );
}
