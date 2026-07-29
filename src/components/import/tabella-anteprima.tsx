"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

// I campi numerici/data mancanti o non riconosciuti arrivano come NaN/null
// dalla coercizione: qui non sono "l'informazione", ma l'assenza di
// un'informazione, quindi si mostra un trattino invece del valore grezzo.
function formattaValoreCella(valore: unknown): string {
  if (valore === null || valore === undefined) return "—";
  if (typeof valore === "number" && Number.isNaN(valore)) return "—";
  return String(valore);
}

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

  const righeVisibili = righe
    .map((riga, indice) => ({ riga, indice, errore: erroriPerRiga[indice] }))
    .filter((r) => !soloErrori || r.errore);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm">
        <p>
          <span className="font-medium">{righe.length - numeroErrori}</span> righe valide,{" "}
          <span className={cn("font-medium", numeroErrori > 0 && "text-danger")}>
            {numeroErrori}
          </span>{" "}
          con errori
        </p>
        {numeroErrori > 0 && (
          <button
            type="button"
            onClick={() => setSoloErrori((v) => !v)}
            className="text-accent hover:underline"
          >
            {soloErrori ? "Mostra tutte" : "Mostra solo errori"}
          </button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            {colonne.map((colonna) => (
              <TableHead key={String(colonna.chiave)}>{colonna.etichetta}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {righeVisibili.map(({ riga, indice, errore }) => (
            <TableRow key={indice} className={errore ? "bg-danger-bg" : undefined}>
              <TableCell className="text-muted-foreground">{indice + 1}</TableCell>
              {colonne.map((colonna) => (
                <TableCell key={String(colonna.chiave)}>
                  {formattaValoreCella(riga[colonna.chiave])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {righeVisibili.some((r) => r.errore) && (
        <div className="flex flex-col gap-1 text-sm text-danger">
          {righeVisibili
            .filter((r) => r.errore)
            .map((r) => (
              <p key={r.indice} className="flex items-center gap-1.5">
                <AlertTriangle className="size-3.5 shrink-0" />
                Riga {r.indice + 1}: {r.errore}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
