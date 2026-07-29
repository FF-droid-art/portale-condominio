"use client";

import { Field, Label, Select } from "@/components/ui/input";
import type { CampoImport } from "@/lib/import/tipi";

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

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Abbina ogni campo alla colonna corrispondente nel tuo file. Abbiamo
        suggerito una mappatura automatica: controllala prima di continuare.
      </p>
      {campi.map((campo) => {
        const indiceSelezionato = mappatura[campo.chiave];
        return (
          <Field key={campo.chiave}>
            <Label htmlFor={`mappa_${campo.chiave}`}>
              {campo.etichetta}
              {campo.obbligatorio && <span className="text-danger"> *</span>}
            </Label>
            <Select
              id={`mappa_${campo.chiave}`}
              value={indiceSelezionato ?? ""}
              onChange={(e) =>
                onChange({
                  ...mappatura,
                  [campo.chiave]: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            >
              <option value="">— non mappato —</option>
              {intestazioni.map((intestazione, indice) => (
                <option key={indice} value={indice}>
                  {intestazione || `Colonna ${indice + 1}`}
                </option>
              ))}
            </Select>
            {indiceSelezionato !== null && indiceSelezionato !== undefined && (
              <p className="text-xs text-muted-foreground truncate">
                Esempio: {anteprimaColonna(indiceSelezionato) || "(vuoto)"}
              </p>
            )}
          </Field>
        );
      })}
    </div>
  );
}
