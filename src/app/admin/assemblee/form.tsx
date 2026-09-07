"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { creaAssemblea } from "./actions";
import { useAlSuccesso } from "@/lib/hooks";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { Alert, FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function AssembleaForm({ condomini }: { condomini: { id: string; nome: string }[] }) {
  const [aperto, setAperto] = useState(false);
  const [stato, action, pending] = useActionState(creaAssemblea, undefined);
  useAlSuccesso(pending, stato, () => setAperto(false));

  const senzaCondomini = condomini.length === 0;

  return (
    <>
      <Button onClick={() => setAperto(true)} disabled={senzaCondomini}>
        <Plus className="size-4" aria-hidden="true" />
        Convoca assemblea
      </Button>

      <Dialog
        aperto={aperto}
        onChiudi={() => setAperto(false)}
        bloccato={pending}
        titolo="Convoca un'assemblea"
        descrizione="I condòmini con un indirizzo email collegato ricevono una notifica della convocazione."
      >
        <form action={action} className="flex flex-col gap-4">
          {senzaCondomini && (
            <Alert tono="warning" titolo="Nessun condominio disponibile">
              Crea prima un condominio: un&apos;assemblea deve sempre appartenere a uno di essi.
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

          <Field id="data_assemblea" label="Data e ora" required>
            <Input name="data_assemblea" type="datetime-local" required />
          </Field>

          <Field
            id="tipo"
            label="Tipo di assemblea"
            hint="Il tipo non cambia il calcolo dell'esito: serve a distinguere le convocazioni."
          >
            <Select name="tipo" required defaultValue="ordinaria">
              <option value="ordinaria">Ordinaria</option>
              <option value="straordinaria">Straordinaria</option>
            </Select>
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
            <Button type="submit" pending={pending} disabled={senzaCondomini}>
              {pending ? "Convocazione…" : "Convoca assemblea"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
