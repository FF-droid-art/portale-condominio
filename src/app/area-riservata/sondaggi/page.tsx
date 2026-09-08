import Link from "next/link";
import { ChevronRight, MessagesSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { richiedeUtente } from "@/lib/supabase/dal";
import type { Sondaggio } from "@/lib/types";
import { PageBody, PageHeader } from "@/components/ui/page-header";
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
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDataOra } from "@/lib/format";
import { motivoChiusura } from "@/lib/sondaggi";

export const metadata = { title: "Sondaggi" };

type RigaSondaggio = Sondaggio & { condominio: { nome: string } | null };

export default async function SondaggiCondominoPage() {
  const utente = await richiedeUtente();
  const supabase = await createClient();

  const { data: sondaggiData } = await supabase
    .from("sondaggi")
    .select("*, condominio:condominio_id(nome)")
    .order("created_at", { ascending: false });

  const sondaggi = (sondaggiData ?? []) as unknown as RigaSondaggio[];

  // Quali ho già votato: basta sapere se esiste almeno una mia risposta per
  // sondaggio, il dettaglio sta nella pagina del singolo sondaggio.
  const { data: risposte } = await supabase
    .from("sondaggio_risposte")
    .select("sondaggio_id")
    .eq("utente_id", utente.id);
  const giaRisposti = new Set((risposte ?? []).map((r) => r.sondaggio_id));

  return (
    <PageBody>
      <PageHeader
        titolo="Sondaggi"
        descrizione="Le consultazioni rapide proposte dall'amministratore. Non sono votazioni assembleari: servono a far sapere come la pensi prima che un tema arrivi in assemblea."
      />

      {sondaggi.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Domanda</TableHead>
              <TableHead>Condominio</TableHead>
              <TableHead>Scadenza</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>
                <span className="sr-only">Apri</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sondaggi.map((s) => {
              const chiusura = motivoChiusura(s);
              const risposto = giaRisposti.has(s.id);
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/area-riservata/sondaggi/${s.id}`}
                      className="rounded transition-colors hover:text-accent-ink"
                    >
                      <RowIcon icon={MessagesSquare}>{s.domanda}</RowIcon>
                    </Link>
                  </TableCell>
                  <TableCell etichetta="Condominio">{s.condominio?.nome ?? <Vuoto />}</TableCell>
                  <TableCell etichetta="Scadenza">
                    {s.scadenza ? formatDataOra(s.scadenza) : <Vuoto />}
                  </TableCell>
                  <TableCell etichetta="Stato">
                    {chiusura !== null ? (
                      <Badge variant="neutral" punto>
                        {chiusura === "scaduto" ? "Scaduto" : "Chiuso"}
                      </Badge>
                    ) : risposto ? (
                      <Badge variant="success" punto>
                        Hai risposto
                      </Badge>
                    ) : (
                      <Badge variant="warning" punto>
                        Da rispondere
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="md:w-10 md:text-right">
                    <Link
                      href={`/area-riservata/sondaggi/${s.id}`}
                      className="inline-flex items-center gap-1 rounded text-sm font-medium text-accent-ink hover:underline"
                    >
                      Apri
                      <ChevronRight className="size-4" aria-hidden="true" />
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          icon={MessagesSquare}
          title="Nessun sondaggio"
          description="Quando l'amministratore aprirà una consultazione per il tuo condominio la troverai qui."
        />
      )}
    </PageBody>
  );
}
