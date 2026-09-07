import Link from "next/link";
import { notFound } from "next/navigation";
import { Home, User, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Card, Section } from "@/components/ui/card";
import { Badge, StatoBadge } from "@/components/ui/badge";
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
import { haQuota } from "@/lib/ruoli";
import { ProprietarioForm } from "./proprietario-form";
import { RimuoviProprietarioButton } from "./rimuovi-proprietario-button";
import { ModificaContattiButton } from "./modifica-contatti-button";
import { ModificaMillesimiButton } from "./modifica-millesimi-button";

export default async function UnitaDettaglioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: unita } = await supabase
    .from("unita")
    .select("*, condominio:condominio_id(nome)")
    .eq("id", id)
    .single();

  if (!unita) notFound();

  const { data: proprietari } = await supabase
    .from("unita_proprietari")
    .select(
      "*, utente:utente_id(nome, cognome, email), anagrafica:anagrafica_id(nominativo, email, telefono)"
    )
    .eq("unita_id", id)
    .order("created_at");

  // Soggetti attivi (occupanti attuali) vs storici (ex proprietari/inquilini,
  // attivo = false). I legami "vecchio stile" senza flag restano attivi.
  const tutti = proprietari ?? [];
  const attivi = tutti.filter((p) => p.attivo !== false);
  const storici = tutti.filter((p) => p.attivo === false);

  function nomeSoggetto(p: (typeof tutti)[number]): string {
    return (
      p.anagrafica?.nominativo ??
      (p.utente ? `${p.utente.nome} ${p.utente.cognome}` : "—")
    );
  }

  return (
    <PageBody>
      <PageHeader
        indietro={{
          href: `/admin/condomini/${unita.condominio_id}`,
          label: unita.condominio?.nome ?? "Condominio",
        }}
        titolo={unita.identificativo}
        descrizione="Soggetti collegati all'unità e millesimi su cui si calcolano quote e diritto di voto."
      />

      {/* Dati dell'unità in una riga sola: sono pochi e si leggono a colpo
          d'occhio, i millesimi si modificano direttamente da qui. */}
      <Card padding="sm">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <div className="flex flex-col gap-1">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Condominio
            </dt>
            <dd className="text-sm font-medium">
              <Link
                href={`/admin/condomini/${unita.condominio_id}`}
                className="rounded hover:text-accent-ink"
              >
                {unita.condominio?.nome ?? "—"}
              </Link>
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Piano
            </dt>
            <dd className="text-sm font-medium">{unita.piano ?? "—"}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Millesimi
            </dt>
            <dd className="text-sm">
              <ModificaMillesimiButton
                unitaId={unita.id}
                condominioId={unita.condominio_id}
                identificativo={unita.identificativo}
                millesimi={unita.millesimi_proprieta}
              />
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Soggetti attivi
            </dt>
            <dd className="cifre text-sm font-medium">{attivi.length}</dd>
          </div>
        </dl>
      </Card>

      <Section
        titolo="Soggetti collegati"
        descrizione="Proprietari, usufruttuari, conduttori e altri titolari attualmente collegati a questa unità."
        azioni={<ProprietarioForm unitaId={unita.id} condominioId={unita.condominio_id} />}
      >
        {attivi.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nessun soggetto collegato"
            description="Aggiungi il proprietario o l'occupante dell'unità: sarà lui a ricevere gli avvisi e a poter votare in assemblea."
            action={<ProprietarioForm unitaId={unita.id} condominioId={unita.condominio_id} />}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Soggetto</TableHead>
                <TableHead>Ruolo</TableHead>
                <TableHead numeric>Quota</TableHead>
                <TableHead>Diritto di voto</TableHead>
                <TableHead>
                  <span className="sr-only">Azioni</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attivi.map((p) => {
                const contatti = [
                  p.anagrafica?.email ?? p.utente?.email ?? null,
                  p.anagrafica?.telefono ?? null,
                ].filter(Boolean);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      <RowIcon icon={User}>
                        <span className="flex flex-col">
                          <span>{nomeSoggetto(p)}</span>
                          {contatti.length > 0 && (
                            <span className="text-xs font-normal text-muted-foreground">
                              {contatti.join(" · ")}
                            </span>
                          )}
                        </span>
                      </RowIcon>
                    </TableCell>
                    <TableCell etichetta="Ruolo">
                      <StatoBadge tipo="tipo_soggetto" valore={p.tipo_soggetto} />
                    </TableCell>
                    <TableCell etichetta="Quota" numeric>
                      {haQuota(p.tipo_soggetto) ? `${p.quota_possesso}%` : <Vuoto />}
                    </TableCell>
                    <TableCell etichetta="Diritto di voto">
                      {p.diritto_voto ? (
                        <Badge variant="success" punto>
                          Sì
                        </Badge>
                      ) : (
                        <Badge variant="neutral" punto>
                          No
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="md:text-right">
                      <span className="flex items-center justify-end gap-1">
                        {p.anagrafica_id && (
                          <ModificaContattiButton
                            anagraficaId={p.anagrafica_id}
                            unitaId={unita.id}
                            nominativo={p.anagrafica?.nominativo ?? ""}
                            email={p.anagrafica?.email ?? null}
                            telefono={p.anagrafica?.telefono ?? null}
                          />
                        )}
                        <RimuoviProprietarioButton
                          id={p.id}
                          unitaId={unita.id}
                          nominativo={nomeSoggetto(p)}
                        />
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Section>

      {storici.length > 0 && (
        <Section>
          <details className="group rounded-2xl border border-border bg-surface">
            <summary className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl px-5 py-4 text-sm font-medium">
              <span className="flex items-center gap-2.5">
                <Home className="size-4 text-muted-foreground" aria-hidden="true" />
                Soggetti precedenti
                <Badge variant="neutral">{storici.length}</Badge>
              </span>
              <span className="text-xs font-normal text-muted-foreground group-open:hidden">
                Mostra
              </span>
              <span className="hidden text-xs font-normal text-muted-foreground group-open:inline">
                Nascondi
              </span>
            </summary>
            <div className="border-t border-border p-5">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Soggetto</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Ruolo precedente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {storici.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{nomeSoggetto(p)}</TableCell>
                      <TableCell etichetta="Email">
                        {p.anagrafica?.email ?? <Vuoto />}
                      </TableCell>
                      <TableCell etichetta="Ruolo precedente">
                        <span className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">ex</span>
                          <StatoBadge tipo="tipo_soggetto" valore={p.tipo_soggetto} />
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </details>
        </Section>
      )}
    </PageBody>
  );
}
