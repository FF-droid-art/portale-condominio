import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, CalendarClock, Home, Landmark, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, StatCard } from "@/components/ui/card";
import { StatoBadge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, RowIcon } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { formatData, formatDataOra, formatMillesimi, formatValuta } from "@/lib/format";
import { haQuota } from "@/lib/ruoli";
import { ContoCorrenteForm } from "../conto-corrente-form";
import { ModificaCondominioButton } from "./modifica-condominio-button";
import { TrasferisciCondominioButton } from "./trasferisci-condominio-button";
import { EliminaCondominioButton } from "./elimina-condominio-button";
import { NuovaUnitaForm } from "./nuova-unita-form";
import { AvvisoForm } from "./avviso-form";

const ETICHETTA_TIPO: Record<string, string> = {
  proprietario: "Proprietario",
  nudo_proprietario: "Nudo proprietario",
  usufruttuario: "Usufruttuario",
  conduttore: "Conduttore",
  comodatario: "Comodatario",
  assegnatario: "Assegnatario",
};

type OccupanteUnita = {
  quota_possesso: number;
  tipo_soggetto: string;
  attivo: boolean;
  anagrafiche: { nominativo: string } | null;
};

type UnitaConOccupanti = {
  id: string;
  identificativo: string;
  millesimi_proprieta: number;
  unita_proprietari: OccupanteUnita[] | null;
};

type RigaUnita = {
  unita: UnitaConOccupanti;
  occupante: OccupanteUnita | null;
  primo: boolean;
};

export default async function CondominioDettaglioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: condominio } = await supabase.from("condomini").select("*").eq("id", id).single();
  if (!condominio) notFound();

  const [
    { data: unita },
    { data: assemblee },
    { data: spese },
    { data: tabelleMillesimi },
    { data: anagraficheEmail },
  ] = await Promise.all([
    supabase
      .from("unita")
      .select(
        "*, unita_proprietari(quota_possesso, tipo_soggetto, attivo, anagrafiche(nominativo)), valori_millesimali(valore, tabella_id)"
      )
      .eq("condominio_id", id)
      .order("identificativo"),
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
    supabase.from("tabelle_millesimali").select("id, nome").eq("condominio_id", id),
    supabase.from("anagrafiche").select("email").eq("condominio_id", id),
  ]);

  const destinatariAvvisi = new Set(
    (anagraficheEmail ?? []).map((a) => a.email as string | null).filter((e): e is string => !!e)
  ).size;

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

  // Una riga per (unità × occupante attivo). Le unità senza occupanti
  // producono comunque una riga (nominativo "—"). L'identificativo e i
  // millesimi si mostrano solo sulla prima riga di ciascuna unità.
  const righeUnita = (unita ?? []).flatMap((u): RigaUnita[] => {
    const occupanti = ((u.unita_proprietari ?? []) as OccupanteUnita[]).filter(
      (o) => o.attivo && o.anagrafiche
    );
    if (occupanti.length === 0) return [{ unita: u, occupante: null, primo: true }];
    return occupanti.map((o, i) => ({ unita: u, occupante: o, primo: i === 0 }));
  });

  // Colonne millesimi dinamiche: una per tabella millesimale con almeno un
  // valore (le tabelle vuote non compaiono). Ordine: "Generali" per prima.
  const valoriPerUnita = new Map<string, Map<string, number>>();
  for (const u of unita ?? []) {
    const m = new Map<string, number>();
    for (const v of (u.valori_millesimali ?? []) as { valore: number; tabella_id: string }[]) {
      if (v.valore != null) m.set(v.tabella_id, v.valore);
    }
    valoriPerUnita.set(u.id, m);
  }
  const tabelle = (tabelleMillesimi ?? []) as { id: string; nome: string }[];
  const colonneMill = tabelle
    .filter((t) => [...valoriPerUnita.values()].some((m) => m.has(t.id)))
    .sort((a, b) =>
      a.nome === "Generali" ? -1 : b.nome === "Generali" ? 1 : a.nome.localeCompare(b.nome)
    );
  // Se non ci sono ancora tabelle importate, si mostra il singolo millesimo
  // "generale" dell'unità (comportamento precedente).
  const mostraFallbackMill = colonneMill.length === 0;

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
          <div className="flex items-center gap-4">
            <ModificaCondominioButton
              id={condominio.id}
              nome={condominio.nome}
              indirizzo={condominio.indirizzo}
              codiceFiscale={condominio.codice_fiscale ?? null}
            />
            <TrasferisciCondominioButton />
            <EliminaCondominioButton id={condominio.id} nome={condominio.nome} />
          </div>
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

      <Card>
        <CardHeader>
          <CardTitle>Avvisi ai condòmini</CardTitle>
        </CardHeader>
        <AvvisoForm condominioId={condominio.id} destinatari={destinatariAvvisi} />
      </Card>

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
        <CardHeader>
          <CardTitle>Nuova unità</CardTitle>
        </CardHeader>
        <NuovaUnitaForm condominioId={condominio.id} tabelle={colonneMill} />
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardTitle>Unità e occupanti</CardTitle>
        </div>
        {unita?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unità</TableHead>
                <TableHead>Nominativo</TableHead>
                <TableHead>Qualifica</TableHead>
                <TableHead>Quota</TableHead>
                {mostraFallbackMill ? (
                  <TableHead>Millesimi</TableHead>
                ) : (
                  colonneMill.map((t) => (
                    <TableHead key={t.id}>Millesimi {t.nome}</TableHead>
                  ))
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {righeUnita.map((r, i) => (
                <TableRow key={`${r.unita.id}-${i}`}>
                  <TableCell className="font-medium">
                    {r.primo && (
                      <Link href={`/admin/unita/${r.unita.id}`} className="hover:text-accent">
                        <RowIcon icon={Home}>{r.unita.identificativo}</RowIcon>
                      </Link>
                    )}
                  </TableCell>
                  <TableCell>{r.occupante?.anagrafiche?.nominativo ?? "—"}</TableCell>
                  <TableCell>
                    {r.occupante
                      ? ETICHETTA_TIPO[r.occupante.tipo_soggetto] ?? r.occupante.tipo_soggetto
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {r.occupante &&
                    haQuota(r.occupante.tipo_soggetto) &&
                    r.occupante.quota_possesso !== 100
                      ? `${r.occupante.quota_possesso}%`
                      : "—"}
                  </TableCell>
                  {mostraFallbackMill ? (
                    <TableCell>
                      {r.primo ? formatMillesimi(r.unita.millesimi_proprieta) : ""}
                    </TableCell>
                  ) : (
                    colonneMill.map((t) => {
                      const v = valoriPerUnita.get(r.unita.id)?.get(t.id);
                      return (
                        <TableCell key={t.id}>
                          {r.primo ? (v != null ? formatMillesimi(v) : "—") : ""}
                        </TableCell>
                      );
                    })
                  )}
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
