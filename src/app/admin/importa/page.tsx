import { Building2, Home, Wallet, History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
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
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDataOra } from "@/lib/format";
import { AnnullaImportazioneButton } from "@/components/import/annulla-importazione-button";

export default async function ImportaPage() {
  const supabase = await createClient();
  const { data: batch } = await supabase
    .from("import_batches")
    .select("*, condominio:condominio_id(nome)")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Importa dati</h1>
        <p className="text-muted-foreground mt-1">
          Carica in blocco unità e spese storiche invece di inserirle una a
          una. Il legame proprietari-unità resta da collegare a mano quando i
          condòmini si registrano.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>
              <RowIcon icon={Building2}>Importa condomìni e unità</RowIcon>
            </CardTitle>
            <CardDescription>
              Più condomìni in un unico file: quelli nuovi vengono creati in
              automatico, quelli già esistenti riutilizzati.
            </CardDescription>
          </CardHeader>
          <CardFooter className="mt-auto">
            <Button href="/admin/importa/condomini-unita">Inizia</Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <RowIcon icon={Home}>Importa unità</RowIcon>
            </CardTitle>
            <CardDescription>
              Aggiungi unità a un condominio già esistente e già scelto da un file .xlsx/.csv.
            </CardDescription>
          </CardHeader>
          <CardFooter className="mt-auto">
            <Button href="/admin/importa/unita">Inizia</Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <RowIcon icon={Wallet}>Importa spese storiche</RowIcon>
            </CardTitle>
            <CardDescription>
              Spese pluriennali con ripartizione per unità da un file .xlsx/.csv.
            </CardDescription>
          </CardHeader>
          <CardFooter className="mt-auto">
            <Button href="/admin/importa/spese">Inizia</Button>
          </CardFooter>
        </Card>
      </div>

      <div>
        <h2 className="text-xl font-semibold tracking-tight mb-4">
          Importazioni recenti
        </h2>
        {batch?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Condominio</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Righe</TableHead>
                <TableHead>Data</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {batch.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">
                    <RowIcon icon={History}>{b.nome_file}</RowIcon>
                  </TableCell>
                  <TableCell>{b.condominio?.nome ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant={b.tipo === "condomini_unita" ? "accent" : "neutral"}>
                      {b.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell>{b.righe_importate}</TableCell>
                  <TableCell>{formatDataOra(b.created_at)}</TableCell>
                  <TableCell>
                    <AnnullaImportazioneButton batchId={b.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={History}
            title="Nessuna importazione ancora effettuata"
            description="Le importazioni fatte con i moduli qui sopra appariranno qui, con la possibilità di annullarle."
          />
        )}
      </div>
    </div>
  );
}
