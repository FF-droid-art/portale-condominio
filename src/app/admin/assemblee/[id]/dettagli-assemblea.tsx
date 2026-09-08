"use client";

import { useActionState } from "react";
import { aggiornaDettagliAssemblea } from "./actions";
import { Card, CardHeader, CardHeaderText, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, FormGrid, Input, Select } from "@/components/ui/input";
import { FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { Convocazione } from "@/lib/quorum";

/**
 * Luogo e convocazione: due dati che il portale non aveva e che servono ai
 * documenti generati (convocazione, verbale) e al calcolo del quorum — le
 * soglie dell'art. 1136 c.c. sono diverse in prima e seconda convocazione.
 */
export function DettagliAssemblea({
  assembleaId,
  luogo,
  convocazione,
}: {
  assembleaId: string;
  luogo: string | null;
  convocazione: Convocazione;
}) {
  const [stato, action, pending] = useActionState(aggiornaDettagliAssemblea, undefined);

  return (
    <Card>
      <CardHeader>
        <CardHeaderText>
          <CardTitle>Luogo e convocazione</CardTitle>
          <CardDescription>
            La convocazione determina le soglie di quorum applicate: in seconda convocazione
            sono più basse (art. 1136 c.c.).
          </CardDescription>
        </CardHeaderText>
      </CardHeader>

      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="assemblea_id" value={assembleaId} />
        <FormGrid colonne={2}>
          <Field id="luogo" label="Luogo">
            <Input
              name="luogo"
              defaultValue={luogo ?? ""}
              placeholder="Es. Sala riunioni, piano terra"
            />
          </Field>
          <Field id="convocazione" label="Convocazione">
            <Select name="convocazione" defaultValue={String(convocazione)}>
              <option value="1">Prima convocazione</option>
              <option value="2">Seconda convocazione</option>
            </Select>
          </Field>
        </FormGrid>
        <FormError>{stato?.errore}</FormError>
        <Button type="submit" variant="secondary" pending={pending} className="w-fit">
          {pending ? "Salvataggio…" : "Salva"}
        </Button>
      </form>
    </Card>
  );
}
