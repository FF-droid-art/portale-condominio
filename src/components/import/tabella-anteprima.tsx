"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

// I campi numerici/data mancanti o non riconosciuti arrivano come NaN/null
// dalla coercizione: qui non sono "l'informazione", ma l'assenza di
// un'informazione, quindi si mostra un trattino invece del valore grezzo.
function formattaValoreCella(valore: unknown): string {
  if (valore === null || valore === undefined) return "—";
  if (typeof valore === "number" && Number.isNaN(valore)) return "—";
  return String(valore);
}

/**
 * Anteprima delle righe prima della scrittura sul database.
 *
 * Il messaggio d'errore sta subito sotto la riga che lo ha causato, non in
 * un elenco in fondo alla pagina: chi deve correggere il file ha bisogno di
 * vedere insieme il dato sbagliato e il motivo. Il filtro "solo errori"
 * serve quando le righe sono centinaia e quelle da sistemare poche.
 *
 * A differenza delle altre tabelle dell'applicazione questa non si impila su
 * schermo stretto: ha molte colonne tecniche e va letta confrontando le
 * colonne fra loro, quindi scorre in orizzontale.
 */
export function TabellaAnteprima<T extends object>({
  colonne,
  righe,
  erroriPerRiga,
}: {
  colonne: { chiave: keyof T; etichetta: string }[];
  righe: T[];
  erroriPerRiga: (string | null)[];
}) {
  const [soloErrori, setSoloErrori] = useState(false);
  const numeroErrori = erroriPerRiga.filter(Boolean).length;
  const numeroValide = righe.length - numeroErrori;

  const righeVisibili = righe
    .map((riga, indice) => ({ riga, indice, errore: erroriPerRiga[indice] }))
    .filter((r) => !soloErrori || r.errore);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
            <span className="cifre font-semibold">{numeroValide}</span>
            <span className="text-muted-foreground">
              {numeroValide === 1 ? "riga valida" : "righe valide"}
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <AlertTriangle
              className={cn("size-4", numeroErrori > 0 ? "text-danger" : "text-muted-foreground")}
              aria-hidden="true"
            />
            <span className={cn("cifre font-semibold", numeroErrori > 0 && "text-danger")}>
              {numeroErrori}
            </span>
            <span className="text-muted-foreground">
              {numeroErrori === 1 ? "riga con errori" : "righe con errori"}
            </span>
          </span>
        </div>

        {numeroErrori > 0 && (
          <Button variant="secondary" size="sm" onClick={() => setSoloErrori((v) => !v)}>
            {soloErrori ? "Mostra tutte le righe" : "Mostra solo gli errori"}
          </Button>
        )}
      </div>

      <Table stacked={false}>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            {colonne.map((colonna) => (
              <TableHead key={String(colonna.chiave)}>{colonna.etichetta}</TableHead>
            ))}
            {/* La colonna dei problemi compare solo se ce n'è almeno uno:
                quando il file è pulito non ha senso occupare spazio. */}
            {numeroErrori > 0 && <TableHead>Problema</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {righeVisibili.map(({ riga, indice, errore }) => (
            <TableRow key={indice} className={cn(errore && "bg-danger-bg/60")}>
              <TableCell className="cifre text-muted-foreground">{indice + 1}</TableCell>
              {colonne.map((colonna) => (
                <TableCell key={String(colonna.chiave)} className="whitespace-nowrap">
                  {formattaValoreCella(riga[colonna.chiave])}
                </TableCell>
              ))}
              {numeroErrori > 0 && (
                <TableCell className="min-w-56 text-danger">
                  {errore && (
                    <span className="flex items-start gap-1.5 text-xs font-medium">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                      {errore}
                    </span>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {righe.length > righeVisibili.length && (
        <p className="text-xs text-muted-foreground">
          Vengono mostrate {righeVisibili.length} righe su {righe.length}.
        </p>
      )}
    </div>
  );
}
