"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { creaDelega } from "./actions";
import { Field, FormGrid, Select } from "@/components/ui/input";
import { FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function DelegaForm({
  assembleaId,
  unitaDelegabili,
  candidati,
}: {
  assembleaId: string;
  unitaDelegabili: { id: string; identificativo: string }[];
  candidati: {
    utenteId: string;
    nome: string;
    cognome: string;
    unitaId: string;
    identificativo: string;
  }[];
}) {
  const [stato, action, pending] = useActionState(creaDelega, undefined);

  if (!unitaDelegabili.length) return null;

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="assemblea_id" value={assembleaId} />

      <FormGrid colonne={2}>
        <Field id="unita_delegante_id" label="La tua unità" required>
          <Select name="unita_delegante_id" required defaultValue="">
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

        <Field
          id="candidato"
          label="Delega il voto a"
          required
          hint={
            candidati.length
              ? "Solo condòmini dello stesso condominio con diritto di voto."
              : undefined
          }
        >
          <Select name="candidato" required defaultValue="" disabled={!candidati.length}>
            <option value="" disabled>
              {candidati.length ? "Seleziona un condòmino" : "Nessun altro condòmino disponibile"}
            </option>
            {candidati.map((c) => (
              <option key={`${c.unitaId}|${c.utenteId}`} value={`${c.unitaId}|${c.utenteId}`}>
                {c.nome} {c.cognome} — {c.identificativo}
              </option>
            ))}
          </Select>
        </Field>
      </FormGrid>

      <FormError>{stato?.errore}</FormError>

      <Button
        type="submit"
        pending={pending}
        disabled={!candidati.length}
        className="w-fit"
        variant="secondary"
      >
        <Send className="size-4" aria-hidden="true" />
        {pending ? "Invio in corso…" : "Delega il voto"}
      </Button>
    </form>
  );
}
