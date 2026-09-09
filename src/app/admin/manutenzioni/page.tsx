import Link from "next/link";
import { AlertTriangle, CalendarClock, Truck, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { richiedeAmministratore } from "@/lib/supabase/dal";
import type { Fornitore, ManutenzioneProgrammata } from "@/lib/types";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/card";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Badge, StatoBadge } from "@/components/ui/badge";
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
import { formatData, formatValuta } from "@/lib/format";
import {
  ETICHETTE_CATEGORIA_FORNITORE,
  ETICHETTE_PERIODICITA,
  ordinaScadenzario,
  oggiIso,
} from "@/lib/manutenzioni";
import { FornitoreForm } from "./fornitore-form";
import { AzioniFornitore } from "./azioni-fornitore";
import { ManutenzioneForm } from "./manutenzione-form";
import { AzioniManutenzione } from "./azioni-manutenzione";

export const metadata = { title: "Fornitori e manutenzioni" };

type RigaFornitore = Fornitore & { condominio: { nome: string } | null };

type RigaManutenzione = ManutenzioneProgrammata & {
  condominio: { nome: string } | null;
  fornitore: { nome: string } | null;
  spesa: { descrizione: string } | null;
};

/** Quanto manca (o da quanto è passata) una scadenza, in parole. */
function testoScadenza(giorni: number | null): string {
  if (giorni === null) return "";
  if (giorni === 0) return "oggi";
  if (giorni === 1) return "domani";
  if (giorni === -1) return "ieri";
  if (giorni > 0) return `fra ${giorni} giorni`;
  return `${-giorni} giorni fa`;
}

export default async function ManutenzioniPage() {
  await richiedeAmministratore();
  const supabase = await createClient();

  const [{ data: condominiData }, { data: fornitoriData }, { data: manutenzioniData }, { data: speseData }] =
    await Promise.all([
      supabase.from("condomini").select("id, nome").order("nome"),
      supabase
        .from("fornitori")
        .select("*, condominio:condominio_id(nome)")
        .order("nome"),
      supabase
        .from("manutenzioni_programmate")
        .select(
          "*, condominio:condominio_id(nome), fornitore:fornitore_id(nome), spesa:spesa_id(descrizione)"
        ),
      supabase
        .from("spese")
        .select("id, descrizione, condominio_id, data_spesa")
        .order("data_spesa", { ascending: false })
        .limit(200),
    ]);

  const condomini = condominiData ?? [];
  const fornitori = (fornitoriData ?? []) as unknown as RigaFornitore[];
  const manutenzioni = (manutenzioniData ?? []) as unknown as RigaManutenzione[];
  const spese = speseData ?? [];

  const oggi = oggiIso();
  const scadenzario = ordinaScadenzario(manutenzioni, oggi);
  const scadute = scadenzario.filter((r) => r.urgenza === "scaduta").length;
  const inScadenza = scadenzario.filter((r) => r.urgenza === "in_scadenza").length;
  const aperte = scadenzario.filter((r) => r.manutenzione.stato === "programmata").length;

  const senzaCondomini = condomini.length === 0;

  return (
    <PageBody>
      <PageHeader
        titolo="Fornitori e manutenzioni"
        descrizione="L'anagrafica delle ditte che lavorano sugli stabili e lo scadenzario degli interventi periodici — verifiche dell'ascensore, revisione della caldaia, controllo degli estintori."
        azioni={
          <ManutenzioneForm condomini={condomini} fornitori={fornitori} spese={spese} />
        }
      />

      <StatGrid colonne={3}>
        <StatCard
          label="Scadenze aperte"
          value={aperte}
          icon={CalendarClock}
          hint={aperte === 1 ? "intervento programmato" : "interventi programmati"}
        />
        <StatCard
          label="In scadenza"
          value={inScadenza}
          icon={Wrench}
          tono={inScadenza > 0 ? "warning" : "neutral"}
          hint="entro 30 giorni"
        />
        <StatCard
          label="Scadute"
          value={scadute}
          icon={AlertTriangle}
          tono={scadute > 0 ? "danger" : "success"}
          hint={scadute > 0 ? "da recuperare" : "nessun arretrato"}
        />
      </StatGrid>

      <Section
        titolo="Scadenzario"
        descrizione="Quando spunti un intervento come eseguito, se è periodico il portale programma da sé la scadenza successiva contandola dalla data prevista, non dal giorno in cui l'hai spuntato."
        azioni={<ManutenzioneForm condomini={condomini} fornitori={fornitori} spese={spese} />}
      >
        {scadenzario.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Intervento</TableHead>
                <TableHead>Condominio</TableHead>
                <TableHead>Fornitore</TableHead>
                <TableHead>Scadenza</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>
                  <span className="sr-only">Azioni</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scadenzario.map(({ manutenzione: m, urgenza, giorni }) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">
                    <RowIcon icon={Wrench}>
                      <span className="flex flex-col">
                        <span>{m.titolo}</span>
                        <span className="text-xs font-normal text-muted-foreground">
                          {ETICHETTE_PERIODICITA[m.periodicita]}
                          {m.costo_previsto != null
                            ? ` · previsti ${formatValuta(m.costo_previsto)}`
                            : ""}
                        </span>
                      </span>
                    </RowIcon>
                  </TableCell>
                  <TableCell etichetta="Condominio">{m.condominio?.nome ?? <Vuoto />}</TableCell>
                  <TableCell etichetta="Fornitore">{m.fornitore?.nome ?? <Vuoto />}</TableCell>
                  <TableCell etichetta="Scadenza">
                    <span className="flex flex-col">
                      <span className="cifre">{formatData(m.data_prossima)}</span>
                      {m.stato === "programmata" && (
                        <span className="text-xs text-muted-foreground">
                          {testoScadenza(giorni)}
                        </span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell etichetta="Stato">
                    {m.stato === "programmata" ? (
                      <StatoBadge tipo="urgenza_scadenza" valore={urgenza} />
                    ) : (
                      <StatoBadge tipo="stato_manutenzione" valore={m.stato} />
                    )}
                  </TableCell>
                  <TableCell className="md:text-right">
                    <AzioniManutenzione
                      id={m.id}
                      titolo={m.titolo}
                      stato={m.stato}
                      periodicita={m.periodicita}
                      dataProssima={m.data_prossima}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={CalendarClock}
            title="Nessuna manutenzione programmata"
            description={
              senzaCondomini
                ? "Crea prima un condominio: ogni scadenza appartiene a uno stabile."
                : "Registra le scadenze che tornano ogni anno — verifica dell'ascensore, revisione della caldaia, estintori — e non dovrai più ricordartele."
            }
            action={
              !senzaCondomini && (
                <ManutenzioneForm condomini={condomini} fornitori={fornitori} spese={spese} />
              )
            }
          />
        )}
      </Section>

      <Section
        titolo="Fornitori"
        descrizione="Le ditte registrate per ciascun condominio. Sono selezionabili quando assegni una segnalazione o programmi un intervento."
        azioni={<FornitoreForm condomini={condomini} />}
      >
        {fornitori.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fornitore</TableHead>
                <TableHead>Condominio</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Contatti</TableHead>
                <TableHead>
                  <span className="sr-only">Azioni</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fornitori.map((f) => {
                const contatti = [f.email, f.telefono].filter(Boolean) as string[];
                return (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">
                      <RowIcon icon={Truck}>
                        <span className="flex flex-col">
                          <span className="flex items-center gap-2">
                            {f.nome}
                            {!f.attivo && <Badge variant="neutral">Non attivo</Badge>}
                          </span>
                          {f.referente && (
                            <span className="text-xs font-normal text-muted-foreground">
                              Referente: {f.referente}
                            </span>
                          )}
                        </span>
                      </RowIcon>
                    </TableCell>
                    <TableCell etichetta="Condominio">
                      {f.condominio?.nome ? (
                        <Link
                          href={`/admin/condomini/${f.condominio_id}`}
                          className="rounded hover:text-accent-ink"
                        >
                          {f.condominio.nome}
                        </Link>
                      ) : (
                        <Vuoto />
                      )}
                    </TableCell>
                    <TableCell etichetta="Categoria">
                      {ETICHETTE_CATEGORIA_FORNITORE[f.categoria] ?? f.categoria}
                    </TableCell>
                    <TableCell etichetta="Contatti">
                      {contatti.length ? (
                        <span className="flex flex-col text-xs">
                          {contatti.map((c) => (
                            <span key={c}>{c}</span>
                          ))}
                        </span>
                      ) : (
                        <Vuoto />
                      )}
                    </TableCell>
                    <TableCell className="md:text-right">
                      <AzioniFornitore fornitore={f} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={Truck}
            title="Nessun fornitore registrato"
            description={
              senzaCondomini
                ? "Crea prima un condominio: i fornitori sono registrati per stabile."
                : "Ascensorista, termotecnico, impresa di pulizie: registrali una volta e li ritrovi ovunque servano."
            }
            action={!senzaCondomini && <FornitoreForm condomini={condomini} />}
          />
        )}
      </Section>
    </PageBody>
  );
}
