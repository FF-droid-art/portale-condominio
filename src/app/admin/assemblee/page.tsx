import Link from "next/link";
import { CalendarClock, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
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
import { AssembleaForm } from "./form";

export const metadata = { title: "Assemblee" };

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
    <PageBody>
      <PageHeader
        titolo="Assemblee"
        descrizione="Le assemblee convocate nei tuoi condomìni. Apri un'assemblea per gestire l'ordine del giorno, aprire le votazioni e caricare il verbale."
        azioni={<AssembleaForm condomini={condomini ?? []} />}
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
                    href={`/admin/assemblee/${a.id}`}
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
                    href={`/admin/assemblee/${a.id}`}
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
          description="Convoca la prima assemblea: potrai aggiungere i punti all'ordine del giorno e aprire le votazioni quando vuoi."
          action={<AssembleaForm condomini={condomini ?? []} />}
        />
      )}
    </PageBody>
  );
}
