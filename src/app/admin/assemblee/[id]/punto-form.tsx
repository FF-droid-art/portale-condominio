"use client";

import { useActionState } from "react";
import { creaPuntoOdg } from "./actions";
import { Field, Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function PuntoOdgForm({
  assembleaId,
  prossimoNumero,
}: {
  assembleaId: string;
  prossimoNumero: number;
}) {
  const [stato, action, pending] = useActionState(creaPuntoOdg, undefined);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="assemblea_id" value={assembleaId} />

      <div className="flex gap-3">
        <Field className="w-28">
          <Label htmlFor="numero_punto">Numero</Label>
          <Input
            id="numero_punto"
            name="numero_punto"
            type="number"
            min="1"
            defaultValue={prossimoNumero}
            required
          />
        </Field>
        <Field className="flex-1">
          <Label htmlFor="tipo_maggioranza">Maggioranza</Label>
          <Select id="tipo_maggioranza" name="tipo_maggioranza" defaultValue="semplice">
            <option value="semplice">Semplice</option>
            <option value="qualificata_intervenuti">Qualificata intervenuti</option>
          </Select>
        </Field>
      </div>

      <Field>
        <Label htmlFor="descrizione">Descrizione</Label>
        <Input
          id="descrizione"
          name="descrizione"
          placeholder="Es. Approvazione preventivo rifacimento facciata"
          required
        />
      </Field>

      {stato?.errore && <p className="text-sm text-danger">{stato.errore}</p>}

      <Button type="submit" pending={pending}>
        {pending ? "Salvataggio…" : "Aggiungi punto"}
      </Button>
    </form>
  );
}
