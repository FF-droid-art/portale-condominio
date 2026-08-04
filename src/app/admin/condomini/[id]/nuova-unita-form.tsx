"use client";

import { useActionState } from "react";
import { creaUnita } from "../actions";
import { Field, Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function NuovaUnitaForm({
  condominioId,
  tabelle = [],
}: {
  condominioId: string;
  tabelle?: { id: string; nome: string }[];
}) {
  const [stato, action, pending] = useActionState(creaUnita, undefined);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="condominio_id" value={condominioId} />
      <div className="flex flex-wrap items-end gap-3">
        <Field className="min-w-48 flex-1">
          <Label htmlFor="identificativo">Unità (identificativo)</Label>
          <Input
            id="identificativo"
            name="identificativo"
            placeholder="Es. Scala A - Interno 3"
            required
          />
        </Field>

        {tabelle.length > 0 ? (
          tabelle.map((t) => (
            <Field key={t.id} className="w-36">
              <Label htmlFor={`mill_${t.id}`}>Millesimi {t.nome}</Label>
              <Input
                id={`mill_${t.id}`}
                name={`mill_${t.id}`}
                type="number"
                step="0.001"
                min="0"
                placeholder="0"
              />
            </Field>
          ))
        ) : (
          <Field className="w-40">
            <Label htmlFor="mill_generale">Millesimi generali</Label>
            <Input
              id="mill_generale"
              name="mill_generale"
              type="number"
              step="0.001"
              min="0"
              placeholder="0"
            />
          </Field>
        )}

        <Button type="submit" pending={pending}>
          {pending ? "Salvataggio…" : "Aggiungi unità"}
        </Button>
      </div>
      {stato?.errore && <p className="text-sm text-danger">{stato.errore}</p>}
    </form>
  );
}
