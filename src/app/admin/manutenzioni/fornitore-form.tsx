"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { creaFornitore } from "./actions";
import { CATEGORIE_FORNITORE, ETICHETTE_CATEGORIA_FORNITORE } from "@/lib/manutenzioni";
import { useAlSuccesso } from "@/lib/hooks";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormGrid, Input, Select, Textarea } from "@/components/ui/input";
import { Alert, FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function FornitoreForm({ condomini }: { condomini: { id: string; nome: string }[] }) {
  const [aperto, setAperto] = useState(false);
  const [stato, action, pending] = useActionState(creaFornitore, undefined);

  useAlSuccesso(pending, stato, () => setAperto(false));

  const senzaCondomini = condomini.length === 0;

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setAperto(true)} disabled={senzaCondomini}>
        <Plus className="size-4" aria-hidden="true" />
        Nuovo fornitore
      </Button>

      <Dialog
        aperto={aperto}
        onChiudi={() => setAperto(false)}
        bloccato={pending}
        titolo="Nuovo fornitore"
        descrizione="La ditta viene registrata per un singolo condominio: è il perimetro su cui è costruita la visibilità dei dati nel portale."
        larghezza="md"
      >
        <form action={action} className="flex flex-col gap-4">
          {senzaCondomini && (
            <Alert tono="warning" titolo="Nessun condominio disponibile">
              Crea prima un condominio.
            </Alert>
          )}

          <FormGrid colonne={2}>
            <Field id="fornitore_condominio" label="Condominio" required>
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

            <Field id="fornitore_categoria" label="Categoria">
              <Select name="categoria" defaultValue="altro">
                {CATEGORIE_FORNITORE.map((c) => (
                  <option key={c} value={c}>
                    {ETICHETTE_CATEGORIA_FORNITORE[c]}
                  </option>
                ))}
              </Select>
            </Field>
          </FormGrid>

          <Field id="fornitore_nome" label="Ragione sociale" required>
            <Input name="nome" placeholder="Es. Ascensori Bianchi S.r.l." required />
          </Field>

          <FormGrid colonne={2}>
            <Field id="fornitore_referente" label="Referente">
              <Input name="referente" placeholder="Es. Ing. Bianchi" />
            </Field>
            <Field id="fornitore_piva" label="Partita IVA">
              <Input name="partita_iva" />
            </Field>
          </FormGrid>

          <FormGrid colonne={2}>
            <Field id="fornitore_email" label="Email">
              <Input name="email" type="email" />
            </Field>
            <Field id="fornitore_telefono" label="Telefono">
              <Input name="telefono" type="tel" />
            </Field>
          </FormGrid>

          <Field id="fornitore_note" label="Note" hint="Numero di contratto, orari, condizioni.">
            <Textarea name="note" rows={2} />
          </Field>

          <FormError>{stato?.errore}</FormError>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setAperto(false)}>
              Annulla
            </Button>
            <Button type="submit" pending={pending} disabled={senzaCondomini}>
              {pending ? "Salvataggio…" : "Salva fornitore"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
