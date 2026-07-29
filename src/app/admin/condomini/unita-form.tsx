"use client";

import { useActionState } from "react";
import { creaUnita } from "./actions";
import { Field, Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function UnitaForm({
  condomini,
}: {
  condomini: { id: string; nome: string }[];
}) {
  const [stato, action, pending] = useActionState(creaUnita, undefined);

  return (
    <form action={action} className="flex flex-col gap-3">
      <Field>
        <Label htmlFor="condominio_id">Condominio</Label>
        <Select id="condominio_id" name="condominio_id" required defaultValue="">
          <option value="" disabled>
            Seleziona condominio
          </option>
          {condomini.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Select>
      </Field>

      <Field>
        <Label htmlFor="identificativo">Identificativo</Label>
        <Input
          id="identificativo"
          name="identificativo"
          placeholder="Es. Scala A - Interno 3"
          required
        />
      </Field>
      <Field>
        <Label htmlFor="piano">Piano (opzionale)</Label>
        <Input id="piano" name="piano" placeholder="Piano" />
      </Field>
      <Field>
        <Label htmlFor="millesimi_proprieta">Millesimi di proprietà</Label>
        <Input
          id="millesimi_proprieta"
          name="millesimi_proprieta"
          type="number"
          step="0.001"
          min="0"
          required
        />
      </Field>

      {stato?.errore && <p className="text-sm text-danger">{stato.errore}</p>}

      <Button type="submit" pending={pending} disabled={!condomini.length}>
        {condomini.length
          ? pending
            ? "Salvataggio…"
            : "Aggiungi unità"
          : "Crea prima un condominio"}
      </Button>
    </form>
  );
}
