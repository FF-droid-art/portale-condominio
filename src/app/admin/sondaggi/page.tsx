import Link from "next/link";
import { ChevronRight, MessagesSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { richiedeAmministratore } from "@/lib/supabase/dal";
import type { Sondaggio } from "@/lib/types";
import { PageBody, PageHeader } from "@/components/ui/page-header";
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
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDataOra } from "@/lib/format";
import { motivoChiusura } from "@/lib/sondaggi";
import { SondaggioForm } from "./form";

export const metadata = { title: "Sondaggi" };

type RigaSondaggio = Sondaggio & { condominio: { nome: string } | null };

export default async function SondaggiPage() {
  await richiedeAmministratore();
  const supabase = await createClient();

  const [{ data: sondaggiData }, { data: condomini }] = await Promise.all([
    supabase
      .from("sondaggi")
      .select("*, condominio:condominio_id(nome)")
      .order("created_at", { ascending: false }),
    supabase.from("condomini").select("id, nome").order("nome"),
  ]);

  const sondaggi = (sondaggiData ?? []) as unknown as RigaSondaggio[];

  return (
    <PageBody>
      <PageHeader
        titolo="Sondaggi"
        descrizione="Consultazioni rapide tra i condòmini, fuori da un'assemblea formale: non deliberano nulla, servono a orientarsi prima di mettere un tema all'ordine del giorno."
        azioni={<SondaggioForm condomini={condomini ?? []} />}
      />

      {sondaggi.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Domanda</TableHead>
              <TableHead>Condominio</TableHead>
              <TableHead>Scadenza</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>
                <span className="sr-only">Apri</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sondaggi.map((s) => {
              const chiusura = motivoChiusura(s);
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/admin/sondaggi/${s.id}`}
                      className="rounded transition-colors hover:text-accent-ink"
                    >
                      <RowIcon icon={MessagesSquare}>{s.domanda}</RowIcon>
                    </Link>
                  </TableCell>
                  <TableCell etichetta="Condominio">{s.condominio?.nome ?? <Vuoto />}</TableCell>
                  <TableCell etichetta="Scadenza">
                    {s.scadenza ? formatDataOra(s.scadenza) : <Vuoto />}
                  </TableCell>
                  <TableCell etichetta="Stato">
                    {chiusura === null ? (
                      <Badge variant="success" punto>
                        Aperto
                      </Badge>
                    ) : (
                      <Badge variant="neutral" punto>
                        {chiusura === "scaduto" ? "Scaduto" : "Chiuso"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="md:w-10 md:text-right">
                    <Link
                      href={`/admin/sondaggi/${s.id}`}
                      className="inline-flex items-center gap-1 rounded text-sm font-medium text-accent-ink hover:underline"
                    >
                      Risultati
                      <ChevronRight className="size-4" aria-hidden="true" />
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          icon={MessagesSquare}
          title="Nessun sondaggio"
          description="Fai una domanda veloce ai condòmini — colore della facciata, orario dell'assemblea, priorità dei lavori — senza convocare un'assemblea."
          action={<SondaggioForm condomini={condomini ?? []} />}
        />
      )}
    </PageBody>
  );
}
