import Link from "next/link";
import { ChevronRight, LifeBuoy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { richiedeUtente } from "@/lib/supabase/dal";
import type { Segnalazione } from "@/lib/types";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  RowIcon,
} from "@/components/ui/table";
import { StatoBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDataOra } from "@/lib/format";
import { ETICHETTE_CATEGORIA_SEGNALAZIONE, ordinaSegnalazioni } from "@/lib/segnalazioni";
import { NuovaSegnalazioneForm, type UnitaSegnalabile } from "./nuova-segnalazione-form";

export const metadata = { title: "Segnalazioni" };

type RigaSegnalazione = Segnalazione & {
  condominio: { nome: string } | null;
  unita: { identificativo: string } | null;
};

type LegameUnita = {
  unita: {
    id: string;
    identificativo: string;
    condominio_id: string;
    condominio: { nome: string } | null;
  } | null;
};

export default async function SegnalazioniCondominoPage() {
  const utente = await richiedeUtente();
  const supabase = await createClient();

  const [{ data: legami }, { data: segnalazioniData }] = await Promise.all([
    supabase
      .from("unita_proprietari")
      .select("unita:unita_id(id, identificativo, condominio_id, condominio:condominio_id(nome))")
      .eq("utente_id", utente.id),
    supabase
      .from("segnalazioni")
      .select("*, condominio:condominio_id(nome), unita:unita_id(identificativo)"),
  ]);

  // Una sola voce per unità, anche se il legame è ripetuto (comproprietà,
  // qualifiche multiple sulla stessa unità).
  const unita: UnitaSegnalabile[] = Array.from(
    new Map(
      ((legami ?? []) as unknown as LegameUnita[])
        .map((l) => l.unita)
        .filter((u): u is NonNullable<LegameUnita["unita"]> => Boolean(u))
        .map((u) => [
          u.id,
          {
            id: u.id,
            identificativo: u.identificativo,
            condominio_id: u.condominio_id,
            condominio_nome: u.condominio?.nome ?? "Condominio",
          },
        ])
    ).values()
  );

  const segnalazioni = ordinaSegnalazioni(
    (segnalazioniData ?? []) as unknown as RigaSegnalazione[]
  );

  return (
    <PageBody>
      <PageHeader
        titolo="Segnalazioni"
        descrizione="Guasti e disservizi da far sapere all'amministratore. Qui vedi le tue, quelle sulla tua unità e quelle aperte da altri sulle parti comuni del tuo condominio."
        azioni={<NuovaSegnalazioneForm unita={unita} />}
      />

      {segnalazioni.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Segnalazione</TableHead>
              <TableHead>Dove</TableHead>
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
                    href={`/area-riservata/segnalazioni/${s.id}`}
                    className="rounded transition-colors hover:text-accent-ink"
                  >
                    <RowIcon icon={LifeBuoy}>
                      <span className="flex flex-col">
                        <span>{s.titolo}</span>
                        <span className="text-xs font-normal text-muted-foreground">
                          {ETICHETTE_CATEGORIA_SEGNALAZIONE[s.categoria] ?? s.categoria}
                          {s.aperta_da === utente.id ? "" : " · aperta da un altro condòmino"}
                        </span>
                      </span>
                    </RowIcon>
                  </Link>
                </TableCell>
                <TableCell etichetta="Dove">
                  {s.unita?.identificativo ?? (
                    <span className="text-muted-foreground">Parti comuni</span>
                  )}
                </TableCell>
                <TableCell etichetta="Stato">
                  <StatoBadge tipo="stato_segnalazione" valore={s.stato} />
                </TableCell>
                <TableCell etichetta="Aggiornata">{formatDataOra(s.aggiornata_il)}</TableCell>
                <TableCell className="md:w-10 md:text-right">
                  <Link
                    href={`/area-riservata/segnalazioni/${s.id}`}
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
          description="Un guasto all'ascensore, una perdita nel garage, una lampadina bruciata sulle scale: aprire una segnalazione lascia una traccia che tu e l'amministratore potete seguire."
          action={<NuovaSegnalazioneForm unita={unita} />}
        />
      )}
    </PageBody>
  );
}
