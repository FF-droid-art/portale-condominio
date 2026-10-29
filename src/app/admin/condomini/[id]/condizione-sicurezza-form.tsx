"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { registraCondizioneSicurezza } from "../actions";
import { useAlSuccesso } from "@/lib/hooks";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormGrid, Input, Textarea } from "@/components/ui/input";
import { FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Nuova voce del registro delle condizioni di sicurezza delle parti
 * comuni (art. 1130, n. 6, c.c.).
 *
 * Solo "parte" è obbligatoria: una voce vale anche come semplice
 * annotazione ("facciata: nessuna criticità rilevata"), e pretendere la
 * data o il certificato scoraggerebbe proprio l'annotazione che la legge
 * vuole vedere nel registro.
 */
export function CondizioneSicurezzaForm({ condominioId }: { condominioId: string }) {
  const [aperto, setAperto] = useState(false);
  const [stato, action, pending] = useActionState(registraCondizioneSicurezza, undefined);
  useAlSuccesso(pending, stato, () => setAperto(false));

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setAperto(true)}>
        <Plus className="size-4" aria-hidden="true" />
        Nuova voce
      </Button>

      <Dialog
        aperto={aperto}
        onChiudi={() => setAperto(false)}
        bloccato={pending}
        titolo="Condizioni di sicurezza: nuova voce"
        descrizione="Lo stato di una parte comune o di un impianto alla data dell'ultima verifica."
        larghezza="md"
      >
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="condominio_id" value={condominioId} />

          <FormGrid colonne={2}>
            <Field
              id="sicurezza_parte"
              label="Parte comune o impianto"
              required
              hint="Es. impianto elettrico, ascensore, facciata, canna fumaria."
            >
              <Input name="parte" placeholder="Es. Impianto elettrico" required />
            </Field>
            <Field
              id="sicurezza_data"
              label="Data ultima verifica"
              hint="Facoltativa, se non la si conosce ancora."
            >
              <Input name="data_ultima_verifica" type="date" />
            </Field>
          </FormGrid>

          <Field
            id="sicurezza_descrizione"
            label="Stato rilevato e annotazioni"
            hint="Facoltativo: esito della verifica, prescrizioni, criticità ancora aperte."
          >
            <Textarea
              name="descrizione"
              rows={3}
              placeholder="Es. Verifica biennale dell'impianto di messa a terra: esito regolare, nessuna prescrizione."
            />
          </Field>

          <Field
            id="sicurezza_documento"
            label="Link al certificato o al verbale"
            hint="Facoltativo. Anche l'indirizzo di un documento già caricato nell'archivio del condominio."
          >
            <Input
              name="documento_url"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://…"
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
              {pending ? "Salvataggio…" : "Registra la voce"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
