import { Building2, FileDown, Home, Scale, UserCog } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { richiedeUtente } from "@/lib/supabase/dal";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardHeaderText, CardTitle, CardDescription, Section } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
import { ScaricaRendiconto } from "@/components/documenti/scarica-rendiconto";
import { anniRendiconto } from "@/lib/documenti/rendiconto";
import { formatMillesimi } from "@/lib/format";
import { oggiLocale } from "@/lib/fuso";

export const metadata = { title: "Il mio condominio" };

/**
 * "Il mio condominio": i documenti che la legge mette a disposizione del
 * condòmino, in un posto solo.
 *
 *  - il RENDICONTO annuale, che l'art. 1130-bis, comma 1, c.c. gli dà diritto
 *    di prendere in visione e di estrarre in copia (FEAT-02);
 *  - le TABELLE MILLESIMALI, cioè la proporzione con cui ogni spesa viene
 *    ripartita: senza quelle, le quote addebitate non sono verificabili
 *    (FEAT-03);
 *  - lo STATO PATRIMONIALE delle proprie unità, l'estratto conto che serve
 *    tipicamente in una compravendita.
 *
 * COSA SI VEDE DEGLI ALTRI, E COSA NO. La tabella millesimale è per UNITÀ
 * ("Interno 3"), non per persona: identificativo, piano e millesimi, mai il
 * nominativo di chi ci abita — quello resta nel registro di anagrafe che la
 * legge affida all'amministratore. La posizione contabile delle altre unità
 * non compare qui: sta dentro il rendiconto, dove l'art. 1130-bis la prevede.
 *
 * MULTI-CONDOMINIO. Un condòmino può possedere unità in più stabili: la
 * pagina raggruppa per condominio, come fa l'archivio documenti, e la
 * sezione è senza titolo quando lo stabile è uno solo.
 */

type UnitaPosseduta = {
  unita: {
    id: string;
    identificativo: string;
    piano: string | null;
    millesimi_proprieta: number;
    condominio_id: string;
    condominio: {
      id: string;
      nome: string;
      indirizzo: string;
      codice_fiscale: string | null;
    } | null;
  } | null;
};

/** Riga di `condominio_unita_millesimi`. */
type UnitaMillesimi = {
  unita_id: string;
  identificativo: string;
  piano: string | null;
  millesimi_proprieta: number;
};

/** Riga di `condominio_valori_millesimali`. */
type ValoreMillesimale = { tabella_id: string; unita_id: string; valore: number };

/** Riga di `condominio_amministratore`. */
type Amministratore = { nome: string; cognome: string; email: string };

type Tabella = { id: string; nome: string };

type SchedaCondominio = {
  id: string;
  nome: string;
  indirizzo: string;
  codiceFiscale: string | null;
  /** Unità possedute dall'utente in questo stabile. */
  mieUnita: { id: string; identificativo: string }[];
  unita: UnitaMillesimi[];
  colonne: Tabella[];
  /** unita_id -> tabella_id -> valore. */
  valori: Map<string, Map<string, number>>;
  amministratore: Amministratore | null;
  anni: number[];
};

