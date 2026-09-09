import Link from "next/link";
import { FileText, FolderOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { richiedeAmministratore } from "@/lib/supabase/dal";
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
import { DocumentoForm } from "./documento-form";
import { AzioniDocumento } from "./azioni-documento";

export const metadata = { title: "Documenti" };

type RigaDocumento = DocumentoCondominio & { condominio: { nome: string } | null };

export default async function DocumentiAdminPage() {
  await richiedeAmministratore();
  const supabase = await createClient();

  const [{ data: condominiData }, { data: documentiData }] = await Promise.all([
    supabase.from("condomini").select("id, nome").order("nome"),
    supabase
      .from("documenti_condominio")
      .select("*, condominio:condominio_id(nome)")
      .order("created_at", { ascending: false }),
  ]);

  const condomini = condominiData ?? [];
  const documenti = (documentiData ?? []) as unknown as RigaDocumento[];

  // Un URL firmato per ciascun documento, chiesti in un colpo solo: il bucket è
  // privato, quindi senza firma il collegamento non aprirebbe nulla.
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

  // Un blocco per condominio: l'archivio si consulta sempre "di uno stabile",
  // mai in ordine cronologico globale.
  const perCondominio = new Map<string, { nome: string; documenti: RigaDocumento[] }>();
  for (const d of documenti) {
    const gruppo = perCondominio.get(d.condominio_id) ?? {
      nome: d.condominio?.nome ?? "Condominio",
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

  return (
    <PageBody>
      <PageHeader
        titolo="Documenti"
        descrizione="L'archivio di ogni condominio: regolamento, planimetrie, polizze, bilanci storici. Li carichi tu, li scaricano i condòmini di quello stabile dalla loro area riservata."
        azioni={<DocumentoForm condomini={condomini} />}
      />

      {documenti.length ? (
        [...perCondominio.entries()].map(([condominioId, gruppo]) => (
          <Section
            key={condominioId}
            titolo={
              <Link
                href={`/admin/condomini/${condominioId}`}
                className="rounded hover:text-accent-ink"
              >
                {gruppo.nome}
              </Link>
            }
            descrizione={`${gruppo.documenti.length} ${
              gruppo.documenti.length === 1 ? "documento" : "documenti"
            } in archivio.`}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead numeric>Dimensione</TableHead>
                  <TableHead>Caricato il</TableHead>
                  <TableHead>
                    <span className="sr-only">Azioni</span>
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
                              {url ? (
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded transition-colors hover:text-accent-ink"
                                >
                                  {d.titolo}
                                </a>
                              ) : (
                                d.titolo
                              )}
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
                      <TableCell etichetta="Caricato il">{formatData(d.created_at)}</TableCell>
                      <TableCell className="md:text-right">
                        <span className="flex items-center justify-end gap-1">
                          {url ? (
                            <Button
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              variant="ghost"
                              size="sm"
                            >
                              Apri
                            </Button>
                          ) : (
                            <Vuoto />
                          )}
                          <AzioniDocumento documento={d} />
                        </span>
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
          title="Archivio vuoto"
          description={
            condomini.length
              ? "Carica il regolamento, le planimetrie, la polizza dello stabile: i condòmini smetteranno di chiederteli per email."
              : "Crea prima un condominio: ogni documento appartiene a uno stabile."
          }
          action={condomini.length ? <DocumentoForm condomini={condomini} /> : undefined}
        />
      )}
    </PageBody>
  );
}
