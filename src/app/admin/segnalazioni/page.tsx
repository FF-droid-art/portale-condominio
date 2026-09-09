import Link from "next/link";
import { AlertTriangle, ChevronRight, CircleDot, LifeBuoy, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { richiedeAmministratore } from "@/lib/supabase/dal";
import type { Segnalazione } from "@/lib/types";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { StatoBadge } from "@/components/ui/badge";
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
import {
  contaSegnalazioni,
  ETICHETTE_CATEGORIA_SEGNALAZIONE,
  ordinaSegnalazioni,
} from "@/lib/segnalazioni";

export const metadata = { title: "Segnalazioni" };

type RigaSegnalazione = Segnalazione & {
  condominio: { nome: string } | null;
  unita: { identificativo: string } | null;
  fornitore: { nome: string } | null;
};

export default async function SegnalazioniAdminPage() {
  await richiedeAmministratore();
  const supabase = await createClient();

  const { data } = await supabase
    .from("segnalazioni")
    .select(
      "*, condominio:condominio_id(nome), unita:unita_id(identificativo), fornitore:fornitore_id(nome)"
    );

  const segnalazioni = ordinaSegnalazioni((data ?? []) as unknown as RigaSegnalazione[]);
  const conteggi = contaSegnalazioni(segnalazioni);

  return (
    <PageBody>
      <PageHeader
        titolo="Segnalazioni"
        descrizione="I guasti e i disservizi aperti dai condòmini, sulla propria unità o sulle parti comuni. Prendile in carico, assegnale a un fornitore e tieni aggiornato chi le ha aperte."
      />

      <StatGrid colonne={3}>
        <StatCard
          label="Aperte"
          value={conteggi.aperte}
          icon={CircleDot}
          tono={conteggi.aperte > 0 ? "warning" : "success"}
          hint="ancora da prendere in carico"
        />
        <StatCard
          label="In corso"
          value={conteggi.inCorso}
          icon={Wrench}
          hint="lavorazione avviata"
        />
        <StatCard
          label="Urgenti"
          value={conteggi.urgenti}
          icon={AlertTriangle}
          tono={conteggi.urgenti > 0 ? "danger" : "neutral"}
          hint="priorità alta, non ancora chiuse"
        />
      </StatGrid>

      {segnalazioni.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Segnalazione</TableHead>
              <TableHead>Condominio</TableHead>
              <TableHead>Dove</TableHead>
              <TableHead>Assegnata a</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>Aggiornata</TableHead>
              <TableHead>
                <span className="sr-only">Apri</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {segnalazioni.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/admin/segnalazioni/${s.id}`}
                    className="rounded transition-colors hover:text-accent-ink"
                  >
                    <RowIcon icon={LifeBuoy}>
                      <span className="flex flex-col">
                        <span>{s.titolo}</span>
                        <span className="text-xs font-normal text-muted-foreground">
                          {ETICHETTE_CATEGORIA_SEGNALAZIONE[s.categoria] ?? s.categoria}
                        </span>
                      </span>
                    </RowIcon>
                  </Link>
                </TableCell>
                <TableCell etichetta="Condominio">{s.condominio?.nome ?? <Vuoto />}</TableCell>
                <TableCell etichetta="Dove">
                  {s.unita?.identificativo ?? (
                    <span className="text-muted-foreground">Parti comuni</span>
                  )}
                </TableCell>
                <TableCell etichetta="Assegnata a">{s.fornitore?.nome ?? <Vuoto />}</TableCell>
                <TableCell etichetta="Stato">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <StatoBadge tipo="stato_segnalazione" valore={s.stato} />
                    {s.priorita === "alta" && s.stato !== "chiusa" && (
                      <StatoBadge tipo="priorita_segnalazione" valore={s.priorita} />
                    )}
                  </span>
                </TableCell>
                <TableCell etichetta="Aggiornata">{formatDataOra(s.aggiornata_il)}</TableCell>
                <TableCell className="md:w-10 md:text-right">
                  <Link
                    href={`/admin/segnalazioni/${s.id}`}
                    className="inline-flex items-center gap-1 rounded text-sm font-medium text-accent-ink hover:underline"
                  >
                    Apri
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          icon={LifeBuoy}
          title="Nessuna segnalazione"
          description="Quando un condòmino aprirà una segnalazione dalla sua area riservata la troverai qui, con la priorità più alta in cima."
        />
      )}
    </PageBody>
  );
}
