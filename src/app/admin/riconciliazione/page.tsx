import Link from "next/link";
import { ArrowRightLeft, Banknote, Landmark, Scale } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { richiedeAmministratore } from "@/lib/supabase/dal";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardHeaderText, CardTitle, CardDescription, Section } from "@/components/ui/card";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Badge, StatoBadge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Vuoto,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { formatData, formatValuta } from "@/lib/format";
import { abbinaMovimenti, type MovimentoGrezzo, type RipartizioneAperta } from "@/lib/riconciliazione";
import { CaricaEstratto } from "./carica-estratto";
import {
  AbbinaManualmenteButton,
  ConfermaAbbinamentoButton,
  IgnoraMovimentoButton,
  RipristinaMovimentoButton,
  type QuotaSelezionabile,
} from "./azioni-movimento";

export const metadata = { title: "Riconciliazione bancaria" };

type MovimentoRiga = {
  id: string;
  data: string;
  importo: number;
  descrizione: string;
  riferimento: string | null;
  stato: string;
  import_hash: string;
  ripartizione_id: string | null;
};

type ProprietarioRiga = {
  utente: { nome: string; cognome: string } | null;
  anagrafica: { nominativo: string } | null;
};

type UnitaRiga = {
  id: string;
  identificativo: string;
  unita_proprietari: ProprietarioRiga[] | null;
};

type RipartizioneRiga = {
  id: string;
  unita_id: string;
  importo_dovuto: number;
  stato_pagamento: string;
  data_scadenza: string | null;
  codice_avviso: string | null;
  spesa: { descrizione: string } | null;
};

