"use client";

import { useActionState } from "react";
import { CheckCircle2, PlayCircle } from "lucide-react";
import { aggiornaStatoAssemblea } from "./actions";
import type { StatoAssemblea } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/alert";

const PROSSIMO_STATO: Partial<
  Record<
    StatoAssemblea,
    { valore: StatoAssemblea; etichetta: string; icona: React.ComponentType<{ className?: string }> }
  >
> = {
  convocata: { valore: "in_corso", etichetta: "Avvia assemblea", icona: PlayCircle },
  in_corso: { valore: "conclusa", etichetta: "Concludi assemblea", icona: CheckCircle2 },
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

  const Icona = prossimo.icona;

  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <input type="hidden" name="assemblea_id" value={assembleaId} />
      <input type="hidden" name="nuovo_stato" value={prossimo.valore} />
      <Button type="submit" pending={pending}>
        <Icona className="size-4" aria-hidden="true" />
        {prossimo.etichetta}
      </Button>
      <FormError piccolo>{statoAzione?.errore}</FormError>
    </form>
  );
}
