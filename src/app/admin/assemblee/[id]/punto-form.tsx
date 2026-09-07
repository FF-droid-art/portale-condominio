"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { creaPuntoOdg } from "./actions";
import { useAlSuccesso } from "@/lib/hooks";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormGrid, Input, Select, Textarea } from "@/components/ui/input";
import { FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function PuntoOdgForm({
  assembleaId,
  prossimoNumero,
}: {
  assembleaId: string;
  prossimoNumero: number;
}) {
  const [aperto, setAperto] = useState(false);
  const [stato, action, pending] = useActionState(creaPuntoOdg, undefined);
  useAlSuccesso(pending, stato, () => setAperto(false));

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setAperto(true)}>
        <Plus className="size-4" aria-hidden="true" />
        Aggiungi punto
      </Button>

      <Dialog
        aperto={aperto}
        onChiudi={() => setAperto(false)}
        bloccato={pending}
        titolo="Nuovo punto all'ordine del giorno"
        descrizione="I condòmini potranno votarlo solo dopo che avrai aperto la votazione."
        larghezza="md"
      >
        {/* `key` sul modulo: alla riapertura i campi tornano ai valori
            iniziali, compreso il numero progressivo aggiornato. */}
        <form key={prossimoNumero} action={action} className="flex flex-col gap-4">
          <input type="hidden" name="assemblea_id" value={assembleaId} />

          <FormGrid colonne={2}>
            <Field id="numero_punto" label="Numero" required>
              <Input
                name="numero_punto"
                type="number"
                min="1"
                inputMode="numeric"
                defaultValue={prossimoNumero}
                className="cifre"
                required
              />
            </Field>
            <Field
              id="tipo_maggioranza"
              label="Maggioranza"
              hint="Indicativa: l'esito è calcolato a maggioranza semplice dei voti espressi."
            >
              <Select name="tipo_maggioranza" defaultValue="semplice">
                <option value="semplice">Semplice</option>
                <option value="qualificata_intervenuti">Qualificata intervenuti</option>
              </Select>
            </Field>
          </FormGrid>

          <Field id="descrizione" label="Descrizione del punto" required>
            <Textarea
              name="descrizione"
              rows={3}
              placeholder="Es. Approvazione del preventivo per il rifacimento della facciata"
              required
            />
          </Field>

          <FormError>{stato?.errore}</FormError>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => setAperto(false)}
            >
              Annulla
            </Button>
            <Button type="submit" pending={pending}>
              {pending ? "Salvataggio…" : "Aggiungi punto"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
