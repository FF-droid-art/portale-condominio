"use client";

import { useActionState } from "react";
import { creaDelega } from "./actions";
import { Field, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function DelegaForm({
  assembleaId,
  unitaDelegabili,
  candidati,
}: {
  assembleaId: string;
  unitaDelegabili: { id: string; identificativo: string }[];
  candidati: { utenteId: string; nome: string; cognome: string; unitaId: string; identificativo: string }[];
}) {
  const [stato, action, pending] = useActionState(creaDelega, undefined);

  if (!unitaDelegabili.length) return null;

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="assemblea_id" value={assembleaId} />

      <Field>
        <Label htmlFor="unita_delegante_id">La tua unità</Label>
        <Select id="unita_delegante_id" name="unita_delegante_id" required defaultValue="">
          <option value="" disabled>
            Seleziona la tua unità
          </option>
          {unitaDelegabili.map((u) => (
            <option key={u.id} value={u.id}>
              {u.identificativo}
            </option>
          ))}
        </Select>
      </Field>

      <Field>
        <Label htmlFor="candidato">Delega il voto a</Label>
        <Select id="candidato" name="candidato" required defaultValue="" disabled={!candidati.length}>
          <option value="" disabled>
            {candidati.length ? "Seleziona un condomino" : "Nessun altro condomino disponibile"}
          </option>
          {candidati.map((c) => (
            <option key={`${c.unitaId}|${c.utenteId}`} value={`${c.unitaId}|${c.utenteId}`}>
              {c.nome} {c.cognome} — {c.identificativo}
            </option>
          ))}
        </Select>
      </Field>

      {stato?.errore && <p className="text-sm text-danger">{stato.errore}</p>}

      <Button type="submit" pending={pending} size="sm" disabled={!candidati.length} className="w-fit">
        {pending ? "Invio…" : "Delega il voto"}
      </Button>
    </form>
  );
}
