"use client";

import { useMemo, useState } from "react";
import { Wallet } from "lucide-react";
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
import { StatoBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatData, formatValuta } from "@/lib/format";
import { cn } from "@/lib/cn";
import { PagamentoButton } from "./pagamento-button";

export type RipartizioneCondomino = {
  id: string;
  importo_dovuto: number;
  stato_pagamento: string;
  data_scadenza: string | null;
  codice_avviso: string | null;
  spesa: { descrizione: string; categoria: string } | null;
};

type Filtro = "tutte" | "da_pagare" | "pagate";

const ETICHETTE: Record<Filtro, string> = {
  tutte: "Tutte",
  da_pagare: "Da pagare",
  pagate: "Pagate",
};

/**
 * Elenco delle quote a carico del condòmino.
 *
 * Il filtro lavora solo sui dati già ricevuti dal server: nessuna richiesta
 * aggiuntiva, ma chi ha decine di righe arriva subito a quelle che deve
 * ancora pagare, che è la ragione principale per cui apre questa pagina.
 */
export function ElencoRipartizioni({
  ripartizioni,
}: {
  ripartizioni: RipartizioneCondomino[];
}) {
  const [filtro, setFiltro] = useState<Filtro>("tutte");

  const conteggi = useMemo(
    () => ({
      tutte: ripartizioni.length,
      da_pagare: ripartizioni.filter((r) => r.stato_pagamento !== "pagato").length,
      pagate: ripartizioni.filter((r) => r.stato_pagamento === "pagato").length,
    }),
    [ripartizioni]
  );

  const visibili = useMemo(() => {
    if (filtro === "da_pagare") return ripartizioni.filter((r) => r.stato_pagamento !== "pagato");
    if (filtro === "pagate") return ripartizioni.filter((r) => r.stato_pagamento === "pagato");
    return ripartizioni;
  }, [ripartizioni, filtro]);

  if (!ripartizioni.length) {
    return (
      <EmptyState
        icon={Wallet}
        title="Nessuna spesa a tuo carico"
        description="Quando l'amministratore registrerà una spesa che ti riguarda, la troverai qui con importo e scadenza."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="group"
        aria-label="Filtra le quote"
        className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-surface-muted/60 p-1"
      >
        {(Object.keys(ETICHETTE) as Filtro[]).map((chiave) => {
          const attivo = filtro === chiave;
          return (
            <button
              key={chiave}
              type="button"
              onClick={() => setFiltro(chiave)}
              aria-pressed={attivo}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                attivo
                  ? "bg-surface text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {ETICHETTE[chiave]}
              <span
                className={cn(
                  "cifre rounded-full px-1.5 text-xs",
                  attivo ? "bg-accent-subtle text-accent-ink" : "bg-surface-muted text-muted-foreground"
                )}
              >
                {conteggi[chiave]}
              </span>
            </button>
          );
        })}
      </div>

      {visibili.length === 0 ? (
        <EmptyState
          compatta
          icon={Wallet}
          title={
            filtro === "da_pagare"
              ? "Nessuna quota da pagare"
              : "Nessuna quota già pagata"
          }
          description={
            filtro === "da_pagare"
              ? "Sei in regola con tutte le quote registrate finora."
              : "Le quote saldate compariranno qui."
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Spesa</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead numeric>Importo</TableHead>
              <TableHead>Scadenza</TableHead>
              <TableHead>Codice avviso</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>
                <span className="sr-only">Azioni</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibili.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  <RowIcon icon={Wallet}>{r.spesa?.descrizione ?? <Vuoto />}</RowIcon>
                </TableCell>
                <TableCell etichetta="Categoria">{r.spesa?.categoria ?? <Vuoto />}</TableCell>
                <TableCell etichetta="Importo" numeric className="font-semibold">
                  {formatValuta(r.importo_dovuto)}
                </TableCell>
                <TableCell etichetta="Scadenza">
                  {r.data_scadenza ? formatData(r.data_scadenza) : <Vuoto />}
                </TableCell>
                <TableCell etichetta="Codice avviso" className="font-mono text-xs">
                  {r.codice_avviso ?? <Vuoto />}
                </TableCell>
                <TableCell etichetta="Stato">
                  <StatoBadge tipo="stato_pagamento" valore={r.stato_pagamento} />
                </TableCell>
                <TableCell className="md:text-right">
                  {r.stato_pagamento !== "pagato" && (
                    <PagamentoButton
                      ripartizioneId={r.id}
                      descrizione={r.spesa?.descrizione}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
