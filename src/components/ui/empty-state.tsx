import { cn } from "@/lib/cn";

/**
 * Stato vuoto. Non si limita a dire che non c'è nulla: spiega perché e
 * offre l'azione che risolve, così la schermata vuota diventa il punto di
 * partenza invece di un vicolo cieco.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compatta,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Versione ridotta, per gli spazi dentro una scheda. */
  compatta?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface/60 text-center",
        compatta ? "px-4 py-8" : "px-6 py-14",
        className
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-2xl bg-surface-muted text-muted-foreground",
          compatta ? "size-10" : "size-12"
        )}
        aria-hidden="true"
      >
        <Icon className={compatta ? "size-5" : "size-6"} />
      </span>
      <div className="flex flex-col gap-1.5">
        <p className={cn("font-semibold text-foreground", compatta ? "text-sm" : "text-base")}>
          {title}
        </p>
        {description && (
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}
