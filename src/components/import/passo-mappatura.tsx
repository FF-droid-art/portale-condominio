"use client";

import { Info } from "lucide-react";
import { Field, Select } from "@/components/ui/input";
import type { CampoImport } from "@/lib/import/tipi";

/**
 * Abbinamento fra i campi del portale e le colonne del file caricato.
 *
 * Sotto ogni menu compare un esempio preso dalle prime righe reali del file:
 * è il modo più rapido per accorgersi di aver abbinato la colonna sbagliata,
 * molto prima di arrivare all'anteprima.
 */
export function PassoMappatura({
  campi,
  intestazioni,
  righeGrezze,
  mappatura,
  onChange,
}: {
  campi: CampoImport[];
  intestazioni: string[];
  righeGrezze: unknown[][];
  mappatura: Record<string, number | null>;
  onChange: (mappatura: Record<string, number | null>) => void;
}) {
  function anteprimaColonna(indice: number): string {
    return righeGrezze
      .slice(0, 3)
      .map((riga) => String(riga[indice] ?? ""))
      .filter(Boolean)
      .join(", ");
  }

  const obbligatoriMancanti = campi.filter(
    (c) => c.obbligatorio && mappatura[c.chiave] == null
  ).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-2.5 rounded-xl border border-border bg-surface-muted/40 p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm leading-relaxed text-muted-foreground">
          Abbiamo proposto un abbinamento automatico in base ai nomi delle colonne: controllalo
          prima di continuare.{" "}
          {obbligatoriMancanti > 0 && (
            <span className="font-medium text-foreground">
              {obbligatoriMancanti === 1
                ? "Manca ancora un campo obbligatorio."
                : `Mancano ancora ${obbligatoriMancanti} campi obbligatori.`}
            </span>
          )}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {campi.map((campo) => {
          const indiceSelezionato = mappatura[campo.chiave];
          const esempio =
            indiceSelezionato != null ? anteprimaColonna(indiceSelezionato) : null;
          return (
            <Field
              key={campo.chiave}
              id={`mappa_${campo.chiave}`}
              label={campo.etichetta}
              required={campo.obbligatorio}
              hint={
                indiceSelezionato != null ? `Esempio: ${esempio || "(vuoto)"}` : undefined
              }
            >
              <Select
                value={indiceSelezionato ?? ""}
                onChange={(e) =>
                  onChange({
                    ...mappatura,
                    [campo.chiave]: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              >
                <option value="">— non abbinato —</option>
                {intestazioni.map((intestazione, indice) => (
                  <option key={indice} value={indice}>
                    {intestazione || `Colonna ${indice + 1}`}
                  </option>
                ))}
              </Select>
            </Field>
          );
        })}
      </div>
    </div>
  );
}
