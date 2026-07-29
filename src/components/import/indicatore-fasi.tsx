import { cn } from "@/lib/cn";

const ETICHETTE_FASE = ["Carica", "Abbina colonne", "Verifica", "Esito"] as const;

export function IndicatoreFasi({ fase }: { fase: 0 | 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ETICHETTE_FASE.map((etichetta, indice) => (
        <div key={etichetta} className="flex items-center gap-2">
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-full text-xs font-medium",
              indice === fase
                ? "bg-accent text-accent-foreground"
                : indice < fase
                  ? "bg-success-bg text-success"
                  : "bg-neutral-bg text-muted-foreground"
            )}
          >
            {indice + 1}
          </span>
          <span className={indice === fase ? "font-medium" : "text-muted-foreground"}>
            {etichetta}
          </span>
          {indice < ETICHETTE_FASE.length - 1 && (
            <span className="mx-1 h-px w-6 bg-border" />
          )}
        </div>
      ))}
    </div>
  );
}
