import Link from "next/link";
import { notFound } from "next/navigation";
import { Home, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import {
  Card,
  CardHeader,
  CardHeaderText,
  CardTitle,
  CardDescription,
  Section,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
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

  const righe = ripartizioni ?? [];
  const pagate = righe.filter((r) => r.stato_pagamento === "pagato").length;
  const totaleRipartito = righe.reduce((somma, r) => somma + r.importo_dovuto, 0);
  const incassato = righe
    .filter((r) => r.stato_pagamento === "pagato")
    .reduce((somma, r) => somma + r.importo_dovuto, 0);

  let documentoSignedUrl: string | null = null;
  if (spesa.documento_url) {
    const { data } = await supabase.storage
      .from("documenti-condominio")
      .createSignedUrl(spesa.documento_url, 600);
    documentoSignedUrl = data?.signedUrl ?? null;
  }

  return (
    <PageBody>
      <PageHeader
        indietro={{ href: "/admin/spese", label: "Spese" }}
        eyebrow={
          <Link
            href={`/admin/condomini/${spesa.condominio_id}`}
            className="rounded hover:text-accent-ink"
          >
            {spesa.condominio?.nome}
          </Link>
        }
        titolo={spesa.descrizione}
        descrizione={
          <>
            {formatData(spesa.data_spesa)}
            {spesa.fornitore ? ` · ${spesa.fornitore}` : ""}
          </>
        }
        meta={<Badge variant="outline">{spesa.categoria}</Badge>}
      />

      <StatGrid colonne={3}>
        <StatCard label="Importo totale" value={formatValuta(spesa.importo_totale)} icon={Wallet} />
        <StatCard
          label="Ripartito fra le unità"
          value={formatValuta(totaleRipartito)}
          icon={Home}
          hint={
            righe.length
              ? `${righe.length} ${righe.length === 1 ? "quota" : "quote"}`
              : "ripartizione non ancora generata"
          }
        />
        <StatCard
          label="Incassato"
          value={formatValuta(incassato)}
          tono={righe.length && pagate === righe.length ? "success" : "warning"}
          hint={righe.length ? `${pagate} di ${righe.length} quote pagate` : "nessuna quota"}
        />
      </StatGrid>

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <Section
            titolo="Ripartizione per unità"
            descrizione={
              righe.length
                ? "Segna qui i pagamenti che ricevi fuori dal portale (bonifico, contanti). Le quote pagate con carta si aggiornano da sole."
                : undefined
            }
            azioni={
              righe.length ? (
                <Badge variant={pagate === righe.length ? "success" : "warning"} punto>
                  <span className="cifre">
                    {pagate}/{righe.length}
                  </span>{" "}
                  pagate
                </Badge>
              ) : undefined
            }
          >
            {righe.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unità</TableHead>
                    <TableHead numeric>Importo dovuto</TableHead>
                    <TableHead>Scadenza</TableHead>
                    <TableHead>Pagato il</TableHead>
                    <TableHead>Stato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {righe.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        <RowIcon icon={Home}>{r.unita?.identificativo}</RowIcon>
                      </TableCell>
                      <TableCell etichetta="Importo dovuto" numeric className="font-semibold">
                        {formatValuta(r.importo_dovuto)}
                      </TableCell>
                      <TableCell etichetta="Scadenza">
                        {r.data_scadenza ? formatData(r.data_scadenza) : <Vuoto />}
                      </TableCell>
                      <TableCell etichetta="Pagato il">
                        {r.data_pagamento ? formatData(r.data_pagamento) : <Vuoto />}
                      </TableCell>
                      <TableCell etichetta="Stato">
                        <RigaRipartizione
                          ripartizione={r}
                          spesaId={spesa.id}
                          etichettaUnita={r.unita?.identificativo}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                icon={Wallet}
                title="Ripartizione non ancora generata"
                description="Distribuisci l'importo totale fra le unità del condominio in proporzione ai millesimi. Potrai comunque correggere gli stati di pagamento uno per uno."
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
          </Section>
        </div>

        <Card>
          <CardHeader>
            <CardHeaderText>
              <CardTitle>Documento</CardTitle>
              <CardDescription>
                La fattura o la ricevuta collegata a questa spesa.
              </CardDescription>
            </CardHeaderText>
          </CardHeader>
          <DocumentoSpesa
            spesaId={spesa.id}
            documentoUrl={spesa.documento_url}
            signedUrl={documentoSignedUrl}
          />
        </Card>
      </div>
    </PageBody>
  );
}
