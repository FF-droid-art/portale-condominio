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
import { ProprietarioForm } from "./proprietario-form";
import { RimuoviProprietarioButton } from "./rimuovi-proprietario-button";

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

  const [{ data: proprietari }, { data: candidatiGrezzi }] = await Promise.all([
    supabase
      .from("unita_proprietari")
      .select("*, utente:utente_id(nome, cognome, email)")
      .eq("unita_id", id)
      .order("created_at"),
    supabase
      .from("utenti")
      .select("id, nome, cognome, email")
      .eq("ruolo", "condomino")
      .order("cognome"),
  ]);

  const idGiaProprietari = new Set((proprietari ?? []).map((p) => p.utente_id));
  const candidati = (candidatiGrezzi ?? []).filter((c) => !idGiaProprietari.has(c.id));

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
            <ProprietarioForm unitaId={unita.id} candidati={candidati} />
          </Card>
        </div>

        <div className="flex-1 min-w-0">
          {proprietari?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Condomino</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Ruolo</TableHead>
                  <TableHead>Quota</TableHead>
                  <TableHead>Voto</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proprietari.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      <RowIcon icon={User}>
                        {p.utente?.nome} {p.utente?.cognome}
                      </RowIcon>
                    </TableCell>
                    <TableCell>{p.utente?.email}</TableCell>
                    <TableCell>
                      <StatoBadge tipo="tipo_soggetto" valore={p.tipo_soggetto} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="neutral">{p.quota_possesso}%</Badge>
                    </TableCell>
                    <TableCell>
                      {p.diritto_voto ? (
                        <Badge variant="success">Sì</Badge>
                      ) : (
                        <Badge variant="neutral">No</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <RimuoviProprietarioButton id={p.id} unitaId={unita.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              icon={Home}
              title="Nessun soggetto collegato"
              description="Collega un condomino da questa unità perché possa accedere ai propri dati dall'area riservata."
            />
          )}
        </div>
      </div>
    </div>
  );
}
