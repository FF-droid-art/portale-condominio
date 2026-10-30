import Link from "next/link";
import { notFound } from "next/navigation";
import { ListChecks, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { FirmaVerbale, ModalitaPresenza, PuntoOdg, StatoAssemblea } from "@/lib/types";
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
import { normalizzaConvocazione } from "@/lib/quorum";
import {
  QuorumCostitutivo,
  RIEPILOGO_VUOTO,
  type RiepilogoQuorum,
} from "@/components/quorum-costitutivo";
import { StatoAssembleaControls } from "./stato-assemblea";
import { PuntoOdgCard } from "./punto-card";
import { PuntoOdgForm } from "./punto-form";
import { LinkVideoconferenza } from "./link-videoconferenza";
import { VerbaleUpload } from "./verbale-upload";
import { DettagliAssemblea } from "./dettagli-assemblea";
import { InviaConvocazione } from "./invia-convocazione";
import { PresenzeCard, type RigaPresenza } from "./presenze-card";
import { DocumentiAssemblea } from "./documenti-assemblea";
import { FirmeVerbaleCard, type Firmatario } from "./firme-verbale-card";

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
      "id, data_assemblea, tipo, stato, condominio_id, convocazione, luogo, link_videoconferenza, verbale_url, convocazione_inviata_il, convocazione_email_destinatari, convocazione_email_consegnate, condominio:condominio_id(nome)"
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

  const [
    { data: unitaCondominio },
    { data: puntiOdgData },
    { data: delegheData },
    { data: presenzeData },
    { data: riepilogoData },
    { data: firmeData },
  ] = await Promise.all([
    supabase
      .from("unita")
      .select("id, identificativo, millesimi_proprieta")
      .eq("condominio_id", assemblea.condominio_id)
      .order("identificativo"),
    supabase
      .from("punti_odg")
      .select("*")
      .eq("assemblea_id", id)
      .order("numero_punto", { ascending: true }),
    supabase
      .from("deleghe")
      .select(
        "id, unita_delegante_id, unita_delegante:unita_delegante_id(identificativo, millesimi_proprieta), utente_delegato:utente_delegato_id(nome, cognome)"
      )
      .eq("assemblea_id", id),
    supabase
      .from("presenze")
      .select("unita_id, modalita")
      .eq("assemblea_id", id)
      .is("ora_uscita", null),
    supabase.rpc("assemblea_riepilogo_quorum", { p_assemblea_id: id }).maybeSingle(),
    supabase
      .from("firme_verbale")
      .select(
        "id, nominativo, email, ruolo, richiesta_inviata_il, confermato_il, verbale_url_confermato"
      )
      .eq("assemblea_id", id)
      .order("created_at"),
  ]);

  const puntiOdg = (puntiOdgData ?? []) as PuntoOdg[];
  const convocazione = normalizzaConvocazione(assemblea.convocazione);
  const riepilogo = (riepilogoData as RiepilogoQuorum | null) ?? RIEPILOGO_VUOTO;

  const modalitaPerUnita = new Map(
    (presenzeData ?? []).map((p) => [p.unita_id, p.modalita as ModalitaPresenza])
  );
  const delegatoPerUnita = new Map(
    (delegheData ?? []).map((d) => {
      const delegato = d.utente_delegato as unknown as { nome: string; cognome: string } | null;
      return [d.unita_delegante_id, delegato ? `${delegato.nome} ${delegato.cognome}` : "un delegato"];
    })
  );

  const righePresenza: RigaPresenza[] = (unitaCondominio ?? []).map((u) => ({
    unitaId: u.id,
    identificativo: u.identificativo,
    millesimi: u.millesimi_proprieta,
    modalita: modalitaPerUnita.get(u.id) ?? null,
    delegataA: delegatoPerUnita.get(u.id) ?? null,
  }));

  const firmatari: Firmatario[] = (
    (firmeData ?? []) as Pick<
      FirmaVerbale,
      | "id"
      | "nominativo"
      | "email"
      | "ruolo"
      | "richiesta_inviata_il"
      | "confermato_il"
      | "verbale_url_confermato"
    >[]
  ).map((f) => ({
    id: f.id,
    nominativo: f.nominativo,
    email: f.email,
    ruolo: f.ruolo,
    richiestaInviataIl: f.richiesta_inviata_il,
    confermatoIl: f.confermato_il,
    // La conferma vale per il file che era depositato in quel momento: se il
    // verbale è stato sostituito dopo, va detto invece di lasciar credere che
    // il documento attuale sia approvato.
    suVerbaleSuperato: Boolean(
      f.confermato_il && f.verbale_url_confermato !== assemblea.verbale_url
    ),
  }));

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

      {/* La key cambia quando cambiano i dati calcolati dal server (una
          presenza registrata, una delega revocata): il componente riparte dal
          valore aggiornato invece di restare fermo sul primo che ha ricevuto. */}
      <QuorumCostitutivo
        key={`${riepilogo.unita_intervenute}-${riepilogo.millesimi_intervenuti}-${convocazione}`}
        assembleaId={assemblea.id}
        convocazione={convocazione}
        riepilogoIniziale={riepilogo}
        aggiornaInAutomatico={assemblea.stato === "in_corso"}
      />

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <PresenzeCard
            assembleaId={assemblea.id}
            righe={righePresenza}
            modificabile={assemblea.stato !== "conclusa"}
          />

          <Section
            titolo="Punti all'ordine del giorno"
            descrizione="Per ogni punto i voti registrati vengono confrontati con la maggioranza di legge richiesta, in base alla convocazione impostata. L'esito salvato alla chiusura resta la maggioranza semplice dei voti espressi: se il quorum di legge non è raggiunto il portale lo segnala, ma non blocca la chiusura."
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
                    millesimiTotali={riepilogo.millesimi_totali}
                    convocazione={convocazione}
                    unitaTotali={riepilogo.unita_totali}
                    unitaIntervenute={riepilogo.unita_intervenute}
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
          <DettagliAssemblea
            assembleaId={assemblea.id}
            luogo={assemblea.luogo}
            convocazione={convocazione}
          />

          <Card>
            <CardHeader>
              <CardHeaderText>
                <CardTitle>Convocazione via email</CardTitle>
                <CardDescription>
                  Alla creazione è partita una notifica minima. Dopo aver impostato luogo e punti
                  all&apos;ordine del giorno, rimandala per includerli.
                </CardDescription>
              </CardHeaderText>
            </CardHeader>
            <InviaConvocazione
              assembleaId={assemblea.id}
              ultimoInvio={{
                inviataIl: assemblea.convocazione_inviata_il,
                destinatari: assemblea.convocazione_email_destinatari,
                consegnate: assemblea.convocazione_email_consegnate,
              }}
            />
          </Card>

          <DocumentiAssemblea assembleaId={assemblea.id} />

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

          <FirmeVerbaleCard
            assembleaId={assemblea.id}
            firmatari={firmatari}
            verbalePresente={Boolean(assemblea.verbale_url)}
          />

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
