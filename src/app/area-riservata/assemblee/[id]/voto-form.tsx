"use client";

import { useActionState } from "react";
import { esprimiVoto } from "./actions";
import type { SceltaVoto } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const OPZIONI: { valore: SceltaVoto; etichetta: string }[] = [
  { valore: "favorevole", etichetta: "Favorevole" },
  { valore: "contrario", etichetta: "Contrario" },
  { valore: "astenuto", etichetta: "Astenuto" },
];

export function VotoForm({
  puntoId,
  unitaId,
  assembleaId,
  unitaLabel,
  votoAttuale,
}: {
  puntoId: string;
  unitaId: string;
  assembleaId: string;
  unitaLabel: string;
  votoAttuale?: SceltaVoto;
}) {
  const [stato, action, pending] = useActionState(esprimiVoto, undefined);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2 text-sm">
      <input type="hidden" name="punto_id" value={puntoId} />
      <input type="hidden" name="unita_id" value={unitaId} />
      <input type="hidden" name="assemblea_id" value={assembleaId} />
      <span className="text-muted-foreground">{unitaLabel}:</span>
      {OPZIONI.map((opzione) => (
        <Button
          key={opzione.valore}
          type="submit"
          name="scelta"
          value={opzione.valore}
          size="sm"
          variant={votoAttuale === opzione.valore ? "primary" : "secondary"}
          pending={pending}
          className={cn(votoAttuale === opzione.valore && "ring-2 ring-accent")}
        >
          {opzione.etichetta}
        </Button>
      ))}
      {stato?.errore && <p className="text-danger w-full">{stato.errore}</p>}
      {votoAttuale && (
        <span className="text-xs text-muted-foreground w-full">
          Hai già votato — puoi cambiare scelta finché la votazione resta aperta.
        </span>
      )}
    </form>
  );
}
