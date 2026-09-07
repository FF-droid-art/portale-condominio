import { Building2, FileSpreadsheet, History, Home, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Card, Section } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { EmptyState } from "@/components/ui/empty-state";
import { formatDataOra } from "@/lib/format";
import { AnnullaImportazioneButton } from "@/components/import/annulla-importazione-button";

export const metadata = { title: "Importa dati" };

const ETICHETTA_TIPO_BATCH: Record<string, string> = {
  condomini_unita: "Condomìni e unità",
  unita: "Unità",
  spese: "Spese storiche",
};

const PERCORSI = [
  {
    href: "/admin/importa/condomini-unita",
    icon: Building2,
    titolo: "Condomìni e unità",
    descrizione:
      "Più condomìni in un unico file, con unità, occupanti e tabelle millesimali. I condomìni già esistenti vengono riutilizzati, gli altri creati automaticamente.",
    consigliato: true,
  },
  {
    href: "/admin/importa/unita",
    icon: Home,
    titolo: "Solo unità",
    descrizione:
      "Aggiungi unità a un condominio che hai già creato, scegliendolo prima di caricare il file.",
  },
  {
    href: "/admin/importa/spese",
    icon: Wallet,
    titolo: "Spese storiche",
    descrizione:
      "Spese di anni passati già ripartite per unità: una riga per ogni quota. Le unità devono esistere già.",
  },
];

export default async function ImportaPage() {
  const supabase = await createClient();
  const { data: batch } = await supabase
    .from("import_batches")
    .select("*, condominio:condominio_id(nome)")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <PageBody>
      <PageHeader
        titolo="Importa dati"
        descrizione="Porta nel portale i dati che gestisci già in Excel, invece di reinserirli a mano. Ogni importazione mostra un'anteprima prima di scrivere qualsiasi cosa, e può essere annullata dopo."
      />

      <Section titolo="Che cosa vuoi importare?">
        <div className="grid gap-4 md:grid-cols-3">
          {PERCORSI.map((percorso) => {
            const Icona = percorso.icon;
            return (
              <Card key={percorso.href} className="gap-4">
                <div className="flex items-start justify-between gap-3">
                  <span
                    className="grid size-10 place-items-center rounded-xl bg-accent-subtle text-accent-ink"
                    aria-hidden="true"
                  >
                    <Icona className="size-5" />
                  </span>
                  {percorso.consigliato && <Badge variant="accent">Più completo</Badge>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <h3 className="font-semibold tracking-tight">{percorso.titolo}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {percorso.descrizione}
                  </p>
                </div>
                <div className="mt-auto pt-2">
                  <Button href={percorso.href} variant="secondary" full>
                    Inizia
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </Section>

      <Section
        titolo="Importazioni recenti"
        descrizione="Le ultime venti importazioni. Annullarne una rimuove i dati che aveva creato."
      >
        {batch?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Condominio</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead numeric>Righe</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>
                  <span className="sr-only">Azioni</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batch.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">
                    <RowIcon icon={History}>{b.nome_file}</RowIcon>
                  </TableCell>
                  <TableCell etichetta="Condominio">
                    {b.condominio?.nome ?? <Vuoto />}
                  </TableCell>
                  <TableCell etichetta="Tipo">
                    <Badge variant={b.tipo === "condomini_unita" ? "accent" : "outline"}>
                      {ETICHETTA_TIPO_BATCH[b.tipo] ?? b.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell etichetta="Righe" numeric>
                    {b.righe_importate}
                  </TableCell>
                  <TableCell etichetta="Data">{formatDataOra(b.created_at)}</TableCell>
                  <TableCell className="md:text-right">
                    <AnnullaImportazioneButton batchId={b.id} nomeFile={b.nome_file} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={FileSpreadsheet}
            title="Nessuna importazione effettuata"
            description="Le importazioni fatte con i percorsi qui sopra compariranno in questo elenco, con la possibilità di annullarle."
          />
        )}
      </Section>
    </PageBody>
  );
}
