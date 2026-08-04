import Link from "next/link";
import { Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { NuovoCondominioBox } from "./nuovo-condominio-box";
import { RowIcon } from "@/components/ui/table";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export default async function CondominiPage() {
  const supabase = await createClient();
  const [{ data: condomini }, { data: unita }] = await Promise.all([
    supabase.from("condomini").select("*").order("created_at", { ascending: false }),
    supabase.from("unita").select("condominio_id"),
  ]);

  const conteggioUnita = new Map<string, number>();
  for (const u of unita ?? []) {
    conteggioUnita.set(u.condominio_id, (conteggioUnita.get(u.condominio_id) ?? 0) + 1);
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
            <NuovoCondominioBox />
          </Card>
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {condomini?.length ? (
            condomini.map((c) => (
              <Link key={c.id} href={`/admin/condomini/${c.id}`} className="block">
                <Card className="gap-2 transition-colors hover:border-border-strong">
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
                    <Badge variant="neutral">{conteggioUnita.get(c.id) ?? 0} unità</Badge>
                  </div>
                </Card>
              </Link>
            ))
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
