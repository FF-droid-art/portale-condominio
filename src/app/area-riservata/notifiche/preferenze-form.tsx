"use client";

import { useActionState } from "react";
import { Checkbox } from "@/components/ui/input";
import { FormError, FormSuccess } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CATALOGO_NOTIFICHE, GRUPPI_NOTIFICHE, type TipoEvento } from "@/lib/notifiche";
import { salvaPreferenzeNotifiche } from "./actions";

/**
 * Il pannello è un unico modulo con un solo pulsante di salvataggio, e non una
 * fila di interruttori che scrivono da soli: chi cambia idea a metà può
 * lasciare la pagina senza aver combinato nulla, e il salvataggio è un gesto
 * unico invece di dieci chiamate al server.
 */
export function PreferenzeForm({ attive }: { attive: Record<TipoEvento, boolean> }) {
  const [stato, action, pending] = useActionState(salvaPreferenzeNotifiche, undefined);

  return (
    <form action={action} className="flex flex-col gap-8">
      {GRUPPI_NOTIFICHE.map((gruppo) => (
        <fieldset key={gruppo} className="flex flex-col gap-3">
          <legend className="pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {gruppo}
          </legend>

          {CATALOGO_NOTIFICHE.filter((v) => v.gruppo === gruppo).map((voce) => (
            <label
              key={voce.tipo}
              htmlFor={`evento_${voce.tipo}`}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-muted"
            >
              <Checkbox
                id={`evento_${voce.tipo}`}
                name={`evento_${voce.tipo}`}
                defaultChecked={attive[voce.tipo]}
                className="mt-0.5"
              />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-sm font-medium">{voce.etichetta}</span>
                <span className="text-xs leading-relaxed text-muted-foreground">
                  {voce.descrizione}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" pending={pending}>
          {pending ? "Salvataggio…" : "Salva le preferenze"}
        </Button>
        {!pending && stato?.ok && <FormSuccess>Preferenze aggiornate.</FormSuccess>}
        <FormError>{stato?.errore}</FormError>
      </div>
    </form>
  );
}
