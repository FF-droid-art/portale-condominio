import { Home, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { richiedeUtente } from "@/lib/supabase/dal";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, RowIcon } from "@/components/ui/table";
import { StatoBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatValuta, formatData, formatMillesimi } from "@/lib/format";
import { PagamentoButton } from "./pagamento-button";

type UnitaPosseduta = {
  quota_possesso: number;
  unita: {
    id: string;
    identificativo: string;
    piano: string | null;
    millesimi_proprieta: number;
    condominio: { nome: string } | null;
  } | null;
};

type Ripartizione = {
  id: string;
  importo_dovuto: number;
  stato_pagamento: string;
  data_scadenza: string | null;
  codice_avviso: string | null;
  spesa: { descrizione: string; categoria: string } | null;
};

export default async function AreaRiservataPage() {
  const utente = await richiedeUtente();
  const supabase = await createClient();

  const { data } = await supabase
    .from("unita_proprietari")
    .select(
      "quota_possesso, unita:unita_id(id, identificativo, piano, millesimi_proprieta, condominio:condominio_id(nome))"
    )
    .eq("utente_id", utente.id);
  const unitaPossedute = (data ?? []) as unknown as UnitaPosseduta[];

  const unitaIds = unitaPossedute
    .map((r) => r.unita?.id)
    .filter((id): id is string => Boolean(id));

  let ripartizioni: Ripartizione[] = [];
  if (unitaIds.length) {
    const { data: dataRipartizioni } = await supabase
      .from("ripartizioni")
      .select(
        "id, importo_dovuto, stato_pagamento, data_scadenza, codice_avviso, spesa:spesa_id(descrizione, categoria)"
      )
      .in("unita_id", unitaIds)
      .order("data_scadenza", { ascending: true });
    ripartizioni = (dataRipartizioni ?? []) as unknown as Ripartizione[];
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold tracking-tight">
        Bentornato, {utente.nome}
      </h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Le tue unità</h2>
        {!unitaPossedute.length ? (
          <EmptyState
            icon={Home}
            title="Nessuna unità collegata"
            description="Nessuna unità immobiliare è ancora collegata al tuo account."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {unitaPossedute.map((riga, i) => {
              const u = riga.unita;
              return (
                <Card key={i} className="gap-1">
                  <p className="font-medium">{u?.identificativo}</p>
                  <p className="text-sm text-muted-foreground">
                    {u?.condominio?.nome} · Piano {u?.piano ?? "-"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Millesimi:{" "}
                    {u ? formatMillesimi(u.millesimi_proprieta) : "-"} · Quota
                    tua: {riga.quota_possesso}%
                  </p>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Spese e ripartizioni</h2>
        {!ripartizioni.length ? (
          <EmptyState
            icon={Wallet}
            title="Nessuna spesa a tuo carico"
            description="Quando l'amministratore registrerà una spesa a tuo carico, la vedrai qui."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrizione</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Importo</TableHead>
                <TableHead>Scadenza</TableHead>
                <TableHead>Codice avviso</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ripartizioni.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <RowIcon icon={Wallet}>{r.spesa?.descrizione}</RowIcon>
                  </TableCell>
                  <TableCell>{r.spesa?.categoria}</TableCell>
                  <TableCell>{formatValuta(r.importo_dovuto)}</TableCell>
                  <TableCell>
                    {r.data_scadenza ? formatData(r.data_scadenza) : "-"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.codice_avviso ?? "-"}</TableCell>
                  <TableCell>
                    <StatoBadge tipo="stato_pagamento" valore={r.stato_pagamento} />
                  </TableCell>
                  <TableCell>
                    {r.stato_pagamento !== "pagato" && <PagamentoButton ripartizioneId={r.id} />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
