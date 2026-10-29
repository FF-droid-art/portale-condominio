import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, ExternalLink, Home, Landmark, ShieldCheck, Wallet } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { formatData, formatDataOra, formatMillesimi, formatValuta } from "@/lib/format";
import { haQuota } from "@/lib/ruoli";
import type { CondizioneSicurezza } from "@/lib/types";
import { CondizioneSicurezzaForm } from "./condizione-sicurezza-form";
import { EliminaCondizioneButton } from "./elimina-condizione-button";
import { ContoCorrenteForm } from "../conto-corrente-form";
import { ModificaCondominioButton } from "./modifica-condominio-button";
import { TrasferisciCondominioButton } from "./trasferisci-condominio-button";
import { EliminaCondominioButton } from "./elimina-condominio-button";
import { NuovaUnitaForm } from "./nuova-unita-form";
import { AvvisoForm } from "./avviso-form";
import { ScaricaRendiconto } from "./scarica-rendiconto";

const ETICHETTA_TIPO: Record<string, string> = {
  proprietario: "Proprietario",
  nudo_proprietario: "Nudo proprietario",
  usufruttuario: "Usufruttuario",
  conduttore: "Conduttore",
  comodatario: "Comodatario",
  assegnatario: "Assegnatario",
};

type OccupanteUnita = {
  quota_possesso: number;
  tipo_soggetto: string;
  attivo: boolean;
  anagrafiche: { nominativo: string } | null;
};

type UnitaConOccupanti = {
  id: string;
  identificativo: string;
  millesimi_proprieta: number;
  unita_proprietari: OccupanteUnita[] | null;
};

type RigaUnita = {
  unita: UnitaConOccupanti;
  occupante: OccupanteUnita | null;
  primo: boolean;
};

