import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { richiedeUtente } from "@/lib/supabase/dal";
import type { Segnalazione } from "@/lib/types";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardHeaderText, CardTitle, Section } from "@/components/ui/card";
import { StatoBadge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatDataOra } from "@/lib/format";
import { ETICHETTE_CATEGORIA_SEGNALAZIONE } from "@/lib/segnalazioni";
import { ElencoNote, type NotaSegnalazione } from "@/components/segnalazioni/elenco-note";
import { NotaSegnalazioneForm } from "@/components/segnalazioni/nota-form";
import { aggiungiNotaCondomino } from "../actions";
import { RitiraSegnalazioneButton } from "./ritira-button";

type Dettaglio = Segnalazione & {
  condominio: { nome: string; amministratore_id: string } | null;
  unita: { identificativo: string } | null;
  fornitore: { nome: string } | null;
};

const DESCRIZIONE_STATO: Record<string, string> = {
  aperta: "L'amministratore l'ha ricevuta e non l'ha ancora presa in carico.",
  in_corso: "L'amministratore ci sta lavorando: gli aggiornamenti compaiono qui sotto.",
  chiusa: "L'intervento è concluso. La scheda resta consultabile.",
};

export default async function SegnalazioneCondominoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const utente = await richiedeUtente();
  const supabase = await createClient();

  const { data } = await supabase
    .from("segnalazioni")
    .select(
      "*, condominio:condominio_id(nome, amministratore_id), unita:unita_id(identificativo), fornitore:fornitore_id(nome)"
    )
    .eq("id", id)
    .single();

  if (!data) notFound();
  const segnalazione = data as unknown as Dettaglio;

  const { data: noteData } = await supabase
    .from("segnalazione_note")
    .select("id, testo, interna, created_at, autore_id, autore:autore_id(nome, cognome)")
    .eq("segnalazione_id", id)
    .order("created_at");

  // Le note interne dell'amministratore non arrivano nemmeno qui: le esclude
  // la policy RLS della tabella, non un filtro applicativo.
  const note = (noteData ?? []) as unknown as NotaSegnalazione[];

  let fotoUrl: string | null = null;
  if (segnalazione.foto_url) {
    const { data: firmato } = await supabase.storage
      .from("documenti-condominio")
      .createSignedUrl(segnalazione.foto_url, 600);
    fotoUrl = firmato?.signedUrl ?? null;
  }
  const fotoEImmagine = /\.(jpe?g|png|webp|gif|avif)$/i.test(segnalazione.foto_url ?? "");

  const mia = segnalazione.aperta_da === utente.id;

  return (
    <PageBody>
      <PageHeader
        indietro={{ href: "/area-riservata/segnalazioni", label: "Segnalazioni" }}
        eyebrow={segnalazione.condominio?.nome}
        titolo={segnalazione.titolo}
        descrizione={`Aperta il ${formatDataOra(segnalazione.created_at)}${
          mia ? "" : " da un altro condòmino"
        } · ${
          segnalazione.unita?.identificativo ?? "parti comuni"
        } · ${ETICHETTE_CATEGORIA_SEGNALAZIONE[segnalazione.categoria] ?? segnalazione.categoria}`}
        meta={<StatoBadge tipo="stato_segnalazione" valore={segnalazione.stato} />}
        azioni={
          mia && segnalazione.stato === "aperta" ? (
            <RitiraSegnalazioneButton id={segnalazione.id} />
          ) : undefined
        }
      />

      <Alert
        tono={segnalazione.stato === "chiusa" ? "success" : "info"}
        titolo={
          segnalazione.stato === "chiusa"
            ? "Segnalazione chiusa"
            : segnalazione.stato === "in_corso"
              ? "Presa in carico"
              : "In attesa di presa in carico"
        }
      >
        {DESCRIZIONE_STATO[segnalazione.stato]}
        {segnalazione.fornitore?.nome
          ? ` Assegnata a ${segnalazione.fornitore.nome}.`
          : ""}
      </Alert>

      <Card>
        <CardHeader>
          <CardHeaderText>
            <CardTitle>Descrizione</CardTitle>
          </CardHeaderText>
        </CardHeader>

        <p className="whitespace-pre-line text-sm leading-relaxed">{segnalazione.descrizione}</p>

        {fotoUrl && (
          <div className="mt-4 flex flex-col items-start gap-2">
            {fotoEImmagine ? (
              <a
                href={fotoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-xl border border-border"
              >
                {/* URL firmato a scadenza breve: vedi la nota nella pagina
                    corrispondente dell'amministratore. */}
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
        titolo="Aggiornamenti"
        descrizione="Quello che si sono detti amministratore e condòmini su questa segnalazione."
      >
        <ElencoNote
          note={note}
          utenteCorrenteId={utente.id}
          amministratoreId={segnalazione.condominio?.amministratore_id}
        />

        {segnalazione.stato !== "chiusa" && (
          <Card padding="sm">
            <NotaSegnalazioneForm
              segnalazioneId={segnalazione.id}
              azione={aggiungiNotaCondomino}
              etichetta="Aggiungi un'informazione"
            />
          </Card>
        )}
      </Section>
    </PageBody>
  );
}
