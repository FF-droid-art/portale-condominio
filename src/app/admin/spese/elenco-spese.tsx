"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Search, Wallet } from "lucide-react";
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
import { SearchField } from "@/components/ui/search-field";
import { formatData, formatValuta } from "@/lib/format";
import { cn } from "@/lib/cn";

export type SpesaInElenco = {
  id: string;
  descrizione: string;
  categoria: string;
  importo_totale: number;
  data_spesa: string;
  condominioNome: string | null;
  ripartizioniTotali: number;
  ripartizioniPagate: number;
};

type Campo = "descrizione" | "condominio" | "categoria" | "importo" | "data";
type Ordinamento = { campo: Campo; direzione: "asc" | "desc" };

const VALORE: Record<Campo, (s: SpesaInElenco) => string | number> = {
  descrizione: (s) => s.descrizione,
  condominio: (s) => s.condominioNome ?? "",
  categoria: (s) => s.categoria,
  importo: (s) => s.importo_totale,
  data: (s) => s.data_spesa,
};

/** Direzione di partenza più utile per ciascuna colonna al primo clic: i
 *  testi si leggono dalla A, importi e date partono dal valore più alto. */
const DIREZIONE_INIZIALE: Record<Campo, "asc" | "desc"> = {
  descrizione: "asc",
  condominio: "asc",
  categoria: "asc",
  importo: "desc",
  data: "desc",
};

/** Intestazione di colonna cliccabile per ordinare l'elenco. */
function IntestazioneOrdinabile({
  campo,
  ordinamento,
  onOrdina,
  numeric,
  children,
}: {
  campo: Campo;
  ordinamento: Ordinamento | null;
  onOrdina: (campo: Campo) => void;
  numeric?: boolean;
  children: React.ReactNode;
}) {
  const attiva = ordinamento?.campo === campo;
  const Icona = !attiva ? ArrowUpDown : ordinamento.direzione === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead
      numeric={numeric}
      aria-sort={attiva ? (ordinamento.direzione === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onOrdina(campo)}
        className={cn(
          "inline-flex items-center gap-1 rounded transition-colors hover:text-foreground",
          numeric && "flex-row-reverse",
          attiva && "text-foreground"
        )}
      >
        {children}
        <Icona
          className={cn("size-3.5", !attiva && "text-muted-foreground/50")}
          aria-hidden="true"
        />
      </button>
    </TableHead>
  );
}

/**
 * Elenco delle spese di tutti i condomìni gestiti.
 *
 * Gli importi sono a destra e con cifre a larghezza fissa, così una colonna
 * di euro si confronta scorrendola con l'occhio invece di leggerla numero
 * per numero. Il totale delle spese filtrate è mostrato sotto alla ricerca:
 * è la domanda che ci si pone subito dopo aver filtrato.
 *
 * Ogni intestazione di colonna ordina l'elenco al clic (di nuovo per
 * invertire il verso); ordinare per "Condominio" è il modo per rivedere
 * tutte le spese raggruppate per stabile, visto che l'elenco copre tutti i
 * condomìni gestiti insieme.
 */
export function ElencoSpese({ spese }: { spese: SpesaInElenco[] }) {
  const [ricerca, setRicerca] = useState("");
  // null = ordine di arrivo (le più recenti prima, come le restituisce il server).
  const [ordinamento, setOrdinamento] = useState<Ordinamento | null>(null);

  const visibili = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    const filtrate = !q
      ? spese
      : spese.filter((s) =>
          [s.descrizione, s.categoria, s.condominioNome ?? ""].some((campo) =>
            campo.toLowerCase().includes(q)
          )
        );

    if (!ordinamento) return filtrate;
    const leggi = VALORE[ordinamento.campo];
    const segno = ordinamento.direzione === "asc" ? 1 : -1;
    return [...filtrate].sort((a, b) => {
      const va = leggi(a);
      const vb = leggi(b);
      return typeof va === "number" && typeof vb === "number"
        ? (va - vb) * segno
        : String(va).localeCompare(String(vb), "it", { numeric: true }) * segno;
    });
  }, [spese, ricerca, ordinamento]);

  const totale = useMemo(
    () => visibili.reduce((somma, s) => somma + s.importo_totale, 0),
    [visibili]
  );

  function ordina(campo: Campo) {
    setOrdinamento((corrente) =>
      corrente?.campo === campo
        ? { campo, direzione: corrente.direzione === "asc" ? "desc" : "asc" }
        : { campo, direzione: DIREZIONE_INIZIALE[campo] }
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchField
          valore={ricerca}
          onCambia={setRicerca}
          placeholder="Cerca per descrizione, categoria o condominio…"
          etichetta="Cerca fra le spese"
        />
        <p className="text-sm text-muted-foreground">
          <span className="cifre font-semibold text-foreground">{visibili.length}</span>{" "}
          {visibili.length === 1 ? "spesa" : "spese"} · totale{" "}
          <span className="cifre font-semibold text-foreground">{formatValuta(totale)}</span>
        </p>
      </div>

      {visibili.length === 0 ? (
        <EmptyState
          compatta
          icon={Search}
          title="Nessuna spesa trovata"
          description={`Nessun risultato per "${ricerca}". Prova con un'altra descrizione o categoria.`}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <IntestazioneOrdinabile campo="descrizione" ordinamento={ordinamento} onOrdina={ordina}>
                Descrizione
              </IntestazioneOrdinabile>
              <IntestazioneOrdinabile campo="condominio" ordinamento={ordinamento} onOrdina={ordina}>
                Condominio
              </IntestazioneOrdinabile>
              <IntestazioneOrdinabile campo="categoria" ordinamento={ordinamento} onOrdina={ordina}>
                Categoria
              </IntestazioneOrdinabile>
              <IntestazioneOrdinabile
                campo="importo"
                numeric
                ordinamento={ordinamento}
                onOrdina={ordina}
              >
                Importo
              </IntestazioneOrdinabile>
              <IntestazioneOrdinabile campo="data" ordinamento={ordinamento} onOrdina={ordina}>
                Data
              </IntestazioneOrdinabile>
              <TableHead>Pagamenti</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibili.map((s) => {
              const haRipartizioni = s.ripartizioniTotali > 0;
              const tuttePagate = haRipartizioni && s.ripartizioniPagate === s.ripartizioniTotali;
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/admin/spese/${s.id}`}
                      className="rounded transition-colors hover:text-accent-ink"
                    >
                      <RowIcon icon={Wallet}>{s.descrizione}</RowIcon>
                    </Link>
                  </TableCell>
                  <TableCell etichetta="Condominio">{s.condominioNome ?? <Vuoto />}</TableCell>
                  <TableCell etichetta="Categoria">
                    <Badge variant="outline">{s.categoria}</Badge>
                  </TableCell>
                  <TableCell etichetta="Importo" numeric className="font-semibold">
                    {formatValuta(s.importo_totale)}
                  </TableCell>
                  <TableCell etichetta="Data">{formatData(s.data_spesa)}</TableCell>
                  <TableCell etichetta="Pagamenti">
                    {haRipartizioni ? (
                      <Badge variant={tuttePagate ? "success" : "warning"} punto>
                        <span className="cifre">
                          {s.ripartizioniPagate}/{s.ripartizioniTotali}
                        </span>{" "}
                        pagate
                      </Badge>
                    ) : (
                      <Badge variant="neutral">Non ripartita</Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
