import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { richiedeAmministratore } from "@/lib/supabase/dal";
import type { Sondaggio, SondaggioOpzione } from "@/lib/types";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { formatDataOra } from "@/lib/format";
import { aggregaRisultati, motivoChiusura, type ConteggioOpzione } from "@/lib/sondaggi";
import { RisultatiSondaggio } from "@/components/risultati-sondaggio";
import { AzioniSondaggio } from "./azioni-sondaggio";

export default async function SondaggioDettaglioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await richiedeAmministratore();
  const supabase = await createClient();

  const { data: sondaggioData } = await supabase
    .from("sondaggi")
    .select("*, condominio:condominio_id(id, nome)")
    .eq("id", id)
    .single();

  if (!sondaggioData) notFound();

  const sondaggio = sondaggioData as unknown as Sondaggio & {
    condominio: { id: string; nome: string } | null;
  };

  const [{ data: opzioniData }, { data: conteggiData }, { data: unitaData }] = await Promise.all([
    supabase
      .from("sondaggio_opzioni")
      .select("id, sondaggio_id, testo, ordine")
      .eq("sondaggio_id", id)
      .order("ordine"),
    supabase.rpc("sondaggio_risultati", { p_sondaggio_id: id }),
    supabase
      .from("unita")
      .select("millesimi_proprieta")
      .eq("condominio_id", sondaggio.condominio_id),
  ]);

  const opzioni = (opzioniData ?? []) as SondaggioOpzione[];
  const conteggi = (conteggiData ?? []) as ConteggioOpzione[];
  const unita = unitaData ?? [];

  const risultati = aggregaRisultati({
    opzioni,
    conteggi,
    unitaTotali: unita.length,
    millesimiTotali: unita.reduce((somma, u) => somma + u.millesimi_proprieta, 0),
    ponderato: sondaggio.ponderato,
  });

  const chiusura = motivoChiusura(sondaggio);

  return (
    <PageBody>
      <PageHeader
        indietro={{ href: "/admin/sondaggi", label: "Sondaggi" }}
        eyebrow={
          sondaggio.condominio ? (
            <Link
              href={`/admin/condomini/${sondaggio.condominio.id}`}
              className="rounded hover:text-accent-ink"
            >
              {sondaggio.condominio.nome}
            </Link>
          ) : undefined
        }
        titolo={sondaggio.domanda}
        descrizione={sondaggio.descrizione ?? undefined}
        meta={
          <>
            {chiusura === null ? (
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
                Scadenza: {formatDataOra(sondaggio.scadenza)}
              </span>
            )}
            {sondaggio.ponderato && <Badge variant="accent">Pesato per millesimi</Badge>}
          </>
        }
        azioni={<AzioniSondaggio sondaggioId={sondaggio.id} stato={sondaggio.stato} />}
      />

      <Alert tono="info">
        Un sondaggio non è una votazione assembleare: non ha valore deliberativo e non segue i
        quorum dell&apos;art. 1136 c.c. Serve a raccogliere un orientamento.
      </Alert>

      <Card>
        {risultati.risposteTotali === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nessuna risposta finora. I condòmini trovano il sondaggio nella loro area riservata.
          </p>
        ) : (
          <RisultatiSondaggio risultati={risultati} ponderato={sondaggio.ponderato} />
        )}
      </Card>
    </PageBody>
  );
}
