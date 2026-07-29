"use client";

import { useActionState } from "react";
import { creaAssemblea } from "./actions";
import { Field, Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function AssembleaForm({
  condomini,
}: {
  condomini: { id: string; nome: string }[];
}) {
  const [stato, action, pending] = useActionState(creaAssemblea, undefined);

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
        <Label htmlFor="data_assemblea">Data e ora</Label>
        <Input
          id="data_assemblea"
          name="data_assemblea"
          type="datetime-local"
          required
        />
      </Field>

      <Field>
        <Label htmlFor="tipo">Tipo</Label>
        <Select id="tipo" name="tipo" required defaultValue="ordinaria">
          <option value="ordinaria">Ordinaria</option>
          <option value="straordinaria">Straordinaria</option>
        </Select>
      </Field>

      {stato?.errore && <p className="text-sm text-danger">{stato.errore}</p>}

      <Button type="submit" pending={pending} disabled={!condomini.length}>
        {condomini.length
          ? pending
            ? "Salvataggio…"
            : "Convoca assemblea"
          : "Crea prima un condominio"}
      </Button>
    </form>
  );
}
