"use client";

import { useActionState } from "react";
import { aggiungiProprietario } from "./actions";
import { Field, Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ProprietarioForm({
  unitaId,
  candidati,
}: {
  unitaId: string;
  candidati: { id: string; nome: string; cognome: string; email: string }[];
}) {
  const [stato, action, pending] = useActionState(aggiungiProprietario, undefined);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="unita_id" value={unitaId} />

      <Field>
        <Label htmlFor="utente_id">Condomino</Label>
        <Select id="utente_id" name="utente_id" required defaultValue="">
          <option value="" disabled>
            Seleziona condomino
          </option>
          {candidati.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome} {u.cognome} — {u.email}
            </option>
          ))}
        </Select>
      </Field>

      <Field>
        <Label htmlFor="quota_possesso">Quota di possesso (%)</Label>
        <Input
          id="quota_possesso"
          name="quota_possesso"
          type="number"
          step="0.01"
          min="0.01"
          max="100"
          defaultValue={100}
          required
        />
      </Field>

      {stato?.errore && <p className="text-sm text-danger">{stato.errore}</p>}

      <Button type="submit" pending={pending} disabled={!candidati.length}>
        {candidati.length ? "Aggiungi proprietario" : "Nessun condomino disponibile"}
      </Button>
    </form>
  );
}
