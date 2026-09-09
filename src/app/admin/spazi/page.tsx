import Link from "next/link";
import { CalendarRange, DoorOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { richiedeAmministratore } from "@/lib/supabase/dal";
import type { SpazioComune } from "@/lib/types";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import {
  Card,
  CardHeader,
  CardHeaderText,
  CardTitle,
  CardDescription,
  Section,
} from "@/components/ui/card";
import { Badge, StatoBadge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { formatData } from "@/lib/format";
import { adessoLocale } from "@/lib/fuso";
import { formattaFascia, giornoDi, normalizzaIstante } from "@/lib/prenotazioni";
import { SpazioForm } from "./spazio-form";
import { AzioniSpazio } from "./azioni-spazio";
import { AnnullaPrenotazioneButton } from "./annulla-prenotazione-button";

export const metadata = { title: "Spazi comuni" };

type RigaSpazio = SpazioComune & { condominio: { nome: string } | null };

type RigaPrenotazione = {
  id: string;
  spazio_id: string;
  inizio: string;
  fine: string;
  note: string | null;
  stato: string;
  unita: { identificativo: string } | null;
  utente: { nome: string; cognome: string } | null;
};

export default async function SpaziAdminPage() {
  await richiedeAmministratore();
  const supabase = await createClient();

  const [{ data: condominiData }, { data: spaziData }, { data: prenotazioniData }] =
    await Promise.all([
      supabase.from("condomini").select("id, nome").order("nome"),
      supabase
        .from("spazi_comuni")
        .select("*, condominio:condominio_id(nome)")
        .order("nome"),
      supabase
        .from("prenotazioni_spazi")
        .select(
          "id, spazio_id, inizio, fine, note, stato, unita:unita_id(identificativo), utente:utente_id(nome, cognome)"
        )
        .order("inizio"),
    ]);

  const condomini = condominiData ?? [];
  const spazi = (spaziData ?? []) as unknown as RigaSpazio[];
  const prenotazioni = (prenotazioniData ?? []) as unknown as RigaPrenotazione[];

  const adesso = adessoLocale();
  const future = prenotazioni.filter(
    (p) => p.stato === "confermata" && normalizzaIstante(p.fine) >= adesso
  );

  const futurePerSpazio = new Map<string, RigaPrenotazione[]>();
  for (const p of future) {
    const elenco = futurePerSpazio.get(p.spazio_id) ?? [];
    elenco.push(p);
    futurePerSpazio.set(p.spazio_id, elenco);
  }

  return (
    <PageBody>
      <PageHeader
        titolo="Spazi comuni"
        descrizione="Sala condominiale, posti auto per gli ospiti, lavanderia: definisci che cosa è prenotabile, in quali orari e da quante persone alla volta. Il portale rifiuta da sé le sovrapposizioni."
        azioni={<SpazioForm condomini={condomini} />}
      />

      {spazi.length ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {spazi.map((spazio) => {
            const prossime = futurePerSpazio.get(spazio.id) ?? [];
            return (
              <Card key={spazio.id}>
                <CardHeader>
                  <CardHeaderText>
                    <CardTitle>
                      <span className="flex flex-wrap items-center gap-2">
                        {spazio.nome}
                        {!spazio.attivo && <Badge variant="neutral">Sospeso</Badge>}
                      </span>
                    </CardTitle>
                    <CardDescription>
                      <Link
                        href={`/admin/condomini/${spazio.condominio_id}`}
                        className="rounded hover:text-accent-ink"
                      >
                        {spazio.condominio?.nome}
                      </Link>
                      {" · "}
                      {spazio.ora_apertura.slice(0, 5)}–{spazio.ora_chiusura.slice(0, 5)}
                      {" · "}
                      {spazio.posti === 1
                        ? "un posto alla volta"
                        : `${spazio.posti} posti insieme`}
                      {spazio.durata_massima_ore
                        ? ` · max ${spazio.durata_massima_ore} ${
                            spazio.durata_massima_ore === 1 ? "ora" : "ore"
                          }`
                        : ""}
                    </CardDescription>
                  </CardHeaderText>
                  <AzioniSpazio spazio={spazio} prenotazioniFuture={prossime.length} />
                </CardHeader>

                {spazio.descrizione && (
                  <p className="mb-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {spazio.descrizione}
                  </p>
                )}

                {prossime.length ? (
                  <ul className="flex flex-col divide-y divide-border text-sm">
                    {prossime.slice(0, 6).map((p) => (
                      <li
                        key={p.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                      >
                        <span className="flex min-w-0 flex-col">
                          <span className="font-medium">
                            {formatData(giornoDi(p.inizio))} · {formattaFascia(p)}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {p.unita?.identificativo ?? "Unità"}
                            {p.utente ? ` — ${p.utente.nome} ${p.utente.cognome}` : ""}
                          </span>
                        </span>
                        <AnnullaPrenotazioneButton
                          id={p.id}
                          descrizione={`${spazio.nome}, ${formatData(
                            giornoDi(p.inizio)
                          )} ${formattaFascia(p)}`}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nessuna prenotazione in programma.
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={DoorOpen}
          title="Nessuno spazio prenotabile"
          description={
            condomini.length
              ? "Aggiungi la sala condominiale o i posti auto per gli ospiti: i condòmini potranno prenotarli da soli, senza passare da te."
              : "Crea prima un condominio: ogni spazio appartiene a uno stabile."
          }
          action={condomini.length ? <SpazioForm condomini={condomini} /> : undefined}
        />
      )}

      {prenotazioni.length > 0 && (
        <Section
          titolo="Tutte le prenotazioni"
          descrizione="Storico completo, comprese quelle passate e quelle annullate."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Spazio</TableHead>
                <TableHead>Quando</TableHead>
                <TableHead>Unità</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Stato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prenotazioni
                .slice()
                .sort((a, b) => b.inizio.localeCompare(a.inizio))
                .slice(0, 50)
                .map((p) => {
                  const spazio = spazi.find((s) => s.id === p.spazio_id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{spazio?.nome ?? "—"}</TableCell>
                      <TableCell etichetta="Quando">
                        <span className="cifre">
                          {formatData(giornoDi(p.inizio))} · {formattaFascia(p)}
                        </span>
                      </TableCell>
                      <TableCell etichetta="Unità">
                        {p.unita?.identificativo ?? "—"}
                      </TableCell>
                      <TableCell etichetta="Note">
                        {p.note ? (
                          <span className="text-xs text-muted-foreground">{p.note}</span>
                        ) : (
                          <span className="text-muted-foreground/70">—</span>
                        )}
                      </TableCell>
                      <TableCell etichetta="Stato">
                        <StatoBadge tipo="stato_prenotazione" valore={p.stato} />
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </Section>
      )}

      {spazi.length > 0 && (
        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <CalendarRange className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            Gli orari sono quelli del condominio: quello che un condòmino sceglie è quello che
            tu leggi qui, senza spostamenti di fuso.
          </span>
        </p>
      )}
    </PageBody>
  );
}
