import { cn } from "@/lib/cn";

/**
 * Segnaposto di caricamento. La forma ricalca il contenuto che sta per
 * arrivare (una riga di tabella resta una riga di tabella): un segnaposto
 * che corrisponde al risultato riduce l'attesa percepita, mentre uno
 * spinner generico la mette in evidenza.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("scheletro rounded-md", className)} {...props} />;
}

/** Intestazione di pagina in caricamento. */
export function SkeletonPageHeader() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-8 w-64 max-w-full" />
      <Skeleton className="h-4 w-96 max-w-full" />
    </div>
  );
}

/** Griglia di schede statistiche in caricamento. */
export function SkeletonStats({ quante = 4 }: { quante?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: quante }, (_, i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5"
        >
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-7 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Tabella in caricamento: stesso numero di colonne del contenuto reale. */
export function SkeletonTable({ righe = 5, colonne = 4 }: { righe?: number; colonne?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex gap-4 border-b border-border bg-surface-muted/60 px-4 py-3">
        {Array.from({ length: colonne }, (_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: righe }, (_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 py-4">
            {Array.from({ length: colonne }, (_, c) => (
              <Skeleton key={c} className={cn("h-4 flex-1", c === 0 && "max-w-48")} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Elenco di schede in caricamento. */
export function SkeletonCards({ quante = 3 }: { quante?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: quante }, (_, i) => (
        <div key={i} className="flex flex-col gap-2.5 rounded-2xl border border-border bg-surface p-5">
          <Skeleton className="h-4.5 w-56 max-w-full" />
          <Skeleton className="h-3.5 w-72 max-w-full" />
        </div>
      ))}
    </div>
  );
}
