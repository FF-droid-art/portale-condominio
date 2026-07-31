"use client";

import { useActionState } from "react";
import { creaCondominio } from "./actions";
import { Field, Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function CondominioForm() {
  const [stato, action, pending] = useActionState(creaCondominio, undefined);

  return (
    <form action={action} className="flex flex-col gap-3">
      <Field>
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" name="nome" placeholder="Nome" required />
      </Field>
      <Field>
        <Label htmlFor="indirizzo">Indirizzo</Label>
        <Input id="indirizzo" name="indirizzo" placeholder="Indirizzo" required />
      </Field>
      <Field>
        <Label htmlFor="codice_fiscale">Codice fiscale (opzionale)</Label>
        <Input id="codice_fiscale" name="codice_fiscale" placeholder="Codice fiscale" />
      </Field>
      <Field>
        <Label htmlFor="iban">IBAN (opzionale)</Label>
        <Input id="iban" name="iban" placeholder="IT00 X000 0000 0000 0000 0000 000" />
      </Field>
      <Field>
        <Label htmlFor="banca">Banca (opzionale)</Label>
        <Input id="banca" name="banca" placeholder="Nome della banca" />
      </Field>
      <Field>
        <Label htmlFor="intestatario_conto">Intestatario conto (opzionale)</Label>
        <Input id="intestatario_conto" name="intestatario_conto" placeholder="Es. Condominio Via Roma 12" />
      </Field>

      {stato?.errore && <p className="text-sm text-danger">{stato.errore}</p>}

      <Button type="submit" pending={pending}>
        {pending ? "Salvataggio…" : "Aggiungi condominio"}
      </Button>
    </form>
  );
}
