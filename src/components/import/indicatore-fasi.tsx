import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

const ETICHETTE_FASE = ["Carica", "Abbina colonne", "Verifica", "Esito"] as const;

/**
 * Avanzamento della procedura di importazione.
 *
 * Mostra sempre tutti e quattro i passi: sapere quanto manca prima di
 * cominciare è metà del motivo per cui una procedura guidata si porta a
 * termine. Le fasi già superate portano un segno di spunta, quella corrente
 * è dichiarata con `aria-current` e non solo con il colore.
 */
export function IndicatoreFasi({ fase }: { fase: 0 | 1 | 2 | 3 }) {
  return (
    <nav aria-label="Fasi dell'importazione">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-3 sm:gap-x-3">
        {ETICHETTE_FASE.map((etichetta, indice) => {
          const corrente = indice === fase;
          const completata = indice < fase;
          return (
            <li key={etichetta} className="flex items-center gap-2 sm:gap-3">
              <span
                className="flex items-center gap-2"
                aria-current={corrente ? "step" : undefined}
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
                    corrente && "bg-accent text-accent-foreground",
                    completata && "bg-success-bg text-success",
                    !corrente && !completata && "bg-surface-muted text-muted-foreground"
                  )}
                >
                  {completata ? (
                    <Check className="size-3.5" aria-hidden="true" />
                  ) : (
                    indice + 1
                  )}
                </span>
                <span
                  className={cn(
                    "text-sm",
                    corrente ? "font-semibold text-foreground" : "text-muted-foreground"
                  )}
                >
                  {etichetta}
                  {completata && <span className="sr-only"> (completata)</span>}
                </span>
              </span>

              {indice < ETICHETTE_FASE.length - 1 && (
                <span
                  className={cn(
                    "hidden h-px w-6 sm:block",
                    completata ? "bg-success/40" : "bg-border"
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
