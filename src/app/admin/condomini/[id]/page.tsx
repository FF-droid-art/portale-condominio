import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, CalendarClock, Home, Landmark, Ruler, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, StatCard } from "@/components/ui/card";
import { StatoBadge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, RowIcon } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { formatData, formatDataOra, formatMillesimi, formatValuta } from "@/lib/format";
import { ContoCorrenteForm } from "../conto-corrente-form";

export default async function CondominioDettaglioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: condominio } = await supabase.from("condomini").select("*").eq("id", id).single();
  if (!condominio) notFound();

  const [{ data: unita }, { data: assemblee }, { data: spese }] = await Promise.all([
    supabase.from("unita").select("*").eq("condominio_id", id).order("identificativo"),
    supabase
      .from("assemblee")
      .select("id, data_assemblea, tipo, stato")
      .eq("condominio_id", id)
      .order("data_assemblea", { ascending: false }),
    supabase
      .from("spese")
      .select("*, ripartizioni(importo_dovuto, stato_pagamento)")
      .eq("condominio_id", id)
      .order("data_spesa", { ascending: false }),
  ]);

  const adesso = new Date();
  const prossimaAssemblea = (assemblee ?? [])
    .filter((a) => new Date(a.data_assemblea) >= adesso)
    .sort((a, b) => a.data_assemblea.localeCompare(b.data_assemblea))[0];

  const annoCorrente = adesso.getFullYear();
  const speseAnnoCorrente = (spese ?? []).filter(
    (s) => new Date(s.data_spesa).getFullYear() === annoCorrente
  );
  const totaleSpeseAnno = speseAnnoCorrente.reduce((somma, s) => somma + s.importo_totale, 0);
  const totaleNonIncassato = (spese ?? []).reduce((somma, s) => {
    const ripartizioni = (s.ripartizioni ?? []) as { importo_dovuto: number; stato_pagamento: string }[];
    return (
      somma +
      ripartizioni
        .filter((r) => r.stato_pagamento !== "pagato")
        .reduce((sub, r) => sub + r.importo_dovuto, 0)
    );
  }, 0);

  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/admin/condomini"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-accent w-fit"
      >
        <ArrowLeft className="size-4" /> Condomini
      </Link>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              <RowIcon icon={Building2}>{condominio.nome}</RowIcon>
            </h1>
            <p className="text-sm text-muted-foreground pl-10.5">
              {condominio.indirizzo}
              {condominio.codice_fiscale ? ` · ${condominio.codice_fiscale}` : ""}
            </p>
          </div>
          <Link
            href={`/admin/condomini/${condominio.id}/millesimi`}
            className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
          >
            <Ruler className="size-4" /> Tabelle millesimali
          </Link>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Unità" value={unita?.length ?? 0} icon={Home} />
        <StatCard
          label="Prossima assemblea"
          value={prossimaAssemblea ? formatData(prossimaAssemblea.data_assemblea) : "-"}
          icon={CalendarClock}
        />
        <StatCard label="Spese anno corrente" value={formatValuta(totaleSpeseAnno)} icon={Wallet} />
        <StatCard label="Da incassare" value={formatValuta(totaleNonIncassato)} icon={Landmark} />
      </div>

      <div className="grid lg:grid-cols-2 gap-8 items-start">
        <Card>
          <CardHeader>
            <CardTitle>Conto corrente</CardTitle>
          </CardHeader>
          <ContoCorrenteForm condominio={condominio} />
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <CardTitle>Assemblee</CardTitle>
            <Link href="/admin/assemblee" className="text-sm text-accent hover:underline">
              Vedi tutte
            </Link>
          </div>
          {assemblee?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Stato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assemblee.slice(0, 5).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">
                      <Link href={`/admin/assemblee/${a.id}`} className="hover:text-accent">
                        {formatDataOra(a.data_assemblea)}
                      </Link>
                    </TableCell>
                    <TableCell className="capitalize">{a.tipo}</TableCell>
                    <TableCell>
                      <StatoBadge tipo="stato_assemblea" valore={a.stato} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState icon={CalendarClock} title="Nessuna assemblea per questo condominio" />
          )}
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardTitle>Spese recenti</CardTitle>
          <Link href="/admin/spese" className="text-sm text-accent hover:underline">
            Vedi tutte
          </Link>
        </div>
        {spese?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrizione</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Importo</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {spese.slice(0, 5).map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    <Link href={`/admin/spese/${s.id}`} className="hover:text-accent">
                      <RowIcon icon={Wallet}>{s.descrizione}</RowIcon>
                    </Link>
                  </TableCell>
                  <TableCell>{s.categoria}</TableCell>
                  <TableCell>{formatValuta(s.importo_totale)}</TableCell>
                  <TableCell>{formatData(s.data_spesa)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState icon={Wallet} title="Nessuna spesa per questo condominio" />
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardTitle>Unità</CardTitle>
        </div>
        {unita?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Identificativo</TableHead>
                <TableHead>Piano</TableHead>
                <TableHead>Millesimi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unita.map((u) => (
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
          <EmptyState icon={Home} title="Nessuna unità in questo condominio" />
        )}
      </Card>
    </div>
  );
}
