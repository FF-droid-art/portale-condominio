import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Variante =
  | "primary"
  | "secondary"
  | "ghost"
  | "subtle"
  | "danger"
  | "danger-ghost"
  | "ghost-danger"
  | "link"
  | "inverse"
  | "outline-inverse";

type Dimensione = "xs" | "sm" | "md" | "lg";

const variantClass: Record<Variante, string> = {
  primary: "bg-accent text-accent-foreground hover:bg-accent-hover shadow-xs",
  secondary:
    "border border-border-strong bg-surface text-foreground hover:bg-surface-muted shadow-xs",
  ghost: "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
  subtle: "bg-surface-muted text-foreground hover:bg-surface-sunken",
  danger: "bg-danger text-white hover:brightness-110 shadow-xs",
  "danger-ghost": "text-danger hover:bg-danger-bg",
  // Azione distruttiva discreta dentro un elenco: neutra a riposo, rossa
  // solo quando ci si passa sopra, così una colonna di icone non è una fila
  // di allarmi rossi.
  "ghost-danger": "text-muted-foreground hover:bg-danger-bg hover:text-danger",
  link: "text-accent-ink underline-offset-4 hover:underline",
  // Per sfondi scuri o colorati (hero pubblico, pagine di autenticazione),
  // dove le varianti su superficie neutra non avrebbero contrasto.
  inverse: "bg-white text-navy hover:bg-white/90 shadow-xs",
  "outline-inverse": "border border-white/35 text-white hover:bg-white/10",
};

const sizeClass: Record<Dimensione, string> = {
  xs: "h-7 text-xs px-2.5 gap-1.5 rounded-md",
  sm: "h-8 text-sm px-3 gap-1.5 rounded-lg",
  md: "h-10 text-sm px-4 gap-2 rounded-lg",
  lg: "h-12 text-base px-6 gap-2 rounded-xl",
};

// Varianti quadrate per i pulsanti di sola icona: stessa altezza, larghezza
// pari all'altezza, così restano allineati agli altri controlli.
const iconOnlySizeClass: Record<Dimensione, string> = {
  xs: "size-7 p-0 rounded-md",
  sm: "size-8 p-0 rounded-lg",
  md: "size-10 p-0 rounded-lg",
  lg: "size-12 p-0 rounded-xl",
};

const base =
  "inline-flex shrink-0 items-center justify-center font-medium leading-none " +
  "transition-[background-color,border-color,color,box-shadow,opacity] duration-150 " +
  "disabled:opacity-55 disabled:pointer-events-none aria-disabled:opacity-55 aria-disabled:pointer-events-none";

type ButtonProps = {
  variant?: Variante;
  size?: Dimensione;
  /** Mostra lo spinner, disabilita il pulsante e segnala l'attesa alle tecnologie assistive. */
  pending?: boolean;
  /** Pulsante di sola icona: ricordarsi `aria-label` o `title`. */
  iconOnly?: boolean;
  /** Occupa tutta la larghezza disponibile. */
  full?: boolean;
  className?: string;
  children: React.ReactNode;
} & (
  | ({ href: string } & Omit<React.ComponentPropsWithoutRef<typeof Link>, "href" | "className">)
  | ({ href?: undefined } & React.ButtonHTMLAttributes<HTMLButtonElement>)
);

export function Button({
  variant = "primary",
  size = "md",
  pending,
  iconOnly,
  full,
  className,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(
    base,
    variantClass[variant],
    iconOnly ? cn(sizeClass[size], iconOnlySizeClass[size]) : sizeClass[size],
    variant === "link" && "h-auto px-0 shadow-none",
    full && "w-full",
    className
  );

  if ("href" in props && props.href !== undefined) {
    const { href, ...rest } = props;
    return (
      <Link href={href} className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  const { disabled, type, ...rest } = props as React.ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button
      type={type ?? "button"}
      className={classes}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...rest}
    >
      {pending && <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

/**
 * Gruppo di azioni: spaziatura coerente e, su schermi stretti, i pulsanti
 * vanno a capo invece di traboccare.
 */
export function ButtonGroup({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)} {...props} />;
}
