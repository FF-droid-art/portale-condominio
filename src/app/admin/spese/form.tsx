"use client";

import { useActionState } from "react";
import { creaSpesa } from "./actions";
import { Field, Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SpesaForm({
  condomini,
}: {
  condomini: { id: string; nome: string }[];
}) {
  const [stato, action, pending] = useActionState(creaSpesa, undefined);

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
        <Label htmlFor="descrizione">Descrizione</Label>
        <Input id="descrizione" name="descrizione" required />
      </Field>
      <Field>
        <Label htmlFor="categoria">Categoria</Label>
        <Input
          id="categoria"
          name="categoria"
          placeholder="Es. ordinaria, ascensore"
          required
        />
      </Field>
      <Field>
        <Label htmlFor="importo_totale">Importo totale</Label>
        <Input
          id="importo_totale"
          name="importo_totale"
          type="number"
          step="0.01"
          min="0"
          required
        />
      </Field>
      <Field>
        <Label htmlFor="data_spesa">Data</Label>
        <Input id="data_spesa" name="data_spesa" type="date" required />
      </Field>
      <Field>
        <Label htmlFor="fornitore">Fornitore (opzionale)</Label>
        <Input id="fornitore" name="fornitore" />
      </Field>

      {stato?.errore && <p className="text-sm text-danger">{stato.errore}</p>}

      <Button type="submit" pending={pending} disabled={!condomini.length}>
        {condomini.length
          ? pending
            ? "Salvataggio…"
            : "Aggiungi spesa"
          : "Crea prima un condominio"}
      </Button>
    </form>
  );
}
