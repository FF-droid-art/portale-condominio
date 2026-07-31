import Link from "next/link";
import { notFound } from "next/navigation";
import { Home, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatValuta, formatData } from "@/lib/format";
import { RigaRipartizione } from "./riga-ripartizione";
import { GeneraRipartizioniButton } from "./genera-ripartizioni-button";
import { DocumentoSpesa } from "./documento-spesa";

export default async function SpesaDettaglioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: spesa } = await supabase
    .from("spese")
    .select("*, condominio:condominio_id(nome)")
    .eq("id", id)
    .single();

  if (!spesa) notFound();

  const [{ data: ripartizioni }, { data: tabelleMillesimali }] = await Promise.all([
    supabase
      .from("ripartizioni")
      .select("*, unita:unita_id(identificativo)")
      .eq("spesa_id", id)
      .order("identificativo", { foreignTable: "unita" }),
    supabase
      .from("tabelle_millesimali")
      .select("id, nome")
      .eq("condominio_id", spesa.condominio_id)
      .order("nome"),
  ]);

  const pagate = (ripartizioni ?? []).filter((r) => r.stato_pagamento === "pagato").length;

  let documentoSignedUrl: string | null = null;
  if (spesa.documento_url) {
    const { data } = await supabase.storage
      .from("documenti-condominio")
      .createSignedUrl(spesa.documento_url, 600);
    documentoSignedUrl = data?.signedUrl ?? null;
  }

  return (
    <div className="flex flex-col gap-8">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={`/admin/condomini/${spesa.condominio_id}`} className="hover:text-accent">
                {spesa.condominio?.nome}
              </Link>
            </p>
            <h1 className="text-3xl font-bold tracking-tight">{spesa.descrizione}</h1>
            <p className="text-sm text-muted-foreground mt-1">{formatData(spesa.data_spesa)}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge>{spesa.categoria}</Badge>
            <p className="text-2xl font-semibold">{formatValuta(spesa.importo_totale)}</p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documento</CardTitle>
        </CardHeader>
        <DocumentoSpesa
          spesaId={spesa.id}
          documentoUrl={spesa.documento_url}
          signedUrl={documentoSignedUrl}
        />
      </Card>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Ripartizione per unità</h2>
          {ripartizioni?.length ? (
            <Badge variant={pagate === ripartizioni.length ? "success" : "neutral"}>
              {pagate}/{ripartizioni.length} pagate
            </Badge>
          ) : null}
        </div>

        {ripartizioni?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unità</TableHead>
                <TableHead>Importo dovuto</TableHead>
                <TableHead>Scadenza</TableHead>
                <TableHead>Pagato il</TableHead>
                <TableHead>Stato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ripartizioni.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <RowIcon icon={Home}>{r.unita?.identificativo}</RowIcon>
                  </TableCell>
                  <TableCell>{formatValuta(r.importo_dovuto)}</TableCell>
                  <TableCell>{r.data_scadenza ? formatData(r.data_scadenza) : "-"}</TableCell>
                  <TableCell>{r.data_pagamento ? formatData(r.data_pagamento) : "-"}</TableCell>
                  <TableCell>
                    <RigaRipartizione ripartizione={r} spesaId={spesa.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={Wallet}
            title="Nessuna ripartizione per questa spesa"
            description="Genera automaticamente una quota per unità, proporzionale ai millesimi di proprietà."
            action={
              <GeneraRipartizioniButton
                spesaId={spesa.id}
                condominioId={spesa.condominio_id}
                importoTotale={spesa.importo_totale}
                tabelleMillesimali={tabelleMillesimali ?? []}
              />
            }
          />
        )}
      </section>
    </div>
  );
}
