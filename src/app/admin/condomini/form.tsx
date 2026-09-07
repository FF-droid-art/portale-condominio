"use client";

import { useActionState } from "react";
import { creaCondominio } from "./actions";
import { useAlSuccesso } from "@/lib/hooks";
import { Field, FormGrid, Input } from "@/components/ui/input";
import { FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Modulo di creazione di un condominio.
 *
 * I campi sono in due blocchi: prima l'identità del condominio (i tre dati
 * senza i quali non si va avanti), poi il conto corrente, tutto opzionale e
 * compilabile anche più tardi dalla scheda del condominio.
 */
export function CondominioForm({
  onFatto,
  annulla,
}: {
  onFatto?: () => void;
  annulla?: React.ReactNode;
}) {
  const [stato, action, pending] = useActionState(creaCondominio, undefined);
  useAlSuccesso(pending, stato, () => onFatto?.());

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="flex flex-col gap-4">
        <Field id="nome" label="Nome" required>
          <Input name="nome" placeholder="Es. Condominio Il Glicine" required />
        </Field>
        <Field id="indirizzo" label="Indirizzo" required>
          <Input name="indirizzo" placeholder="Es. Via Roma 12, Milano" required />
        </Field>
        <Field id="codice_fiscale" label="Codice fiscale" hint="Facoltativo.">
          <Input name="codice_fiscale" autoCapitalize="characters" spellCheck={false} />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-4 rounded-xl border border-border p-4">
        <legend className="px-1.5 text-sm font-medium text-muted-foreground">
          Conto corrente (facoltativo)
        </legend>
        <Field id="iban" label="IBAN">
          <Input
            name="iban"
            placeholder="IT00 X000 0000 0000 0000 0000 000"
            autoCapitalize="characters"
            spellCheck={false}
            className="font-mono"
          />
        </Field>
        <FormGrid colonne={2}>
          <Field id="banca" label="Banca">
            <Input name="banca" placeholder="Nome della banca" />
          </Field>
          <Field id="intestatario_conto" label="Intestatario">
            <Input name="intestatario_conto" placeholder="Es. Condominio Via Roma 12" />
          </Field>
        </FormGrid>
      </fieldset>

      <FormError>{stato?.errore}</FormError>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {annulla}
        <Button type="submit" pending={pending}>
          {pending ? "Salvataggio…" : "Aggiungi condominio"}
        </Button>
      </div>
    </form>
  );
}
