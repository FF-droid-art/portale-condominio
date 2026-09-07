"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { aggiornaStatoPagamento } from "./actions";
import type { Ripartizione } from "@/lib/types";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/alert";

/**
 * Cambio dello stato di pagamento di una singola quota.
 *
 * Resta un menu con un pulsante di conferma esplicito, e non un salvataggio
 * automatico al cambio di selezione: qui si sta dichiarando che dei soldi
 * sono arrivati, e un tocco per sbaglio non deve bastare.
 */
export function RigaRipartizione({
  ripartizione,
  spesaId,
  etichettaUnita,
}: {
  ripartizione: Ripartizione;
  spesaId: string;
  etichettaUnita?: string;
}) {
  const [stato, action, pending] = useActionState(aggiornaStatoPagamento, undefined);
  const idSelect = `stato-${ripartizione.id}`;

  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <input type="hidden" name="ripartizione_id" value={ripartizione.id} />
      <input type="hidden" name="spesa_id" value={spesaId} />

      <div className="flex items-center gap-2">
        <label htmlFor={idSelect} className="sr-only">
          {etichettaUnita
            ? `Stato del pagamento per ${etichettaUnita}`
            : "Stato del pagamento"}
        </label>
        <Select
          id={idSelect}
          name="stato_pagamento"
          defaultValue={ripartizione.stato_pagamento}
          dimensione="sm"
          contenitoreClassName="w-auto"
          className="w-auto min-w-36 text-sm"
        >
          <option value="da_pagare">Da pagare</option>
          <option value="pagato">Pagato</option>
          <option value="in_ritardo">In ritardo</option>
        </Select>
        <Button
          variant="secondary"
          size="sm"
          iconOnly
          type="submit"
          pending={pending}
          aria-label={
            etichettaUnita ? `Salva lo stato per ${etichettaUnita}` : "Salva lo stato"
          }
          title="Salva"
        >
          {!pending && <Check className="size-4" aria-hidden="true" />}
        </Button>
      </div>

      <FormError piccolo>{stato?.errore}</FormError>
    </form>
  );
}
