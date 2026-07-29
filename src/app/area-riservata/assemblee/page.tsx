import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { richiedeUtente } from "@/lib/supabase/dal";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, RowIcon } from "@/components/ui/table";
import { StatoBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDataOra } from "@/lib/format";

export default async function AssembleeCondominoPage() {
  await richiedeUtente();
  const supabase = await createClient();

  const { data: assemblee } = await supabase
    .from("assemblee")
    .select("*, condominio:condominio_id(nome)")
    .order("data_assemblea", { ascending: false });

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold tracking-tight">Assemblee</h1>

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
                  <Link href={`/area-riservata/assemblee/${a.id}`} className="hover:text-accent">
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
          title="Nessuna assemblea convocata"
          description="Quando l'amministratore convocherà un'assemblea per il tuo condominio, la vedrai qui."
        />
      )}
    </div>
  );
}
