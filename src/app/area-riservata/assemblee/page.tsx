import Link from "next/link";
import { CalendarClock, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { richiedeUtente } from "@/lib/supabase/dal";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  RowIcon,
} from "@/components/ui/table";
import { StatoBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDataOra } from "@/lib/format";

export const metadata = { title: "Assemblee" };

export default async function AssembleeCondominoPage() {
  await richiedeUtente();
  const supabase = await createClient();

  const { data: assemblee } = await supabase
    .from("assemblee")
    .select("*, condominio:condominio_id(nome)")
    .order("data_assemblea", { ascending: false });

  return (
    <PageBody>
      <PageHeader
        titolo="Assemblee"
        descrizione="Le assemblee dei condomìni in cui possiedi un'unità. Apri un'assemblea per votare i punti all'ordine del giorno o delegare il tuo voto."
      />

      {assemblee?.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Condominio</TableHead>
              <TableHead>Data e ora</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>
                <span className="sr-only">Apri</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assemblee.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/area-riservata/assemblee/${a.id}`}
                    className="rounded transition-colors hover:text-accent-ink"
                  >
                    <RowIcon icon={CalendarClock}>{a.condominio?.nome}</RowIcon>
                  </Link>
                </TableCell>
                <TableCell etichetta="Data e ora">{formatDataOra(a.data_assemblea)}</TableCell>
                <TableCell etichetta="Tipo" className="capitalize">
                  {a.tipo}
                </TableCell>
                <TableCell etichetta="Stato">
                  <StatoBadge tipo="stato_assemblea" valore={a.stato} />
                </TableCell>
                <TableCell className="md:w-10 md:text-right">
                  <Link
                    href={`/area-riservata/assemblee/${a.id}`}
                    className="inline-flex items-center gap-1 rounded text-sm font-medium text-accent-ink hover:underline"
                  >
                    Apri
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          icon={CalendarClock}
          title="Nessuna assemblea convocata"
          description="Quando l'amministratore convocherà un'assemblea per il tuo condominio, la troverai qui con l'ordine del giorno."
        />
      )}
    </PageBody>
  );
}
