import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Variante = "primary" | "secondary" | "ghost" | "danger" | "inverse" | "outline-inverse";
type Dimensione = "sm" | "md" | "lg";

const variantClass: Record<Variante, string> = {
  primary: "bg-accent text-accent-foreground hover:bg-accent-hover",
  secondary: "border border-border bg-surface hover:bg-surface-muted",
  ghost: "hover:bg-surface-muted",
  danger: "bg-danger text-white hover:opacity-90",
  // Per bottoni su sfondi colorati/scuri (es. hero), dove le varianti
  // sopra (pensate per sfondi neutri) avrebbero contrasto insufficiente.
  inverse: "bg-white text-accent hover:bg-white/90",
  "outline-inverse": "border border-white/40 text-white hover:bg-white/10",
};

const sizeClass: Record<Dimensione, string> = {
  sm: "text-sm px-3 py-1.5 gap-1.5",
  md: "text-sm px-4 py-2 gap-2",
  lg: "text-base px-6 py-3 gap-2",
};

const base =
  "inline-flex items-center justify-center rounded-full font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none";

type ButtonProps = {
  variant?: Variante;
  size?: Dimensione;
  pending?: boolean;
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
  className,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(base, variantClass[variant], sizeClass[size], className);

  if ("href" in props && props.href !== undefined) {
    const { href, ...rest } = props;
    return (
      <Link href={href} className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  const { disabled, ...rest } = props as React.ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button className={classes} disabled={disabled || pending} {...rest}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}
