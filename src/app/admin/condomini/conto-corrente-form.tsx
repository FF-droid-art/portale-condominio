"use client";

import { useActionState } from "react";
import { aggiornaContoCorrente } from "./actions";
import { Field, Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Condominio } from "@/lib/types";

export function ContoCorrenteForm({ condominio }: { condominio: Condominio }) {
  const [stato, action, pending] = useActionState(aggiornaContoCorrente, undefined);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="condominio_id" value={condominio.id} />
      <Field>
        <Label htmlFor="iban">IBAN</Label>
        <Input id="iban" name="iban" defaultValue={condominio.iban ?? ""} placeholder="IT00 X000 0000 0000 0000 0000 000" />
      </Field>
      <Field>
        <Label htmlFor="banca">Banca</Label>
        <Input id="banca" name="banca" defaultValue={condominio.banca ?? ""} placeholder="Nome della banca" />
      </Field>
      <Field>
        <Label htmlFor="intestatario_conto">Intestatario conto</Label>
        <Input
          id="intestatario_conto"
          name="intestatario_conto"
          defaultValue={condominio.intestatario_conto ?? ""}
          placeholder="Es. Condominio Via Roma 12"
        />
      </Field>

      {stato?.errore && <p className="text-sm text-danger">{stato.errore}</p>}

      <Button type="submit" pending={pending}>
        {pending ? "Salvataggio…" : "Salva conto corrente"}
      </Button>
    </form>
  );
}
