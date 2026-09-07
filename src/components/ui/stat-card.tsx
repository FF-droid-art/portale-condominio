import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";

type TonoStat = "neutral" | "accent" | "success" | "warning" | "danger";

const tonoValore: Record<TonoStat, string> = {
  neutral: "text-foreground",
  accent: "text-accent-ink",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

const tonoIcona: Record<TonoStat, string> = {
  neutral: "bg-surface-muted text-muted-foreground",
  accent: "bg-accent-subtle text-accent-ink",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
};

/**
 * Dato di sintesi. L'etichetta viene prima del numero: si legge "che cosa"
 * e poi "quanto", ed è l'ordine in cui la si cerca. Il numero usa cifre a
 * larghezza fissa, così una fila di schede resta incolonnata.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tono = "neutral",
  href,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tono?: TonoStat;
  /** Se presente, l'intera scheda diventa un collegamento. */
  href?: string;
  className?: string;
}) {
  const contenuto = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {Icon && (
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg",
              tonoIcona[tono]
            )}
            aria-hidden="true"
          >
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <span
        className={cn(
          "cifre text-2xl font-semibold tracking-tight sm:text-3xl",
          tonoValore[tono]
        )}
      >
        {value}
      </span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </>
  );

  const classiBase = cn(
    "flex min-w-0 flex-col gap-1.5 rounded-2xl border border-border bg-surface p-5 shadow-card",
    className
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          classiBase,
          "group relative transition-[border-color,box-shadow] duration-150 hover:border-border-strong hover:shadow-card-hover"
        )}
      >
        {contenuto}
        <ArrowUpRight
          className="absolute bottom-4 right-4 size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        />
      </Link>
    );
  }

  return <div className={classiBase}>{contenuto}</div>;
}

/** Fila di schede statistiche con la stessa griglia ovunque. */
export function StatGrid({
  colonne = 4,
  className,
  ...props
}: {
  /** Numero di colonne da `lg` in su. Va scelto qui e non con `className`:
   *  due utility di griglia in conflitto verrebbero risolte dall'ordine nel
   *  foglio di stile, non da quello delle classi. */
  colonne?: 3 | 4;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:gap-4",
        colonne === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4",
        className
      )}
      {...props}
    />
  );
}
