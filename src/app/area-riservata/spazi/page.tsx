import { CalendarRange, DoorOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { richiedeUtente } from "@/lib/supabase/dal";
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
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { formatData } from "@/lib/format";
import { adessoLocale, oggiLocale } from "@/lib/fuso";
import { formattaFascia, giornoDi, normalizzaIstante } from "@/lib/prenotazioni";
import { PrenotaForm, type UnitaPrenotante } from "./prenota-form";
import { AnnullaButton } from "./annulla-button";

export const metadata = { title: "Spazi comuni" };

type RigaSpazio = SpazioComune & { condominio: { nome: string } | null };

type RigaPrenotazione = {
  id: string;
  spazio_id: string;
  unita_id: string;
  utente_id: string;
  inizio: string;
  fine: string;
  note: string | null;
  stato: string;
  unita: { identificativo: string } | null;
};

type LegameUnita = {
  unita: { id: string; identificativo: string; condominio_id: string } | null;
};

export default async function SpaziCondominoPage() {
  const utente = await richiedeUtente();
  const supabase = await createClient();

  const [{ data: legami }, { data: spaziData }, { data: prenotazioniData }] = await Promise.all([
    supabase
      .from("unita_proprietari")
      .select("unita:unita_id(id, identificativo, condominio_id)")
      .eq("utente_id", utente.id),
    // La policy "spazi_comuni_select" restituisce già i soli spazi dei
    // condomìni a cui l'utente appartiene: nessun filtro da ripetere qui.
    supabase
      .from("spazi_comuni")
      .select("*, condominio:condominio_id(nome)")
      .order("nome"),
    supabase
      .from("prenotazioni_spazi")
      .select("id, spazio_id, unita_id, utente_id, inizio, fine, note, stato, unita:unita_id(identificativo)")
      .eq("stato", "confermata")
      .order("inizio"),
  ]);

  const unitaPerCondominio = new Map<string, UnitaPrenotante[]>();
  for (const l of (legami ?? []) as unknown as LegameUnita[]) {
    if (!l.unita) continue;
    const elenco = unitaPerCondominio.get(l.unita.condominio_id) ?? [];
    if (!elenco.some((u) => u.id === l.unita!.id)) {
      elenco.push({ id: l.unita.id, identificativo: l.unita.identificativo });
    }
    unitaPerCondominio.set(l.unita.condominio_id, elenco);
  }

  const spazi = (spaziData ?? []) as unknown as RigaSpazio[];
  const prenotazioni = (prenotazioniData ?? []) as unknown as RigaPrenotazione[];

  const adesso = adessoLocale();
  const oggi = oggiLocale();

  const futurePerSpazio = new Map<string, RigaPrenotazione[]>();
  for (const p of prenotazioni) {
    if (normalizzaIstante(p.fine) < adesso) continue;
    const elenco = futurePerSpazio.get(p.spazio_id) ?? [];
    elenco.push(p);
    futurePerSpazio.set(p.spazio_id, elenco);
  }

  const mie = prenotazioni
    .filter((p) => p.utente_id === utente.id && normalizzaIstante(p.fine) >= adesso)
    .sort((a, b) => a.inizio.localeCompare(b.inizio));

  const senzaUnita = unitaPerCondominio.size === 0;

  return (
    <PageBody>
      <PageHeader
        titolo="Spazi comuni"
        descrizione="Gli spazi che il tuo condominio mette a disposizione su prenotazione. Le fasce già occupate sono visibili a tutti: serve a sapere quando lo spazio è libero."
      />

      {senzaUnita && (
        <Alert tono="warning" titolo="Nessuna unità collegata">
          Il tuo account non è ancora associato a un&apos;unità immobiliare: chiedi
          all&apos;amministratore di collegarti per poter prenotare.
        </Alert>
      )}

      {mie.length > 0 && (
        <Section
          titolo="Le tue prenotazioni"
          descrizione="Quelle che hai fatto tu e che devono ancora venire."
        >
          <ul className="flex flex-col gap-3">
            {mie.map((p) => {
              const spazio = spazi.find((s) => s.id === p.spazio_id);
              const quando = `${formatData(giornoDi(p.inizio))} · ${formattaFascia(p)}`;
              return (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-card"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">{spazio?.nome ?? "Spazio comune"}</span>
                    <span className="cifre text-sm text-muted-foreground">{quando}</span>
                    {p.note && (
                      <span className="text-xs text-muted-foreground">{p.note}</span>
                    )}
                  </span>
                  <AnnullaButton
                    id={p.id}
                    descrizione={`${spazio?.nome ?? "Spazio comune"}, ${quando}`}
                  />
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {spazi.length ? (
        <Section titolo="Spazi prenotabili">
          <div className="grid gap-6 lg:grid-cols-2">
            {spazi.map((spazio) => {
              const prossime = futurePerSpazio.get(spazio.id) ?? [];
              const unita = unitaPerCondominio.get(spazio.condominio_id) ?? [];
              return (
                <Card key={spazio.id}>
                  <CardHeader>
                    <CardHeaderText>
                      <CardTitle>
                        <span className="flex flex-wrap items-center gap-2">
                          {spazio.nome}
                          {!spazio.attivo && <Badge variant="neutral">Non prenotabile</Badge>}
                        </span>
                      </CardTitle>
                      <CardDescription>
                        {spazio.ora_apertura.slice(0, 5)}–{spazio.ora_chiusura.slice(0, 5)}
                        {spazio.posti > 1 ? ` · ${spazio.posti} posti insieme` : ""}
                        {spazio.durata_massima_ore
                          ? ` · max ${spazio.durata_massima_ore} ${
                              spazio.durata_massima_ore === 1 ? "ora" : "ore"
                            }`
                          : ""}
                      </CardDescription>
                    </CardHeaderText>
                    {spazio.attivo && unita.length > 0 && (
                      <PrenotaForm
                        spazioId={spazio.id}
                        nomeSpazio={spazio.nome}
                        oraApertura={spazio.ora_apertura}
                        oraChiusura={spazio.ora_chiusura}
                        durataMassimaOre={spazio.durata_massima_ore}
                        unita={unita}
                        oggi={oggi}
                      />
                    )}
                  </CardHeader>

                  {spazio.descrizione && (
                    <p className="mb-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                      {spazio.descrizione}
                    </p>
                  )}

                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Fasce già occupate
                    </p>
                    {prossime.length ? (
                      <ul className="flex flex-col divide-y divide-border text-sm">
                        {prossime.slice(0, 8).map((p) => (
                          <li key={p.id} className="flex flex-wrap items-baseline gap-x-2 py-2 first:pt-0 last:pb-0">
                            <span className="cifre font-medium">
                              {formatData(giornoDi(p.inizio))} · {formattaFascia(p)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {p.utente_id === utente.id
                                ? "la tua prenotazione"
                                : (p.unita?.identificativo ?? "prenotato")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Nessuna prenotazione: lo spazio è libero.
                      </p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </Section>
      ) : (
        <EmptyState
          icon={DoorOpen}
          title="Nessuno spazio prenotabile"
          description="Il tuo condominio non ha ancora spazi comuni prenotabili dal portale. Se pensi che dovrebbe averne, parlane con l'amministratore."
        />
      )}

      {spazi.length > 0 && (
        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <CalendarRange className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            Una prenotazione confermata occupa la fascia per tutti: se non ti serve più,
            annullala: la libera subito.
          </span>
        </p>
      )}
    </PageBody>
  );
}
