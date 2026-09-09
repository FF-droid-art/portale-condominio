import { Download, FileText, FolderOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { richiedeUtente } from "@/lib/supabase/dal";
import type { DocumentoCondominio } from "@/lib/types";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/card";
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
import { Button } from "@/components/ui/button";
import { formatData } from "@/lib/format";
import {
  ETICHETTE_CATEGORIA_DOCUMENTO,
  estensione,
  formatDimensione,
  indiceCategoria,
} from "@/lib/archivio";

export const metadata = { title: "Documenti" };

type RigaDocumento = DocumentoCondominio & { condominio: { nome: string } | null };

export default async function DocumentiCondominoPage() {
  await richiedeUtente();
  const supabase = await createClient();

  // Nessun filtro esplicito sul condominio: la policy "documenti_condominio_select"
  // restituisce già i soli documenti degli stabili a cui l'utente appartiene.
  const { data } = await supabase
    .from("documenti_condominio")
    .select("*, condominio:condominio_id(nome)")
    .order("created_at", { ascending: false });

  const documenti = (data ?? []) as unknown as RigaDocumento[];

  const percorsi = documenti.map((d) => d.percorso);
  const urlPerPercorso = new Map<string, string>();
  if (percorsi.length) {
    const { data: firmati } = await supabase.storage
      .from("documenti-condominio")
      .createSignedUrls(percorsi, 600);
    for (const f of firmati ?? []) {
      if (f.path && f.signedUrl) urlPerPercorso.set(f.path, f.signedUrl);
    }
  }

  const perCondominio = new Map<string, { nome: string; documenti: RigaDocumento[] }>();
  for (const d of documenti) {
    const gruppo = perCondominio.get(d.condominio_id) ?? {
      nome: d.condominio?.nome ?? "Il tuo condominio",
      documenti: [],
    };
    gruppo.documenti.push(d);
    perCondominio.set(d.condominio_id, gruppo);
  }
  for (const gruppo of perCondominio.values()) {
    gruppo.documenti.sort(
      (a, b) =>
        indiceCategoria(a.categoria) - indiceCategoria(b.categoria) ||
        a.titolo.localeCompare(b.titolo, "it")
    );
  }

  const unicoCondominio = perCondominio.size <= 1;

  return (
    <PageBody>
      <PageHeader
        titolo="Documenti"
        descrizione="I documenti del tuo condominio messi a disposizione dall'amministratore: regolamento, planimetrie, polizze, bilanci."
      />

      {documenti.length ? (
        [...perCondominio.entries()].map(([condominioId, gruppo]) => (
          <Section key={condominioId} titolo={unicoCondominio ? undefined : gruppo.nome}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead numeric>Dimensione</TableHead>
                  <TableHead>Aggiornato</TableHead>
                  <TableHead>
                    <span className="sr-only">Scarica</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gruppo.documenti.map((d) => {
                  const url = urlPerPercorso.get(d.percorso);
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">
                        <RowIcon icon={FileText}>
                          <span className="flex flex-col">
                            <span className="flex flex-wrap items-center gap-2">
                              {d.titolo}
                              <Badge variant="outline">{estensione(d.nome_file)}</Badge>
                            </span>
                            {d.descrizione && (
                              <span className="text-xs font-normal text-muted-foreground">
                                {d.descrizione}
                              </span>
                            )}
                          </span>
                        </RowIcon>
                      </TableCell>
                      <TableCell etichetta="Categoria">
                        {ETICHETTE_CATEGORIA_DOCUMENTO[d.categoria] ?? d.categoria}
                      </TableCell>
                      <TableCell etichetta="Dimensione" numeric>
                        {formatDimensione(d.dimensione_byte)}
                      </TableCell>
                      <TableCell etichetta="Aggiornato">{formatData(d.created_at)}</TableCell>
                      <TableCell className="md:text-right">
                        {url ? (
                          <Button
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="secondary"
                            size="sm"
                          >
                            <Download className="size-4" aria-hidden="true" />
                            Scarica
                          </Button>
                        ) : (
                          <Vuoto />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Section>
        ))
      ) : (
        <EmptyState
          icon={FolderOpen}
          title="Nessun documento disponibile"
          description="Quando l'amministratore caricherà il regolamento, le planimetrie o le polizze del tuo condominio li troverai qui."
        />
      )}
    </PageBody>
  );
}
