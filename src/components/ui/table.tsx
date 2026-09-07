import { cn } from "@/lib/cn";

/**
 * Tabella dati.
 *
 * Su desktop è una tabella normale, che scorre in orizzontale se le colonne
 * non ci stanno. Sotto i 768px, se `stacked` è attivo (impostazione
 * predefinita), ogni riga diventa una scheda "etichetta → valore": le regole
 * stanno in `globals.css` sotto `.tabella-adattiva`. Le etichette mobili
 * vengono dalla prop `etichetta` di ogni `TableCell`.
 *
 * Convenzioni seguite: testo allineato a sinistra, numeri a destra e con
 * cifre a larghezza fissa (confronto verticale immediato), intestazioni
 * allineate come la colonna che descrivono, righe separate da una linea
 * sottile invece che da bande alternate.
 */
export function Table({
  stacked = true,
  className,
  ...props
}: { stacked?: boolean } & React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="tabella-guscio scorrimento-sottile">
      <table
        className={cn(
          "w-full border-collapse text-sm",
          stacked && "tabella-adattiva",
          className
        )}
        {...props}
      />
    </div>
  );
}

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn("border-b border-border bg-surface-muted/60 text-xs uppercase tracking-wide", className)}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-border", className)} {...props} />;
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("transition-colors duration-100 md:hover:bg-surface-muted/60", className)}
      {...props}
    />
  );
}

export function TableHead({
  numeric,
  className,
  ...props
}: { numeric?: boolean } & React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        "px-4 py-3 font-semibold text-muted-foreground",
        numeric ? "text-right" : "text-left",
        className
      )}
      {...props}
    />
  );
}

export function TableCell({
  etichetta,
  numeric,
  className,
  ...props
}: {
  /** Etichetta mostrata davanti al valore quando la tabella si impila su
   *  schermo stretto. Va omessa per le celle di sola azione. */
  etichetta?: string;
  numeric?: boolean;
} & React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      data-etichetta={etichetta}
      className={cn(
        "px-4 py-3 align-middle",
        numeric && "md:text-right cifre",
        className
      )}
      {...props}
    />
  );
}

/**
 * Nome di un'entità preceduto da una piccola icona neutra: aiuta a
 * distinguere a colpo d'occhio condomini, unità e spese senza aggiungere
 * un'altra macchia di colore per ogni riga.
 */
export function RowIcon({
  icon: Icon,
  className,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted-foreground">
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0">{children}</span>
    </span>
  );
}

/** Cella vuota: un trattino grigio invece di uno spazio bianco ambiguo. */
export function Vuoto() {
  return <span className="text-muted-foreground/70">—</span>;
}
