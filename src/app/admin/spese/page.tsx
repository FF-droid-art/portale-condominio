import Link from "next/link";
import { Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SpesaForm } from "./form";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, RowIcon } from "@/components/ui/table";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatValuta, formatData } from "@/lib/format";

export default async function SpesePage() {
  const supabase = await createClient();

  const [{ data: spese }, { data: condomini }, { data: ripartizioni }] = await Promise.all([
    supabase
      .from("spese")
      .select("*, condominio:condominio_id(nome)")
      .order("data_spesa", { ascending: false }),
    supabase.from("condomini").select("id, nome").order("nome"),
    supabase.from("ripartizioni").select("spesa_id, stato_pagamento"),
  ]);

  const pagamentiPerSpesa = new Map<string, { totale: number; pagate: number }>();
  for (const r of ripartizioni ?? []) {
    const voce = pagamentiPerSpesa.get(r.spesa_id) ?? { totale: 0, pagate: 0 };
    voce.totale += 1;
    if (r.stato_pagamento === "pagato") voce.pagate += 1;
    pagamentiPerSpesa.set(r.spesa_id, voce);
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold tracking-tight">Spese</h1>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <div className="w-full lg:w-80 shrink-0 lg:sticky lg:top-24">
          <Card>
            <CardHeader>
              <CardTitle>Nuova spesa</CardTitle>
            </CardHeader>
            <SpesaForm condomini={condomini ?? []} />
          </Card>
        </div>

        <div className="flex-1 min-w-0">
          {spese?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrizione</TableHead>
                  <TableHead>Condominio</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Importo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Pagamenti</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spese.map((s) => {
                  const pagamenti = pagamentiPerSpesa.get(s.id);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        <Link href={`/admin/spese/${s.id}`} className="hover:text-accent">
                          <RowIcon icon={Wallet}>{s.descrizione}</RowIcon>
                        </Link>
                      </TableCell>
                      <TableCell>{s.condominio?.nome}</TableCell>
                      <TableCell>
                        <Badge>{s.categoria}</Badge>
                      </TableCell>
                      <TableCell>{formatValuta(s.importo_totale)}</TableCell>
                      <TableCell>{formatData(s.data_spesa)}</TableCell>
                      <TableCell>
                        {pagamenti ? (
                          <Badge variant={pagamenti.pagate === pagamenti.totale ? "success" : "neutral"}>
                            {pagamenti.pagate}/{pagamenti.totale} pagate
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">non ripartita</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              icon={Wallet}
              title="Nessuna spesa ancora registrata"
              description="Aggiungi la prima spesa dal modulo a sinistra."
            />
          )}
        </div>
      </div>
    </div>
  );
}
