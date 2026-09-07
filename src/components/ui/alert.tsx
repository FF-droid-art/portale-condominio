import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type TonoAvviso = "info" | "success" | "warning" | "danger";

const stile: Record<TonoAvviso, { box: string; icona: string }> = {
  info: { box: "border-accent/25 bg-accent-subtle text-accent-ink", icona: "text-accent-ink" },
  success: { box: "border-success/25 bg-success-bg text-success", icona: "text-success" },
  warning: { box: "border-warning/25 bg-warning-bg text-warning", icona: "text-warning" },
  danger: { box: "border-danger/25 bg-danger-bg text-danger", icona: "text-danger" },
};

const ICONE: Record<TonoAvviso, React.ComponentType<{ className?: string }>> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

/**
 * Messaggio di esito o di errore in linea, vicino a ciò a cui si riferisce.
 *
 * `role` è "alert" per gli errori (annunciati subito) e "status" per gli
 * esiti positivi (annunciati senza interrompere), così chi usa uno screen
 * reader riceve il riscontro dell'azione anche se non vede il colore.
 */
export function Alert({
  tono = "info",
  titolo,
  className,
  children,
  ...props
}: {
  tono?: TonoAvviso;
  titolo?: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  const Icona = ICONE[tono];
  return (
    <div
      role={tono === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm",
        stile[tono].box,
        className
      )}
      {...props}
    >
      <Icona className={cn("mt-px size-4 shrink-0", stile[tono].icona)} aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-0.5">
        {titolo && <p className="font-semibold">{titolo}</p>}
        {children && <div className="leading-relaxed [&_a]:underline">{children}</div>}
      </div>
    </div>
  );
}

/**
 * Errore compatto di un modulo: stessa semantica di `Alert` (annuncio
 * immediato) ma senza riquadro, per stare sotto a un gruppo di campi.
 */
export function FormError({
  children,
  piccolo,
  className,
}: {
  children?: React.ReactNode;
  /** Testo ridotto, per gli spazi stretti (celle di tabella). */
  piccolo?: boolean;
  className?: string;
}) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className={cn(
        "flex items-start gap-1.5 font-medium text-danger",
        piccolo ? "text-xs" : "text-sm",
        className
      )}
    >
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

/** Conferma compatta di un'operazione riuscita. */
export function FormSuccess({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <p
      role="status"
      className={cn("flex items-start gap-1.5 text-sm font-medium text-success", className)}
    >
      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
