import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AssembleaForm } from "./form";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, RowIcon } from "@/components/ui/table";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatoBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDataOra } from "@/lib/format";

export default async function AssembleePage() {
  const supabase = await createClient();

  const [{ data: assemblee }, { data: condomini }] = await Promise.all([
    supabase
      .from("assemblee")
      .select("*, condominio:condominio_id(nome)")
      .order("data_assemblea", { ascending: false }),
    supabase.from("condomini").select("id, nome").order("nome"),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold tracking-tight">Assemblee</h1>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <div className="w-full lg:w-80 shrink-0 lg:sticky lg:top-24">
          <Card>
            <CardHeader>
              <CardTitle>Nuova assemblea</CardTitle>
            </CardHeader>
            <AssembleaForm condomini={condomini ?? []} />
          </Card>
        </div>

        <div className="flex-1 min-w-0">
          {assemblee?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Condominio</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Stato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assemblee.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">
                      <Link href={`/admin/assemblee/${a.id}`} className="hover:text-accent">
                        <RowIcon icon={CalendarClock}>{a.condominio?.nome}</RowIcon>
                      </Link>
                    </TableCell>
                    <TableCell>{formatDataOra(a.data_assemblea)}</TableCell>
                    <TableCell className="capitalize">{a.tipo}</TableCell>
                    <TableCell>
                      <StatoBadge tipo="stato_assemblea" valore={a.stato} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              icon={CalendarClock}
              title="Nessuna assemblea ancora convocata"
              description="Convoca la prima assemblea dal modulo a sinistra."
            />
          )}
        </div>
      </div>
    </div>
  );
}
