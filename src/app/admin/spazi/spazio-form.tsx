"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { creaSpazio } from "./actions";
import { useAlSuccesso } from "@/lib/hooks";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormGrid, Input, Select, Textarea } from "@/components/ui/input";
import { Alert, FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function SpazioForm({ condomini }: { condomini: { id: string; nome: string }[] }) {
  const [aperto, setAperto] = useState(false);
  const [stato, action, pending] = useActionState(creaSpazio, undefined);

  useAlSuccesso(pending, stato, () => setAperto(false));

  const senzaCondomini = condomini.length === 0;

  return (
    <>
      <Button onClick={() => setAperto(true)} disabled={senzaCondomini}>
        <Plus className="size-4" aria-hidden="true" />
        Nuovo spazio
      </Button>

      <Dialog
        aperto={aperto}
        onChiudi={() => setAperto(false)}
        bloccato={pending}
        titolo="Nuovo spazio prenotabile"
        descrizione="I condòmini potranno prenotarlo dalla loro area riservata, nelle fasce e con i limiti che imposti qui."
        larghezza="md"
      >
        <form action={action} className="flex flex-col gap-4">
          {senzaCondomini && (
            <Alert tono="warning" titolo="Nessun condominio disponibile">
              Crea prima un condominio.
            </Alert>
          )}

          <Field id="spazio_condominio" label="Condominio" required>
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

          <Field id="spazio_nome" label="Nome" required>
            <Input name="nome" placeholder="Es. Sala condominiale" required />
          </Field>

          <Field
            id="spazio_descrizione"
            label="Descrizione"
            hint="Facoltativa: dove si trova, come si ritira la chiave, che cosa è vietato."
          >
            <Textarea name="descrizione" rows={2} />
          </Field>

          <FormGrid colonne={2}>
            <Field id="spazio_apertura" label="Prenotabile dalle">
              <Input name="ora_apertura" type="time" defaultValue="08:00" />
            </Field>
            <Field id="spazio_chiusura" label="fino alle">
              <Input name="ora_chiusura" type="time" defaultValue="22:00" />
            </Field>
          </FormGrid>

          <FormGrid colonne={2}>
            <Field
              id="spazio_posti"
              label="Posti prenotabili insieme"
              hint="1 per una sala, di più per i posti auto ospiti."
            >
              <Input name="posti" type="number" min="1" step="1" defaultValue="1" />
            </Field>
            <Field
              id="spazio_durata"
              label="Durata massima (ore)"
              hint="Vuoto = nessun limite."
            >
              <Input name="durata_massima_ore" type="number" min="1" step="1" />
            </Field>
          </FormGrid>

          <FormError>{stato?.errore}</FormError>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setAperto(false)}>
              Annulla
            </Button>
            <Button type="submit" pending={pending} disabled={senzaCondomini}>
              {pending ? "Salvataggio…" : "Crea spazio"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
