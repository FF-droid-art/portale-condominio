"use client";

import { useActionState } from "react";
import { creaTabellaMillesimale } from "./actions";
import { Field, Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function TabellaMillesimaleForm({
  condominioId,
  tabelleEsistenti,
}: {
  condominioId: string;
  tabelleEsistenti: { id: string; nome: string }[];
}) {
  const [stato, action, pending] = useActionState(creaTabellaMillesimale, undefined);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="condominio_id" value={condominioId} />

      <Field>
        <Label htmlFor="nome">Nome tabella</Label>
        <Input id="nome" name="nome" placeholder="Es. Ascensore, Riscaldamento" required />
      </Field>

      <Field>
        <Label htmlFor="copia_da">Valori di partenza</Label>
        <Select id="copia_da" name="copia_da" defaultValue="generale">
          <option value="">Parti da zero</option>
          <option value="generale">Copia dai millesimi generali</option>
          {tabelleEsistenti.map((t) => (
            <option key={t.id} value={t.id}>
              Copia da &quot;{t.nome}&quot;
            </option>
          ))}
        </Select>
      </Field>

      {stato?.errore && <p className="text-sm text-danger">{stato.errore}</p>}

      <Button type="submit" pending={pending}>
        {pending ? "Creazione…" : "Crea tabella"}
      </Button>
    </form>
  );
}
