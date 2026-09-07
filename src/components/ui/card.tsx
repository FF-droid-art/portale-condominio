import { cn } from "@/lib/cn";

type Spaziatura = "none" | "sm" | "md" | "lg";

const paddingClass: Record<Spaziatura, string> = {
  none: "",
  sm: "p-4",
  md: "p-5 sm:p-6",
  lg: "p-6 sm:p-8",
};

export function Card({
  padding = "md",
  bordo = "normale",
  interattiva,
  className,
  ...props
}: {
  padding?: Spaziatura;
  /** Colore del bordo. Va scelto qui e non con `className`: due utility di
   *  `border-color` in conflitto verrebbero risolte dall'ordine nel foglio
   *  di stile, non da quello delle classi. */
  bordo?: "normale" | "pericolo";
  /** Aggiunge il feedback al passaggio del mouse per le schede cliccabili. */
  interattiva?: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col rounded-2xl bg-surface shadow-card",
        bordo === "pericolo" ? "border border-danger/30" : "border border-border",
        paddingClass[padding],
        interattiva &&
          "transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:border-border-strong hover:shadow-card-hover",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2", className)}
      {...props}
    />
  );
}

export function CardHeaderText({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex min-w-0 flex-col gap-1", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("text-base font-semibold tracking-tight text-foreground", className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm leading-relaxed text-muted-foreground", className)} {...props} />
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex min-w-0 flex-col gap-4", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-5 flex flex-wrap items-center gap-2", className)} {...props} />;
}

/**
 * Sezione di pagina: un titolo, una descrizione opzionale e le azioni della
 * sezione, con lo stesso ritmo verticale ovunque. Serve a dare struttura
 * alle pagine di dettaglio senza racchiudere ogni cosa in una scheda.
 */
export function Section({
  titolo,
  descrizione,
  azioni,
  className,
  children,
  ...props
}: {
  titolo?: React.ReactNode;
  descrizione?: React.ReactNode;
  azioni?: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, "title">) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-4", className)} {...props}>
      {(titolo || azioni || descrizione) && (
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-col gap-1">
            {titolo && (
              <h2 className="text-base font-semibold tracking-tight text-foreground">{titolo}</h2>
            )}
            {descrizione && (
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {descrizione}
              </p>
            )}
          </div>
          {azioni && <div className="flex flex-wrap items-center gap-2">{azioni}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
