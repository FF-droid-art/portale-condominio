"use client";

import { useActionState } from "react";
import { aggiornaStatoAssemblea } from "./actions";
import type { StatoAssemblea } from "@/lib/types";
import { Button } from "@/components/ui/button";

const PROSSIMO_STATO: Partial<Record<StatoAssemblea, { valore: StatoAssemblea; etichetta: string }>> = {
  convocata: { valore: "in_corso", etichetta: "Avvia assemblea" },
  in_corso: { valore: "conclusa", etichetta: "Concludi assemblea" },
};

export function StatoAssembleaControls({
  assembleaId,
  stato,
}: {
  assembleaId: string;
  stato: StatoAssemblea;
}) {
  const [statoAzione, action, pending] = useActionState(aggiornaStatoAssemblea, undefined);
  const prossimo = PROSSIMO_STATO[stato];

  if (!prossimo) return null;

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="assemblea_id" value={assembleaId} />
      <input type="hidden" name="nuovo_stato" value={prossimo.valore} />
      <Button type="submit" size="sm" variant="secondary" pending={pending}>
        {prossimo.etichetta}
      </Button>
      {statoAzione?.errore && (
        <p className="text-sm text-danger">{statoAzione.errore}</p>
      )}
    </form>
  );
}