export default async function CondominioDettaglioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: condominio } = await supabase.from("condomini").select("*").eq("id", id).single();
  if (!condominio) notFound();

  const [
    { data: unita },
    { data: assemblee },
    { data: spese },
    { data: tabelleMillesimi },
    { data: anagraficheEmail },
    { data: condizioniSicurezza },
  ] = await Promise.all([
    supabase
      .from("unita")
      .select(
        "*, unita_proprietari(quota_possesso, tipo_soggetto, attivo, anagrafiche(nominativo)), valori_millesimali(valore, tabella_id)"
      )
      .eq("condominio_id", id)
      .order("identificativo"),
    supabase
      .from("assemblee")
      .select("id, data_assemblea, tipo, stato")
      .eq("condominio_id", id)
      .order("data_assemblea", { ascending: false }),
    supabase
      .from("spese")
      .select("*, ripartizioni(importo_dovuto, stato_pagamento)")
      .eq("condominio_id", id)
      .order("data_spesa", { ascending: false }),
    supabase.from("tabelle_millesimali").select("id, nome").eq("condominio_id", id),
    supabase.from("anagrafiche").select("email").eq("condominio_id", id),
    supabase
      .from("condizioni_sicurezza_parti_comuni")
      .select("*")
      .eq("condominio_id", id)
      .order("data_ultima_verifica", { ascending: false, nullsFirst: false })
      .order("parte"),
  ]);

  const condizioni = (condizioniSicurezza ?? []) as CondizioneSicurezza[];

  const destinatariAvvisi = new Set(
    (anagraficheEmail ?? []).map((a) => a.email as string | null).filter((e): e is string => !!e)
  ).size;

  const adesso = new Date();
  const prossimaAssemblea = (assemblee ?? [])
    .filter((a) => new Date(a.data_assemblea) >= adesso)
    .sort((a, b) => a.data_assemblea.localeCompare(b.data_assemblea))[0];

  const annoCorrente = adesso.getFullYear();
  const speseAnnoCorrente = (spese ?? []).filter(
    (s) => new Date(s.data_spesa).getFullYear() === annoCorrente
  );
  const totaleSpeseAnno = speseAnnoCorrente.reduce((somma, s) => somma + s.importo_totale, 0);
  const totaleNonIncassato = (spese ?? []).reduce((somma, s) => {
    const ripartizioni = (s.ripartizioni ?? []) as {
      importo_dovuto: number;
      stato_pagamento: string;
    }[];
    return (
      somma +
      ripartizioni
        .filter((r) => r.stato_pagamento !== "pagato")
        .reduce((sub, r) => sub + r.importo_dovuto, 0)
    );
  }, 0);

  // Anni selezionabili per il rendiconto: quelli in cui c'è almeno una spesa,
  // più quello corrente, così il prospetto è scaricabile anche a gennaio.
  const anniRendiconto = [
    ...new Set([annoCorrente, ...(spese ?? []).map((s) => new Date(s.data_spesa).getFullYear())]),
  ]
    .filter((a) => Number.isInteger(a))
    .sort((a, b) => b - a);

  // Una riga per (unità × occupante attivo). Le unità senza occupanti
  // producono comunque una riga (nominativo "—"). L'identificativo e i
  // millesimi si mostrano solo sulla prima riga di ciascuna unità.
  const righeUnita = (unita ?? []).flatMap((u): RigaUnita[] => {
    const occupanti = ((u.unita_proprietari ?? []) as OccupanteUnita[]).filter(
      (o) => o.attivo && o.anagrafiche
    );
    if (occupanti.length === 0) return [{ unita: u, occupante: null, primo: true }];
    return occupanti.map((o, i) => ({ unita: u, occupante: o, primo: i === 0 }));
  });

  // Colonne millesimi dinamiche: una per tabella millesimale con almeno un
  // valore (le tabelle vuote non compaiono). Ordine: "Generali" per prima.
  const valoriPerUnita = new Map<string, Map<string, number>>();
  for (const u of unita ?? []) {
    const m = new Map<string, number>();
    for (const v of (u.valori_millesimali ?? []) as { valore: number; tabella_id: string }[]) {
      if (v.valore != null) m.set(v.tabella_id, v.valore);
    }
    valoriPerUnita.set(u.id, m);
  }
  const tabelle = (tabelleMillesimi ?? []) as { id: string; nome: string }[];
  const colonneMill = tabelle
    .filter((t) => [...valoriPerUnita.values()].some((m) => m.has(t.id)))
    .sort((a, b) =>
      a.nome === "Generali" ? -1 : b.nome === "Generali" ? 1 : a.nome.localeCompare(b.nome)
    );
  // Se non ci sono ancora tabelle importate, si mostra il singolo millesimo
  // "generale" dell'unità (comportamento precedente).
  const mostraFallbackMill = colonneMill.length === 0;

  return (
    <PageBody>
      <PageHeader
        indietro={{ href: "/admin/condomini", label: "Condomìni" }}
        titolo={condominio.nome}
        descrizione={
          <>
            {condominio.indirizzo}
            {condominio.codice_fiscale ? ` · C.F. ${condominio.codice_fiscale}` : ""}
          </>
        }
        azioni={
          <>
            <AvvisoForm condominioId={condominio.id} destinatari={destinatariAvvisi} />
            <ModificaCondominioButton
              id={condominio.id}
              nome={condominio.nome}
              indirizzo={condominio.indirizzo}
              codiceFiscale={condominio.codice_fiscale ?? null}
            />
          </>
        }
      />

      <StatGrid>
        <StatCard label="Unità" value={unita?.length ?? 0} icon={Home} />
        <StatCard
          label="Prossima assemblea"
          value={prossimaAssemblea ? formatData(prossimaAssemblea.data_assemblea) : "—"}
          icon={CalendarClock}
          hint={prossimaAssemblea ? undefined : "nessuna assemblea in programma"}
        />
        <StatCard
          label={`Spese ${annoCorrente}`}
          value={formatValuta(totaleSpeseAnno)}
          icon={Wallet}
          hint={`${speseAnnoCorrente.length} ${speseAnnoCorrente.length === 1 ? "spesa" : "spese"} nell'anno`}
        />
        <StatCard
          label="Da incassare"
          value={formatValuta(totaleNonIncassato)}
          icon={Landmark}
          tono={totaleNonIncassato > 0 ? "warning" : "success"}
        />
      </StatGrid>

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        {/* Colonna principale: i dati che si consultano di continuo. */}
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <Section
            titolo="Unità e occupanti"
            descrizione="Una riga per ogni soggetto attivo. Apri un'unità per gestirne i soggetti e i millesimi."
            azioni={<NuovaUnitaForm condominioId={condominio.id} tabelle={colonneMill} />}
          >
            {unita?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unità</TableHead>
                    <TableHead>Nominativo</TableHead>
                    <TableHead>Qualifica</TableHead>
                    <TableHead numeric>Quota</TableHead>
                    {mostraFallbackMill ? (
                      <TableHead numeric>Millesimi</TableHead>
                    ) : (
                      colonneMill.map((t) => (
                        <TableHead key={t.id} numeric>
                          Mill. {t.nome}
                        </TableHead>
                      ))
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {righeUnita.map((r, i) => (
                    <TableRow key={`${r.unita.id}-${i}`}>
                      <TableCell className="font-medium">
                        {r.primo ? (
                          <Link
                            href={`/admin/unita/${r.unita.id}`}
                            className="rounded transition-colors hover:text-accent-ink"
                          >
                            <RowIcon icon={Home}>{r.unita.identificativo}</RowIcon>
                          </Link>
                        ) : (
                          <span className="text-muted-foreground md:sr-only">
                            {r.unita.identificativo}
                          </span>
                        )}
                      </TableCell>
                      <TableCell etichetta="Nominativo">
                        {r.occupante?.anagrafiche?.nominativo ?? <Vuoto />}
                      </TableCell>
                      <TableCell etichetta="Qualifica">
                        {r.occupante ? (
                          ETICHETTA_TIPO[r.occupante.tipo_soggetto] ?? r.occupante.tipo_soggetto
                        ) : (
                          <Vuoto />
                        )}
                      </TableCell>
                      <TableCell etichetta="Quota" numeric>
                        {r.occupante &&
                        haQuota(r.occupante.tipo_soggetto) &&
                        r.occupante.quota_possesso !== 100 ? (
                          `${r.occupante.quota_possesso}%`
                        ) : (
                          <Vuoto />
                        )}
                      </TableCell>
                      {mostraFallbackMill ? (
                        <TableCell etichetta="Millesimi" numeric>
                          {r.primo ? formatMillesimi(r.unita.millesimi_proprieta) : ""}
                        </TableCell>
                      ) : (
                        colonneMill.map((t) => {
                          const v = valoriPerUnita.get(r.unita.id)?.get(t.id);
                          return (
                            <TableCell key={t.id} etichetta={`Mill. ${t.nome}`} numeric>
                              {r.primo ? v != null ? formatMillesimi(v) : <Vuoto /> : ""}
                            </TableCell>
                          );
                        })
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                icon={Home}
                title="Nessuna unità in questo condominio"
                description="Aggiungi le unità una alla volta oppure importale in blocco da un file .xlsx o .csv."
                action={
                  <>
                    <NuovaUnitaForm condominioId={condominio.id} tabelle={colonneMill} />
                    <Button href="/admin/importa/unita" variant="secondary" size="sm">
                      Importa unità
                    </Button>
                  </>
                }
              />
            )}
          </Section>

          {/* Condizioni di sicurezza delle parti comuni: l'art. 1130, n. 6,
              c.c. le vuole nel registro di anagrafe insieme alle generalità
              e ai dati catastali, quindi stanno qui accanto a unità e
              occupanti e non in una pagina separata. */}
          <Section
            titolo="Condizioni di sicurezza delle parti comuni"
            descrizione="Stato delle parti comuni e degli impianti alla data dell'ultima verifica, come richiesto dall'art. 1130, n. 6, c.c. I condòmini le vedono tra i documenti del condominio."
            azioni={<CondizioneSicurezzaForm condominioId={condominio.id} />}
          >
            {condizioni.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Parte comune o impianto</TableHead>
                    <TableHead>Stato rilevato</TableHead>
                    <TableHead>Ultima verifica</TableHead>
                    <TableHead>
                      <span className="sr-only">Azioni</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {condizioni.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <RowIcon icon={ShieldCheck}>{c.parte}</RowIcon>
                      </TableCell>
                      <TableCell etichetta="Stato rilevato">
                        {c.descrizione ? (
                          <span className="flex flex-col gap-1">
                            <span className="text-sm">{c.descrizione}</span>
                            {c.documento_url && (
                              <a
                                href={c.documento_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-accent-ink hover:underline"
                              >
                                Certificato
                                <ExternalLink className="size-3" aria-hidden="true" />
                              </a>
                            )}
                          </span>
                        ) : c.documento_url ? (
                          <a
                            href={c.documento_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-accent-ink hover:underline"
                          >
                            Certificato
                            <ExternalLink className="size-3" aria-hidden="true" />
                          </a>
                        ) : (
                          <Vuoto />
                        )}
                      </TableCell>
                      <TableCell etichetta="Ultima verifica">
                        {c.data_ultima_verifica ? (
                          formatData(c.data_ultima_verifica)
                        ) : (
                          <Vuoto />
                        )}
                      </TableCell>
                      <TableCell className="md:text-right">
                        <EliminaCondizioneButton
                          id={c.id}
                          condominioId={condominio.id}
                          parte={c.parte}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                compatta
                icon={ShieldCheck}
                title="Nessuna condizione di sicurezza registrata"
                description="Annota lo stato degli impianti e delle parti comuni (impianto elettrico, ascensore, canna fumaria, facciata) con la data dell'ultima verifica: è parte del registro di anagrafe che la legge affida all'amministratore."
                action={<CondizioneSicurezzaForm condominioId={condominio.id} />}
              />
            )}
          </Section>

          <Section
            titolo="Spese recenti"
            azioni={
              <Button href="/admin/spese" variant="ghost" size="sm">
                Vedi tutte
              </Button>
            }
          >
            {spese?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrizione</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead numeric>Importo</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {spese.slice(0, 5).map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/admin/spese/${s.id}`}
                          className="rounded transition-colors hover:text-accent-ink"
                        >
                          <RowIcon icon={Wallet}>{s.descrizione}</RowIcon>
                        </Link>
                      </TableCell>
                      <TableCell etichetta="Categoria">{s.categoria}</TableCell>
                      <TableCell etichetta="Importo" numeric className="font-medium">
                        {formatValuta(s.importo_totale)}
                      </TableCell>
                      <TableCell etichetta="Data">{formatData(s.data_spesa)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                compatta
                icon={Wallet}
                title="Nessuna spesa registrata"
                description="Le spese di questo condominio compariranno qui."
                action={
                  <Button href="/admin/spese" size="sm" variant="secondary">
                    Registra una spesa
                  </Button>
                }
              />
            )}
          </Section>
        </div>

        {/* Colonna laterale: dati di configurazione, consultati di rado. */}
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardHeaderText>
                <CardTitle>Conto corrente</CardTitle>
                <CardDescription>
                  Usato nei documenti e negli avvisi di pagamento.
                </CardDescription>
              </CardHeaderText>
            </CardHeader>
            <ContoCorrenteForm condominio={condominio} />
          </Card>

          <Card>
            <CardHeader>
              <CardHeaderText>
                <CardTitle>Rendiconto annuale</CardTitle>
                <CardDescription>
                  Uscite per categoria, quote incassate nell&apos;anno e situazione di ogni
                  unità, in un PDF da allegare alla convocazione.
                </CardDescription>
              </CardHeaderText>
            </CardHeader>
            <ScaricaRendiconto condominioId={condominio.id} anni={anniRendiconto} />
          </Card>

          <Card>
            <CardHeader>
              <CardHeaderText>
                <CardTitle>Assemblee</CardTitle>
              </CardHeaderText>
              <Button href="/admin/assemblee" variant="ghost" size="sm">
                Vedi tutte
              </Button>
            </CardHeader>

            {assemblee?.length ? (
              <ul className="flex flex-col divide-y divide-border">
                {assemblee.slice(0, 5).map((a) => (
                  <li key={a.id} className="py-3 first:pt-0 last:pb-0">
                    <Link
                      href={`/admin/assemblee/${a.id}`}
                      className="group flex flex-col gap-1.5 rounded"
                    >
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium transition-colors group-hover:text-accent-ink">
                          {formatDataOra(a.data_assemblea)}
                        </span>
                        <StatoBadge tipo="stato_assemblea" valore={a.stato} />
                      </span>
                      <span className="text-xs capitalize text-muted-foreground">{a.tipo}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                compatta
                icon={CalendarClock}
                title="Nessuna assemblea"
                description="Convoca la prima assemblea per questo condominio."
                action={
                  <Button href="/admin/assemblee" size="sm" variant="secondary">
                    Convoca assemblea
                  </Button>
                }
              />
            )}
          </Card>
        </div>
      </div>

      {/* Azioni fuori dal flusso ordinario: separate e in fondo, perché una
          non è ancora disponibile e l'altra è irreversibile. */}
      <Section
        titolo="Gestione avanzata"
        descrizione="Operazioni che riguardano il condominio nel suo insieme."
      >
        <Card bordo="pericolo">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-sm font-semibold">Passaggio di consegne o chiusura</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Trasferisci il condominio a un altro amministratore oppure eliminalo con tutti i
                dati collegati.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <TrasferisciCondominioButton />
              <EliminaCondominioButton id={condominio.id} nome={condominio.nome} />
            </div>
          </div>
        </Card>
      </Section>
    </PageBody>
  );
}
