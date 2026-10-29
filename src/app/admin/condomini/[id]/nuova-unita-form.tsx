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

          <FormGrid colonne={2}>
            <Field
              id="identificativo"
              label="Identificativo"
              required
              hint="Come lo chiami nei documenti: scala, interno, numero catastale…"
            >
              <Input name="identificativo" placeholder="Es. Scala A — Interno 3" required />
            </Field>
            <Field id="piano" label="Piano" hint="Facoltativo.">
              <Input name="piano" placeholder="Es. 2" />
            </Field>
          </FormGrid>

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

          {/* Dati catastali: fanno parte del registro di anagrafe
              condominiale (art. 1130, n. 6, c.c.). Facoltativi, perché
              un'unità si crea spesso prima di avere la visura: si
              completano poi dalla scheda dell'unità. */}
          <fieldset className="flex flex-col gap-4 rounded-xl border border-border p-4">
            <legend className="px-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Dati catastali (facoltativi)
            </legend>
            <FormGrid colonne={2}>
              <Field id="catasto_foglio" label="Foglio">
                <Input name="catasto_foglio" placeholder="12" className="cifre" />
              </Field>
              <Field id="catasto_particella" label="Particella (mappale)">
                <Input name="catasto_particella" placeholder="345" className="cifre" />
              </Field>
            </FormGrid>
            <FormGrid colonne={2}>
              <Field
                id="catasto_subalterno"
                label="Subalterno"
                hint="Come in visura, zeri iniziali compresi."
              >
                <Input name="catasto_subalterno" placeholder="007" className="cifre" />
              </Field>
              <Field id="catasto_categoria" label="Categoria" hint="Es. A/2, A/10, C/6.">
                <Input name="catasto_categoria" placeholder="A/2" />
              </Field>
            </FormGrid>
          </fieldset>

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