export default async function MioCondominioPage() {
  const utente = await richiedeUtente();
  const supabase = await createClient();

  const { data: legamiData } = await supabase
    .from("unita_proprietari")
    .select(
      "unita:unita_id(id, identificativo, piano, millesimi_proprieta, condominio_id, condominio:condominio_id(id, nome, indirizzo, codice_fiscale))"
    )
    .eq("utente_id", utente.id);

  const legami = (legamiData ?? []) as unknown as UnitaPosseduta[];

  // Un condominio per ogni stabile in cui l'utente ha almeno un'unità: è lo
  // stesso perimetro che la funzione RLS appartiene_condominio() riconosce,
  // quindi è esattamente ciò che le query qui sotto riusciranno a leggere.
  const perCondominio = new Map<string, { nome: string; indirizzo: string; codiceFiscale: string | null; mieUnita: { id: string; identificativo: string }[] }>();
  for (const legame of legami) {
    const u = legame.unita;
    if (!u?.condominio) continue;
    const scheda = perCondominio.get(u.condominio_id) ?? {
      nome: u.condominio.nome,
      indirizzo: u.condominio.indirizzo,
      codiceFiscale: u.condominio.codice_fiscale,
      mieUnita: [],
    };
    if (!scheda.mieUnita.some((m) => m.id === u.id)) {
      scheda.mieUnita.push({ id: u.id, identificativo: u.identificativo });
    }
    perCondominio.set(u.condominio_id, scheda);
  }

  const annoCorrente = Number(oggiLocale().slice(0, 4));

  const schede: SchedaCondominio[] = await Promise.all(
    [...perCondominio.entries()].map(async ([condominioId, base]) => {
      const [
        { data: unitaData },
        { data: tabelleData },
        { data: valoriData },
        { data: amministratoreData },
        { data: speseData },
      ] = await Promise.all([
        // Le unità dell'edificio e i valori millesimali passano da funzioni
        // "security definer": le policy di riga mostrerebbero al condòmino la
        // sola unità sua, e una tabella millesimale con una riga non è una
        // tabella millesimale. Il controllo di appartenenza è dentro le
        // funzioni (vedi supabase/schema.sql).
        supabase.rpc("condominio_unita_millesimi", { p_condominio_id: condominioId }),
        supabase.from("tabelle_millesimali").select("id, nome").eq("condominio_id", condominioId),
        supabase.rpc("condominio_valori_millesimali", { p_condominio_id: condominioId }),
        supabase
          .rpc("condominio_amministratore", { p_condominio_id: condominioId })
          .maybeSingle(),
        // Serve solo a popolare il menù degli anni del rendiconto: le spese
        // del proprio condominio sono già visibili per intero ("spese_select").
        supabase.from("spese").select("data_spesa").eq("condominio_id", condominioId),
      ]);

      const unita = (unitaData ?? []) as UnitaMillesimi[];

      const valori = new Map<string, Map<string, number>>();
      for (const v of (valoriData ?? []) as ValoreMillesimale[]) {
        if (v.valore == null) continue;
        const perUnita = valori.get(v.unita_id) ?? new Map<string, number>();
        perUnita.set(v.tabella_id, v.valore);
        valori.set(v.unita_id, perUnita);
      }

      // Una colonna per tabella millesimale con almeno un valore: le tabelle
      // vuote non compaiono. "Generali" per prima, come nella scheda del
      // condominio lato amministratore.
      const colonne = ((tabelleData ?? []) as Tabella[])
        .filter((t) => [...valori.values()].some((m) => m.has(t.id)))
        .sort((a, b) =>
          a.nome === "Generali" ? -1 : b.nome === "Generali" ? 1 : a.nome.localeCompare(b.nome, "it")
        );

      return {
        id: condominioId,
        nome: base.nome,
        indirizzo: base.indirizzo,
        codiceFiscale: base.codiceFiscale,
        mieUnita: base.mieUnita,
        unita,
        colonne,
        valori,
        amministratore: (amministratoreData as Amministratore | null) ?? null,
        anni: anniRendiconto(
          (speseData ?? []).map((s) => s.data_spesa as string),
          annoCorrente
        ),
      } satisfies SchedaCondominio;
    })
  );

  schede.sort((a, b) => a.nome.localeCompare(b.nome, "it"));
  const unicoCondominio = schede.length <= 1;

  return (
    <PageBody>
      <PageHeader
        titolo="Il mio condominio"
        descrizione="Il rendiconto annuale, le tabelle millesimali con cui vengono calcolate le quote e l'estratto conto delle tue unità."
      />

      {!schede.length ? (
        <EmptyState
          icon={Building2}
          title="Nessun condominio collegato"
          description="Il tuo account non è ancora associato a un'unità immobiliare, quindi non risulta collegato ad alcuno stabile. Chiedi all'amministratore del tuo condominio di collegarti."
        />
      ) : (
        schede.map((scheda) => {
          const mieUnitaIds = new Set(scheda.mieUnita.map((u) => u.id));
          const mostraFallbackMill = scheda.colonne.length === 0;
          const totaleGenerale = scheda.unita.reduce((s, u) => s + u.millesimi_proprieta, 0);

          return (
            <section key={scheda.id} className="flex flex-col gap-6">
              <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardHeaderText>
                      <CardTitle>{scheda.nome}</CardTitle>
                      <CardDescription>
                        {scheda.indirizzo}
                        {scheda.codiceFiscale ? ` · C.F. ${scheda.codiceFiscale}` : ""}
                      </CardDescription>
                    </CardHeaderText>
                  </CardHeader>

                  <dl className="flex flex-col gap-3 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <dt className="flex items-center gap-2 text-muted-foreground">
                        <UserCog className="size-4" aria-hidden="true" />
                        Amministratore
                      </dt>
                      <dd className="font-medium">
                        {scheda.amministratore ? (
                          <span className="flex flex-col text-right">
                            <span>
                              {scheda.amministratore.nome} {scheda.amministratore.cognome}
                            </span>
                            <a
                              href={`mailto:${scheda.amministratore.email}`}
                              className="text-xs font-normal text-accent-ink hover:underline"
                            >
                              {scheda.amministratore.email}
                            </a>
                          </span>
                        ) : (
                          <Vuoto />
                        )}
                      </dd>
                    </div>
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <dt className="flex items-center gap-2 text-muted-foreground">
                        <Home className="size-4" aria-hidden="true" />
                        Unità nello stabile
                      </dt>
                      <dd className="cifre font-medium">{scheda.unita.length}</dd>
                    </div>
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <dt className="flex items-center gap-2 text-muted-foreground">
                        <Scale className="size-4" aria-hidden="true" />
                        Millesimi complessivi
                      </dt>
                      <dd className="cifre font-medium">{formatMillesimi(totaleGenerale)}</dd>
                    </div>
                  </dl>
                </Card>

                <Card>
                  <CardHeader>
                    <CardHeaderText>
                      <CardTitle>Rendiconto annuale</CardTitle>
                      <CardDescription>
                        Il consuntivo della gestione: uscite per categoria, registro dei
                        movimenti e situazione di ogni unità. Puoi estrarne copia in qualsiasi
                        momento (art. 1130-bis c.c.).
                      </CardDescription>
                    </CardHeaderText>
                  </CardHeader>
                  <ScaricaRendiconto
                    href={`/area-riservata/condominio/${scheda.id}/rendiconto`}
                    anni={scheda.anni}
                  />
                </Card>
              </div>

              <Section
                titolo={
                  unicoCondominio ? "Tabelle millesimali" : `Tabelle millesimali — ${scheda.nome}`
                }
                descrizione="La proporzione con cui ogni spesa viene ripartita tra le unità dello stabile. Le tue unità sono evidenziate."
              >
                {scheda.unita.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Unità</TableHead>
                        <TableHead>Piano</TableHead>
                        {mostraFallbackMill ? (
                          <TableHead numeric>Millesimi</TableHead>
                        ) : (
                          scheda.colonne.map((t) => (
                            <TableHead key={t.id} numeric>
                              Mill. {t.nome}
                            </TableHead>
                          ))
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scheda.unita.map((u) => {
                        const mia = mieUnitaIds.has(u.unita_id);
                        return (
                          <TableRow key={u.unita_id}>
                            <TableCell className="font-medium">
                              <RowIcon icon={Home}>
                                <span className="flex flex-wrap items-center gap-2">
                                  {u.identificativo}
                                  {mia && <Badge variant="accent">la tua</Badge>}
                                </span>
                              </RowIcon>
                            </TableCell>
                            <TableCell etichetta="Piano">{u.piano ?? <Vuoto />}</TableCell>
                            {mostraFallbackMill ? (
                              <TableCell etichetta="Millesimi" numeric>
                                {formatMillesimi(u.millesimi_proprieta)}
                              </TableCell>
                            ) : (
                              scheda.colonne.map((t) => {
                                const v = scheda.valori.get(u.unita_id)?.get(t.id);
                                return (
                                  <TableCell key={t.id} etichetta={`Mill. ${t.nome}`} numeric>
                                    {v != null ? formatMillesimi(v) : <Vuoto />}
                                  </TableCell>
                                );
                              })
                            )}
                          </TableRow>
                        );
                      })}
                      {/* Riga dei totali: su una tabella millesimale è il dato
                          che si guarda per primo — deve fare 1000. */}
                      <TableRow className="font-semibold">
                        <TableCell>Totale</TableCell>
                        <TableCell />
                        {mostraFallbackMill ? (
                          <TableCell etichetta="Millesimi" numeric>
                            {formatMillesimi(totaleGenerale)}
                          </TableCell>
                        ) : (
                          scheda.colonne.map((t) => {
                            const totale = scheda.unita.reduce(
                              (somma, u) => somma + (scheda.valori.get(u.unita_id)?.get(t.id) ?? 0),
                              0
                            );
                            return (
                              <TableCell key={t.id} etichetta={`Mill. ${t.nome}`} numeric>
                                {formatMillesimi(totale)}
                              </TableCell>
                            );
                          })
                        )}
                      </TableRow>
                    </TableBody>
                  </Table>
                ) : (
                  <EmptyState
                    compatta
                    icon={Scale}
                    title="Nessuna tabella millesimale disponibile"
                    description="L'amministratore non ha ancora registrato le unità di questo stabile."
                  />
                )}
              </Section>

              <Section
                titolo={unicoCondominio ? "Le tue unità" : `Le tue unità — ${scheda.nome}`}
                descrizione="Lo stato patrimoniale è l'estratto conto di una singola unità: millesimi, soggetti collegati, quote addebitate e saldo. Serve soprattutto in caso di compravendita."
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Unità</TableHead>
                      <TableHead>
                        <span className="sr-only">Stato patrimoniale</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scheda.mieUnita.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">
                          <RowIcon icon={Home}>{u.identificativo}</RowIcon>
                        </TableCell>
                        <TableCell className="md:text-right">
                          <Button
                            href={`/area-riservata/unita/${u.id}/stato-patrimoniale`}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="secondary"
                            size="sm"
                          >
                            <FileDown className="size-4" aria-hidden="true" />
                            Stato patrimoniale
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Section>
            </section>
          );
        })
      )}
    </PageBody>
  );
}
