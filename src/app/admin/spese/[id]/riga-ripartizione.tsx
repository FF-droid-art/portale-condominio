"use client";

import { useActionState } from "react";
import { aggiornaStatoPagamento } from "./actions";
import type { Ripartizione } from "@/lib/types";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function RigaRipartizione({
  ripartizione,
  spesaId,
}: {
  ripartizione: Ripartizione;
  spesaId: string;
}) {
  const [stato, action, pending] = useActionState(aggiornaStatoPagamento, undefined);

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="ripartizione_id" value={ripartizione.id} />
      <input type="hidden" name="spesa_id" value={spesaId} />
      <Select name="stato_pagamento" defaultValue={ripartizione.stato_pagamento} className="py-1">
        <option value="da_pagare">Da pagare</option>
        <option value="pagato">Pagato</option>
        <option value="in_ritardo">In ritardo</option>
      </Select>
      <Button variant="secondary" size="sm" type="submit" pending={pending}>
        Salva
      </Button>
      {stato?.errore && <p className="text-xs text-danger">{stato.errore}</p>}
    </form>
  );
}
