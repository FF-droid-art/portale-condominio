import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { richiedeAmministratore } from "@/lib/supabase/dal";
import type { Segnalazione } from "@/lib/types";
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
import { Button } from "@/components/ui/button";
import { formatDataOra } from "@/lib/format";
import { ETICHETTE_CATEGORIA_SEGNALAZIONE } from "@/lib/segnalazioni";
import { ElencoNote, type NotaSegnalazione } from "@/components/segnalazioni/elenco-note";
import { NotaSegnalazioneForm } from "@/components/segnalazioni/nota-form";
import { aggiungiNotaAmministratore } from "../actions";
import { GestioneSegnalazione } from "./gestione-segnalazione";

type Dettaglio = Segnalazione & {
  condominio: { nome: string; amministratore_id: string } | null;
  unita: { id: string; identificativo: string } | null;
  autore: { nome: string; cognome: string; email: string } | null;
};

export default async function SegnalazioneAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const amministratore = await richiedeAmministratore();
  const supabase = await createClient();

  const { data } = await supabase
    .from("segnalazioni")
    .select(
      "*, condominio:condominio_id(nome, amministratore_id), unita:unita_id(id, identificativo), autore:aperta_da(nome, cognome, email)"
    )
    .eq("id", id)
    .single();

  if (!data) notFound();
  const segnalazione = data as unknown as Dettaglio;

  const [{ data: noteData }, { data: fornitoriData }] = await Promise.all([
    supabase
      .from("segnalazione_note")
      .select("id, testo, interna, created_at, autore_id, autore:autore_id(nome, cognome)")
      .eq("segnalazione_id", id)
      .order("created_at"),
    supabase
      .from("fornitori")
      .select("id, nome, attivo")
      .eq("condominio_id", segnalazione.condominio_id)
      .order("nome"),
  ]);

  const note = (noteData ?? []) as unknown as NotaSegnalazione[];

  // La foto sta in un bucket privato: si consegna un URL firmato a scadenza
  // breve, come già per le fatture delle spese e per i verbali.
  let fotoUrl: string | null = null;
  if (segnalazione.foto_url) {
    const { data: firmato } = await supabase.storage
      .from("documenti-condominio")
      .createSignedUrl(segnalazione.foto_url, 600);
    fotoUrl = firmato?.signedUrl ?? null;
  }

  const fotoEImmagine = /\.(jpe?g|png|webp|gif|avif)$/i.test(segnalazione.foto_url ?? "");

  return (
    <PageBody>
      <PageHeader
        indietro={{ href: "/admin/segnalazioni", label: "Segnalazioni" }}
        eyebrow={
          <Link
            href={`/admin/condomini/${segnalazione.condominio_id}`}
            className="rounded hover:text-accent-ink"
          >
            {segnalazione.condominio?.nome}
          </Link>
        }
        titolo={segnalazione.titolo}
        descrizione={`Aperta il ${formatDataOra(segnalazione.created_at)}${
          segnalazione.autore
            ? ` da ${segnalazione.autore.nome} ${segnalazione.autore.cognome}`
            : ""
        }`}
        meta={
          <>
            <StatoBadge tipo="stato_segnalazione" valore={segnalazione.stato} />
            <StatoBadge tipo="priorita_segnalazione" valore={segnalazione.priorita} />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardHeaderText>
                <CardTitle>Descrizione</CardTitle>
                <CardDescription>
                  {ETICHETTE_CATEGORIA_SEGNALAZIONE[segnalazione.categoria] ??
                    segnalazione.categoria}
                  {" · "}
                  {segnalazione.unita ? (
                    <Link
                      href={`/admin/unita/${segnalazione.unita.id}`}
                      className="rounded hover:text-accent-ink"
                    >
                      {segnalazione.unita.identificativo}
                    </Link>
                  ) : (
                    "parti comuni"
                  )}
                </CardDescription>
              </CardHeaderText>
            </CardHeader>

            <p className="whitespace-pre-line text-sm leading-relaxed">
              {segnalazione.descrizione}
            </p>

            {fotoUrl && (
              <div className="mt-4 flex flex-col items-start gap-2">
                {fotoEImmagine ? (
                  <a
                    href={fotoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block overflow-hidden rounded-xl border border-border"
                  >
                    {/* URL firmato a scadenza breve, diverso a ogni richiesta:
                        l'ottimizzatore di next/image non può metterlo in cache
                        e richiederebbe di dichiarare l'host dello storage tra i
                        domini remoti. Qui serve solo un'anteprima cliccabile. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={fotoUrl}
                      alt="Foto allegata alla segnalazione"
                      className="h-auto w-full max-w-md object-cover"
                    />
                  </a>
                ) : (
                  <Button href={fotoUrl} target="_blank" rel="noopener noreferrer" variant="secondary" size="sm">
                    Apri l&apos;allegato
                  </Button>
                )}
              </div>
            )}
          </Card>

          <Section
            titolo="Cronologia"
            descrizione="Gli aggiornamenti visibili al condòmino e le note interne, in ordine di arrivo."
          >
            <ElencoNote
              note={note}
              utenteCorrenteId={amministratore.id}
              amministratoreId={segnalazione.condominio?.amministratore_id}
            />

            <Card padding="sm">
              <NotaSegnalazioneForm
                segnalazioneId={segnalazione.id}
                azione={aggiungiNotaAmministratore}
                permetteInterna
              />
            </Card>
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardHeaderText>
                <CardTitle>Presa in carico</CardTitle>
                <CardDescription>
                  Lo stato che il condòmino vede nella sua area riservata.
                </CardDescription>
              </CardHeaderText>
            </CardHeader>

            <GestioneSegnalazione
              id={segnalazione.id}
              stato={segnalazione.stato}
              priorita={segnalazione.priorita}
              fornitoreId={segnalazione.fornitore_id}
              fornitori={(fornitoriData ?? []) as { id: string; nome: string; attivo: boolean }[]}
            />
          </Card>

          <Card>
            <CardHeader>
              <CardHeaderText>
                <CardTitle>Chi l&apos;ha aperta</CardTitle>
              </CardHeaderText>
            </CardHeader>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Nominativo</dt>
                <dd className="font-medium">
                  {segnalazione.autore
                    ? `${segnalazione.autore.nome} ${segnalazione.autore.cognome}`
                    : "—"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="truncate font-medium">{segnalazione.autore?.email ?? "—"}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Ultimo movimento</dt>
                <dd className="cifre font-medium">{formatDataOra(segnalazione.aggiornata_il)}</dd>
              </div>
              {segnalazione.chiusa_il && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">Chiusa il</dt>
                  <dd className="cifre font-medium">{formatDataOra(segnalazione.chiusa_il)}</dd>
                </div>
              )}
            </dl>
          </Card>
        </div>
      </div>
    </PageBody>
  );
}