export default async function RiconciliazionePage({
  searchParams,
}: {
  searchParams: Promise<{ condominio?: string }>;
}) {
  await richiedeAmministratore();
  const supabase = await createClient();

  const { condominio: condominioRichiesto } = await searchParams;

  const { data: condominiData } = await supabase.from("condomini").select("id, nome").order("nome");
  const condomini = condominiData ?? [];

  const condominioId =
    condomini.find((c) => c.id === condominioRichiesto)?.id ?? condomini[0]?.id ?? "";

  if (!condominioId) {
    return (
      <PageBody>
        <PageHeader
          titolo="Riconciliazione bancaria"
          descrizione="Carica l'estratto conto del condominio e lascia che il portale riconosca da solo chi ha pagato."
        />
        <EmptyState
          icon={Landmark}
          title="Nessun condominio"
          description="Crea prima un condominio: l'estratto conto appartiene al conto corrente di uno stabile."
        />
      </PageBody>
    );
  }

  const { data: unitaData } = await supabase
    .from("unita")
    .select(
      "id, identificativo, unita_proprietari(utente:utente_id(nome, cognome), anagrafica:anagrafica_id(nominativo))"
    )
    .eq("condominio_id", condominioId);

  const unita = (unitaData ?? []) as unknown as UnitaRiga[];
  const unitaIds = unita.map((u) => u.id);

  const [{ data: movimentiData }, { data: ripartizioniData }] = await Promise.all([
    supabase
      .from("movimenti_bancari")
      .select("id, data, importo, descrizione, riferimento, stato, import_hash, ripartizione_id")
      .eq("condominio_id", condominioId)
      .order("data", { ascending: false }),
    unitaIds.length
      ? supabase
          .from("ripartizioni")
          .select(
            "id, unita_id, importo_dovuto, stato_pagamento, data_scadenza, codice_avviso, spesa:spesa_id(descrizione)"
          )
          .in("unita_id", unitaIds)
          .neq("stato_pagamento", "pagato")
      : Promise.resolve({ data: [] }),
  ]);

  const movimenti = (movimentiData ?? []) as unknown as MovimentoRiga[];
  const perUnita = new Map(unita.map((u) => [u.id, u]));

  const aperte: RipartizioneAperta[] = (
    (ripartizioniData ?? []) as unknown as RipartizioneRiga[]
  ).map((r) => {
    const u = perUnita.get(r.unita_id);
    return {
      id: r.id,
      unitaId: r.unita_id,
      identificativo: u?.identificativo ?? "",
      nominativi: [
        ...new Set(
          (u?.unita_proprietari ?? [])
            .map(
              (p) =>
                p.anagrafica?.nominativo ??
                (p.utente ? `${p.utente.nome} ${p.utente.cognome}` : null)
            )
            .filter((n): n is string => !!n)
        ),
      ],
      importoDovuto: r.importo_dovuto,
      dataScadenza: r.data_scadenza,
      codiceAvviso: r.codice_avviso,
    };
  });

  const descrizioneQuota = new Map(
    ((ripartizioniData ?? []) as unknown as RipartizioneRiga[]).map((r) => [
      r.id,
      r.spesa?.descrizione ?? "Quota condominiale",
    ])
  );

  const daAbbinare = movimenti.filter((m) => m.stato === "da_abbinare");
  const abbinati = movimenti.filter((m) => m.stato === "abbinato");
  const ignorati = movimenti.filter((m) => m.stato === "ignorato");

  const grezzi: MovimentoGrezzo[] = daAbbinare.map((m) => ({
    data: m.data,
    importo: m.importo,
    descrizione: m.descrizione,
    riferimento: m.riferimento,
    hash: m.import_hash,
  }));

  const esito = abbinaMovimenti(grezzi, aperte);
  const perHash = new Map(daAbbinare.map((m) => [m.import_hash, m]));

  const etichettaQuota = (r: RipartizioneAperta) =>
    `${r.identificativo} — ${descrizioneQuota.get(r.id) ?? "Quota"} — ${formatValuta(
      r.importoDovuto
    )}${r.dataScadenza ? ` — scad. ${formatData(r.dataScadenza)}` : ""}`;

  const quoteSelezionabili: QuotaSelezionabile[] = aperte
    .map((r) => ({ id: r.id, etichetta: etichettaQuota(r), importo: r.importoDovuto }))
    .sort((a, b) => a.etichetta.localeCompare(b.etichetta, "it", { numeric: true }));

  const totaleProposto = esito.abbinamenti.reduce((s, a) => s + a.movimento.importo, 0);

  return (
    <PageBody>
      <PageHeader
        titolo="Riconciliazione bancaria"
        descrizione="Carica l'estratto conto in CSV: il portale riconosce da solo gli accrediti che corrispondono a una quota aperta e ti chiede solo di confermare. Non tocca nulla senza il tuo assenso."
        azioni={
          condomini.length > 1 ? (
            <nav aria-label="Condominio" className="flex flex-wrap items-center gap-1.5">
              {condomini.map((c) => (
                <Link
                  key={c.id}
                  href={`/admin/riconciliazione?condominio=${c.id}`}
                  className="rounded-full"
                >
                  <Badge variant={c.id === condominioId ? "accent" : "outline"}>{c.nome}</Badge>
                </Link>
              ))}
            </nav>
          ) : undefined
        }
      />

      <StatGrid colonne={3}>
        <StatCard
          label="Da abbinare"
          value={daAbbinare.length}
          icon={ArrowRightLeft}
          tono={daAbbinare.length > 0 ? "warning" : "success"}
          hint={daAbbinare.length === 1 ? "movimento in coda" : "movimenti in coda"}
        />
        <StatCard
          label="Proposte pronte"
          value={esito.abbinamenti.length}
          icon={Scale}
          hint={esito.abbinamenti.length ? formatValuta(totaleProposto) : "niente da confermare"}
        />
        <StatCard
          label="Quote ancora aperte"
          value={aperte.length}
          icon={Banknote}
          tono={aperte.length > 0 ? "neutral" : "success"}
        />
      </StatGrid>

      <Card>
        <CardHeader>
          <CardHeaderText>
            <CardTitle>Carica l&apos;estratto conto</CardTitle>
            <CardDescription>
              Va bene il CSV di qualunque home banking: il portale riconosce da sé il separatore,
              i nomi delle colonne più diffusi, le date all&apos;italiana e gli importi scritti
              come «1.234,56». Ricaricare lo stesso file non crea doppioni.
            </CardDescription>
          </CardHeaderText>
        </CardHeader>
        <CaricaEstratto condominioId={condominioId} />
      </Card>

      <Section
        titolo="Proposte di abbinamento"
        descrizione="Accrediti che corrispondono a una quota aperta per importo, causale e data. Confermando, la quota risulta pagata alla data del movimento."
      >
        {esito.abbinamenti.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Movimento</TableHead>
                <TableHead numeric>Importo</TableHead>
                <TableHead>Quota corrispondente</TableHead>
                <TableHead>Riscontro</TableHead>
                <TableHead>
                  <span className="sr-only">Azioni</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {esito.abbinamenti.map((a) => {
                const riga = perHash.get(a.movimento.hash);
                if (!riga) return null;
                return (
                  <TableRow key={riga.id}>
                    <TableCell>
                      <span className="flex flex-col">
                        <span className="cifre text-sm font-medium">
                          {formatData(a.movimento.data)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {a.movimento.descrizione || "Senza causale"}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell etichetta="Importo" numeric className="font-medium text-success">
                      {formatValuta(a.movimento.importo)}
                    </TableCell>
                    <TableCell etichetta="Quota">{etichettaQuota(a.ripartizione)}</TableCell>
                    <TableCell etichetta="Riscontro">
                      <StatoBadge tipo="confidenza_abbinamento" valore={a.confidenza} />
                    </TableCell>
                    <TableCell className="md:text-right">
                      <ConfermaAbbinamentoButton
                        movimentoId={riga.id}
                        ripartizioneId={a.ripartizione.id}
                        descrizione={etichettaQuota(a.ripartizione)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            compatta
            icon={Scale}
            title="Nessuna proposta"
            description={
              daAbbinare.length
                ? "Nessuno degli accrediti in coda corrisponde con certezza a una quota aperta: abbinali a mano qui sotto."
                : "Carica un estratto conto per vedere le proposte."
            }
          />
        )}
      </Section>

      {esito.ambigui.length > 0 && (
        <Section
          titolo="Da decidere"
          descrizione="Più quote compatibili con lo stesso accredito: il portale non sceglie al posto tuo."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Movimento</TableHead>
                <TableHead numeric>Importo</TableHead>
                <TableHead>Quote compatibili</TableHead>
                <TableHead>
                  <span className="sr-only">Azioni</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {esito.ambigui.map((a) => {
                const riga = perHash.get(a.movimento.hash);
                if (!riga) return null;
                return (
                  <TableRow key={riga.id}>
                    <TableCell>
                      <span className="flex flex-col">
                        <span className="cifre text-sm font-medium">
                          {formatData(a.movimento.data)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {a.movimento.descrizione || "Senza causale"}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell etichetta="Importo" numeric className="font-medium text-success">
                      {formatValuta(a.movimento.importo)}
                    </TableCell>
                    <TableCell etichetta="Compatibili">
                      <span className="flex flex-col gap-0.5 text-xs">
                        {a.candidate.map((c) => (
                          <span key={c.id}>{etichettaQuota(c)}</span>
                        ))}
                      </span>
                    </TableCell>
                    <TableCell className="md:text-right">
                      <span className="flex flex-wrap items-center justify-end gap-1.5">
                        <AbbinaManualmenteButton
                          movimentoId={riga.id}
                          importoMovimento={riga.importo}
                          quote={quoteSelezionabili}
                        />
                        <IgnoraMovimentoButton movimentoId={riga.id} />
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Section>
      )}

      <Section
        titolo="Movimenti in coda"
        descrizione="Tutto quello che non è ancora stato abbinato: gli accrediti senza riscontro e le uscite dal conto, che non riguardano le quote."
      >
        {daAbbinare.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Causale</TableHead>
                <TableHead numeric>Importo</TableHead>
                <TableHead>
                  <span className="sr-only">Azioni</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {daAbbinare.map((m) => (
                <TableRow key={m.id}>
                  <TableCell etichetta="Data" className="cifre">
                    {formatData(m.data)}
                  </TableCell>
                  <TableCell etichetta="Causale">
                    <span className="flex flex-col">
                      <span>{m.descrizione || <Vuoto />}</span>
                      {m.riferimento && (
                        <span className="text-xs text-muted-foreground">
                          Rif. {m.riferimento}
                        </span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell
                    etichetta="Importo"
                    numeric
                    className={m.importo > 0 ? "font-medium text-success" : "font-medium"}
                  >
                    {formatValuta(m.importo)}
                  </TableCell>
                  <TableCell className="md:text-right">
                    <span className="flex flex-wrap items-center justify-end gap-1.5">
                      {m.importo > 0 && (
                        <AbbinaManualmenteButton
                          movimentoId={m.id}
                          importoMovimento={m.importo}
                          quote={quoteSelezionabili}
                        />
                      )}
                      <IgnoraMovimentoButton movimentoId={m.id} />
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            compatta
            icon={ArrowRightLeft}
            title="Nessun movimento in coda"
            description="Ogni riga dell'estratto conto importato è stata abbinata o messa da parte."
          />
        )}
      </Section>

      {(abbinati.length > 0 || ignorati.length > 0) && (
        <Section
          titolo="Già sistemati"
          descrizione="Movimenti abbinati a una quota o messi da parte. Se qualcosa è finito nel posto sbagliato, si rimette in coda da qui."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Causale</TableHead>
                <TableHead numeric>Importo</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>
                  <span className="sr-only">Azioni</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...abbinati, ...ignorati].slice(0, 50).map((m) => (
                <TableRow key={m.id}>
                  <TableCell etichetta="Data" className="cifre">
                    {formatData(m.data)}
                  </TableCell>
                  <TableCell etichetta="Causale">{m.descrizione || <Vuoto />}</TableCell>
                  <TableCell etichetta="Importo" numeric>
                    {formatValuta(m.importo)}
                  </TableCell>
                  <TableCell etichetta="Stato">
                    <StatoBadge tipo="stato_movimento" valore={m.stato} />
                  </TableCell>
                  <TableCell className="md:text-right">
                    <RipristinaMovimentoButton
                      movimentoId={m.id}
                      abbinato={m.stato === "abbinato"}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
      )}
    </PageBody>
  );
}
