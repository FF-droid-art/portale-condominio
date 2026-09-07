"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { creaUnita } from "../actions";
import { useAlSuccesso } from "@/lib/hooks";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormGrid, Input } from "@/components/ui/input";
import { FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Creazione di una singola unità immobiliare.
 *
 * I campi dei millesimi sono generati dalle tabelle millesimali del
 * condominio: se non ne esiste ancora nessuna si mostra il solo millesimo
 * generale, che è il comportamento atteso dalla server action.
 */
export function NuovaUnitaForm({
  condominioId,
  tabelle = [],
}: {
  condominioId: string;
  tabelle?: { id: string; nome: string }[];
}) {
  const [aperto, setAperto] = useState(false);
  const [stato, action, pending] = useActionState(creaUnita, undefined);
  useAlSuccesso(pending, stato, () => setAperto(false));

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setAperto(true)}>
        <Plus className="size-4" aria-hidden="true" />
        Nuova unità
      </Button>

      <Dialog
        aperto={aperto}
        onChiudi={() => setAperto(false)}
        bloccato={pending}
        titolo="Nuova unità immobiliare"
        descrizione="L'identificativo deve essere unico all'interno del condominio."
        larghezza="md"
      >
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="condominio_id" value={condominioId} />

          <Field
            id="identificativo"
            label="Identificativo"
            required
            hint="Come lo chiami nei documenti: scala, interno, numero catastale…"
          >
            <Input name="identificativo" placeholder="Es. Scala A — Interno 3" required />
          </Field>

          {tabelle.length > 0 ? (
            <FormGrid colonne={2}>
              {tabelle.map((t) => (
                <Field key={t.id} id={`mill_${t.id}`} label={`Millesimi ${t.nome}`}>
                  <Input
                    name={`mill_${t.id}`}
                    type="number"
                    step="0.001"
                    min="0"
                    inputMode="decimal"
                    placeholder="0"
                    className="cifre"
                  />
                </Field>
              ))}
            </FormGrid>
          ) : (
            <Field
              id="mill_generale"
              label="Millesimi generali"
              hint="Puoi lasciarlo vuoto e inserirlo più tardi."
            >
              <Input
                name="mill_generale"
                type="number"
                step="0.001"
                min="0"
                inputMode="decimal"
                placeholder="0"
                className="cifre"
              />
            </Field>
          )}

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
              {pending ? "Salvataggio…" : "Aggiungi unità"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
