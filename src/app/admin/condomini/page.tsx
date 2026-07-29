import Link from "next/link";
import { Building2, Home } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CondominioForm } from "./form";
import { UnitaForm } from "./unita-form";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, RowIcon } from "@/components/ui/table";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMillesimi } from "@/lib/format";
import type { Unita } from "@/lib/types";

export default async function CondominiPage() {
  const supabase = await createClient();
  const [{ data: condomini }, { data: unita }] = await Promise.all([
    supabase.from("condomini").select("*").order("created_at", { ascending: false }),
    supabase.from("unita").select("*").order("identificativo"),
  ]);

  const unitaPerCondominio = new Map<string, Unita[]>();
  for (const u of unita ?? []) {
    const lista = unitaPerCondominio.get(u.condominio_id) ?? [];
    lista.push(u);
    unitaPerCondominio.set(u.condominio_id, lista);
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold tracking-tight">Condomini</h1>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <div className="w-full lg:w-80 shrink-0 flex flex-col gap-6 lg:sticky lg:top-24">
          <Card>
            <CardHeader>
              <CardTitle>Nuovo condominio</CardTitle>
            </CardHeader>
            <CondominioForm />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Nuova unità</CardTitle>
            </CardHeader>
            <UnitaForm condomini={condomini ?? []} />
          </Card>
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-6">
          {condomini?.length ? (
            condomini.map((c) => {
              const listaUnita = unitaPerCondominio.get(c.id) ?? [];
              return (
                <Card key={c.id} className="gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold tracking-tight">
                        <RowIcon icon={Building2}>{c.nome}</RowIcon>
                      </h2>
                      <p className="text-sm text-muted-foreground pl-10.5">
                        {c.indirizzo}
                        {c.codice_fiscale ? ` · ${c.codice_fiscale}` : ""}
                      </p>
                    </div>
                    <Badge variant="neutral">{listaUnita.length} unità</Badge>
                  </div>

                  {listaUnita.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Identificativo</TableHead>
                          <TableHead>Piano</TableHead>
                          <TableHead>Millesimi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {listaUnita.map((u) => (
                          <TableRow key={u.id}>
                            <TableCell className="font-medium">
                              <Link href={`/admin/unita/${u.id}`} className="hover:text-accent">
                                <RowIcon icon={Home}>{u.identificativo}</RowIcon>
                              </Link>
                            </TableCell>
                            <TableCell>{u.piano ?? "-"}</TableCell>
                            <TableCell>{formatMillesimi(u.millesimi_proprieta)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nessuna unità in questo condominio.
                    </p>
                  )}
                </Card>
              );
            })
          ) : (
            <EmptyState
              icon={Building2}
              title="Nessun condominio ancora registrato"
              description="Aggiungi il primo condominio dal modulo a sinistra."
            />
          )}
        </div>
      </div>
    </div>
  );
}
