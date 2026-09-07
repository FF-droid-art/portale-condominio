"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Wallet } from "lucide-react";
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

/**
 * Elenco delle spese di tutti i condomìni gestiti.
 *
 * Gli importi sono a destra e con cifre a larghezza fissa, così una colonna
 * di euro si confronta scorrendola con l'occhio invece di leggerla numero
 * per numero. Il totale delle spese filtrate è mostrato sotto alla ricerca:
 * è la domanda che ci si pone subito dopo aver filtrato.
 */
export function ElencoSpese({ spese }: { spese: SpesaInElenco[] }) {
  const [ricerca, setRicerca] = useState("");

  const visibili = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    if (!q) return spese;
    return spese.filter((s) =>
      [s.descrizione, s.categoria, s.condominioNome ?? ""].some((campo) =>
        campo.toLowerCase().includes(q)
      )
    );
  }, [spese, ricerca]);

  const totale = useMemo(
    () => visibili.reduce((somma, s) => somma + s.importo_totale, 0),
    [visibili]
  );

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
              <TableHead>Descrizione</TableHead>
              <TableHead>Condominio</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead numeric>Importo</TableHead>
              <TableHead>Data</TableHead>
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
