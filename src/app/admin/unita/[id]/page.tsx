import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Home, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, StatoBadge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  RowIcon,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMillesimi } from "@/lib/format";
import { haQuota } from "@/lib/ruoli";
import { ProprietarioForm } from "./proprietario-form";
import { RimuoviProprietarioButton } from "./rimuovi-proprietario-button";
import { ModificaContattiButton } from "./modifica-contatti-button";

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

  return (
    <div className="flex flex-col gap-8">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm text-muted-foreground">
              <Link href={`/admin/condomini/${unita.condominio_id}`} className="hover:text-accent">
                <RowIcon icon={Building2}>{unita.condominio?.nome}</RowIcon>
              </Link>
            </div>
            <h1 className="text-3xl font-bold tracking-tight mt-2">
              {unita.identificativo}
            </h1>
          </div>
          <div className="flex flex-col items-end gap-1 text-sm text-muted-foreground">
            <p>Piano: {unita.piano ?? "-"}</p>
            <p>Millesimi: {formatMillesimi(unita.millesimi_proprieta)}</p>
          </div>
        </div>
      </Card>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <div className="w-full lg:w-80 shrink-0 lg:sticky lg:top-24">
          <Card>
            <CardHeader>
              <CardTitle>Aggiungi soggetto</CardTitle>
            </CardHeader>
            <ProprietarioForm unitaId={unita.id} condominioId={unita.condominio_id} />
          </Card>
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-6">
          {tutti.length === 0 ? (
            <EmptyState
              icon={Home}
              title="Nessun soggetto collegato"
              description="Aggiungi un soggetto dal riquadro a sinistra."
            />
          ) : (
            <>
              {attivi.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Soggetto</TableHead>
                      <TableHead>Ruolo</TableHead>
                      <TableHead>Quota</TableHead>
                      <TableHead>Voto</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attivi.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          <RowIcon icon={User}>
                            <div className="flex flex-col">
                              <span>
                                {p.anagrafica?.nominativo ??
                                  (p.utente ? `${p.utente.nome} ${p.utente.cognome}` : "—")}
                              </span>
                              {(p.anagrafica?.email ?? p.utente?.email ?? p.anagrafica?.telefono) && (
                                <span className="text-xs font-normal text-muted-foreground">
                                  {p.anagrafica?.email ?? p.utente?.email ?? ""}
                                  {p.anagrafica?.telefono ? ` · ${p.anagrafica.telefono}` : ""}
                                </span>
                              )}
                            </div>
                          </RowIcon>
                        </TableCell>
                        <TableCell>
                          <StatoBadge tipo="tipo_soggetto" valore={p.tipo_soggetto} />
                        </TableCell>
                        <TableCell>
                          {haQuota(p.tipo_soggetto) ? (
                            <Badge variant="neutral">{p.quota_possesso}%</Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {p.diritto_voto ? (
                            <Badge variant="success">Sì</Badge>
                          ) : (
                            <Badge variant="neutral">No</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {p.anagrafica_id && (
                              <ModificaContattiButton
                                anagraficaId={p.anagrafica_id}
                                unitaId={unita.id}
                                nominativo={p.anagrafica?.nominativo ?? ""}
                                email={p.anagrafica?.email ?? null}
                                telefono={p.anagrafica?.telefono ?? null}
                              />
                            )}
                            <RimuoviProprietarioButton id={p.id} unitaId={unita.id} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">Nessun soggetto attivo.</p>
              )}

              {storici.length > 0 && (
                <details className="rounded-2xl border border-border bg-surface p-4">
                  <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                    Ex soggetti ({storici.length})
                  </summary>
                  <div className="mt-3">
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
                            <TableCell className="font-medium">
                              {p.anagrafica?.nominativo ??
                                (p.utente ? `${p.utente.nome} ${p.utente.cognome}` : "—")}
                            </TableCell>
                            <TableCell>{p.anagrafica?.email ?? "—"}</TableCell>
                            <TableCell>
                              <span className="mr-1 text-sm text-muted-foreground">ex</span>
                              <StatoBadge tipo="tipo_soggetto" valore={p.tipo_soggetto} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </details>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
