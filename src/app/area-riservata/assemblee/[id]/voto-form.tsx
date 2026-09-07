"use client";

import { useActionState } from "react";
import { Check, Minus, X } from "lucide-react";
import { esprimiVoto } from "./actions";
import type { SceltaVoto } from "@/lib/types";
import { FormError } from "@/components/ui/alert";
import { cn } from "@/lib/cn";

const OPZIONI: {
  valore: SceltaVoto;
  etichetta: string;
  icona: React.ComponentType<{ className?: string }>;
  attivo: string;
}[] = [
  { valore: "favorevole", etichetta: "Favorevole", icona: Check, attivo: "bg-success text-white" },
  { valore: "contrario", etichetta: "Contrario", icona: X, attivo: "bg-danger text-white" },
  {
    valore: "astenuto",
    etichetta: "Astenuto",
    icona: Minus,
    attivo: "bg-muted-foreground text-surface",
  },
];

/**
 * Scelta di voto per una singola unità.
 *
 * Le tre opzioni stanno una accanto all'altra e sono confrontabili a colpo
 * d'occhio: nessun menu a tendina da aprire, nessun secondo passaggio di
 * conferma. La scelta già espressa è riconoscibile dal colore pieno, dal
 * segno di spunta e da `aria-pressed`, non dal solo colore.
 */
export function VotoForm({
  puntoId,
  unitaId,
  assembleaId,
  unitaLabel,
  perDelega,
  votoAttuale,
}: {
  puntoId: string;
  unitaId: string;
  assembleaId: string;
  unitaLabel: string;
  perDelega?: boolean;
  votoAttuale?: SceltaVoto;
}) {
  const [stato, action, pending] = useActionState(esprimiVoto, undefined);
  const idGruppo = `voto-${puntoId}-${unitaId}`;

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="punto_id" value={puntoId} />
      <input type="hidden" name="unita_id" value={unitaId} />
      <input type="hidden" name="assemblea_id" value={assembleaId} />

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span id={idGruppo} className="text-sm font-medium">
          {unitaLabel}
        </span>
        {perDelega && (
          <span className="rounded-full bg-accent-subtle px-2 py-0.5 text-xs font-medium text-accent-ink">
            per delega
          </span>
        )}
      </div>

      <div
        role="group"
        aria-labelledby={idGruppo}
        className="flex w-full max-w-md gap-1 rounded-xl border border-border bg-surface-muted/60 p-1"
      >
        {OPZIONI.map((opzione) => {
          const scelto = votoAttuale === opzione.valore;
          const Icona = opzione.icona;
          return (
            <button
              key={opzione.valore}
              type="submit"
              name="scelta"
              value={opzione.valore}
              disabled={pending}
              aria-pressed={scelto}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors duration-150",
                "disabled:cursor-not-allowed disabled:opacity-60",
                scelto
                  ? opzione.attivo
                  : "text-muted-foreground hover:bg-surface hover:text-foreground"
              )}
            >
              <Icona className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{opzione.etichetta}</span>
            </button>
          );
        })}
      </div>

      <FormError>{stato?.errore}</FormError>

      {votoAttuale && !stato?.errore && (
        <p className="text-xs text-muted-foreground">
          Voto registrato. Puoi cambiarlo finché la votazione resta aperta.
        </p>
      )}
    </form>
  );
}
