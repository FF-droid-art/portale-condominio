"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { creaSpesa } from "./actions";
import { useAlSuccesso } from "@/lib/hooks";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormGrid, Input, Select } from "@/components/ui/input";
import { Alert, FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Registrazione di una nuova spesa.
 *
 * La ripartizione fra le unità non si decide qui: si genera dalla scheda
 * della spesa, dove si può scegliere su quale tabella millesimale calcolarla.
 * Tenere separati i due momenti evita di dover prendere quella decisione
 * mentre si sta solo trascrivendo una fattura.
 */
export function SpesaForm({ condomini }: { condomini: { id: string; nome: string }[] }) {
  const [aperto, setAperto] = useState(false);
  const [stato, action, pending] = useActionState(creaSpesa, undefined);
  useAlSuccesso(pending, stato, () => setAperto(false));

  const senzaCondomini = condomini.length === 0;

  return (
    <>
      <Button onClick={() => setAperto(true)} disabled={senzaCondomini}>
        <Plus className="size-4" aria-hidden="true" />
        Nuova spesa
      </Button>

      <Dialog
        aperto={aperto}
        onChiudi={() => setAperto(false)}
        bloccato={pending}
        titolo="Nuova spesa"
        descrizione="Registra l'importo complessivo: la quota di ogni unità si genera dopo, dalla scheda della spesa."
        larghezza="md"
      >
        <form action={action} className="flex flex-col gap-4">
          {senzaCondomini && (
            <Alert tono="warning" titolo="Nessun condominio disponibile">
              Crea prima un condominio: una spesa deve sempre appartenere a uno di essi.
            </Alert>
          )}

          <Field id="condominio_id" label="Condominio" required>
            <Select name="condominio_id" required defaultValue="">
              <option value="" disabled>
                Seleziona condominio
              </option>
              {condomini.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          </Field>

          <Field id="descrizione" label="Descrizione" required>
            <Input
              name="descrizione"
              placeholder="Es. Manutenzione ascensore — primo semestre"
              required
            />
          </Field>

          <FormGrid colonne={2}>
            <Field
              id="categoria"
              label="Categoria"
              required
              hint="Testo libero: usa sempre la stessa parola per raggruppare le spese simili."
            >
              <Input name="categoria" placeholder="Es. ascensore" required />
            </Field>
            <Field id="importo_totale" label="Importo totale (€)" required>
              <Input
                name="importo_totale"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="0,00"
                className="cifre"
                required
              />
            </Field>
          </FormGrid>

          <FormGrid colonne={2}>
            <Field id="data_spesa" label="Data della spesa" required>
              <Input name="data_spesa" type="date" required />
            </Field>
            <Field id="fornitore" label="Fornitore" hint="Facoltativo.">
              <Input name="fornitore" placeholder="Es. Ascensori Rossi S.r.l." />
            </Field>
          </FormGrid>

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
            <Button type="submit" pending={pending} disabled={senzaCondomini}>
              {pending ? "Salvataggio…" : "Aggiungi spesa"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
