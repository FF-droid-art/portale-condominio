import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ruler } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, RowIcon } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { TabellaMillesimaleForm } from "./tabella-form";
import { EliminaTabellaButton } from "./elimina-tabella-button";

export default async function MillesimiPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: condominio } = await supabase
    .from("condomini")
    .select("id, nome")
    .eq("id", id)
    .single();
  if (!condominio) notFound();

  const { data: tabelle } = await supabase
    .from("tabelle_millesimali")
    .select("*")
    .eq("condominio_id", id)
    .order("nome");

  return (
    <div className="flex flex-col gap-8">
      <Link
        href={`/admin/condomini/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-accent w-fit"
      >
        <ArrowLeft className="size-4" /> {condominio.nome}
      </Link>

      <h1 className="text-3xl font-bold tracking-tight">Tabelle millesimali</h1>
      <p className="text-sm text-muted-foreground -mt-6">
        I millesimi generali (proprietà) restano quelli dell&apos;unità. Qui puoi aggiungere
        tabelle aggiuntive — es. ascensore, riscaldamento — da usare quando ripartisci una spesa
        su una proporzione diversa da quella generale.
      </p>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <div className="w-full lg:w-80 shrink-0 lg:sticky lg:top-24">
          <Card>
            <CardHeader>
              <CardTitle>Nuova tabella</CardTitle>
            </CardHeader>
            <TabellaMillesimaleForm condominioId={id} tabelleEsistenti={tabelle ?? []} />
          </Card>
        </div>

        <div className="flex-1 min-w-0">
          {tabelle?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tabelle.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/admin/condomini/${id}/millesimi/${t.id}`}
                        className="hover:text-accent"
                      >
                        <RowIcon icon={Ruler}>{t.nome}</RowIcon>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <EliminaTabellaButton tabellaId={t.id} condominioId={id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              icon={Ruler}
              title="Nessuna tabella millesimale aggiuntiva"
              description="Crea la prima dal modulo a sinistra."
            />
          )}
        </div>
      </div>
    </div>
  );
}
