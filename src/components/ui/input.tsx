import { isValidElement, cloneElement } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/* I controlli condividono la stessa base: altezza, raggio e bordo identici,
   così su una riga input, select e pulsanti risultano perfettamente
   allineati. Il focus è gestito globalmente in globals.css, quindi nessun
   controllo può restare senza indicatore. */
const controlloBase =
  "w-full rounded-lg border border-border-strong bg-surface text-foreground text-sm " +
  "placeholder:text-muted-foreground/70 transition-colors duration-150 " +
  "hover:border-muted-foreground/50 aria-invalid:border-danger " +
  "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60";

const altezzaControllo = "h-10";

export function Label({
  className,
  required,
  children,
  ...props
}: { required?: boolean } & React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("text-sm font-medium text-foreground", className)} {...props}>
      {children}
      {required && (
        <span className="ml-0.5 text-danger" aria-hidden="true">
          *
        </span>
      )}
    </label>
  );
}

export function Input({
  className,
  type,
  spaziatura = "normale",
  ...props
}: {
  /** "conAzione" lascia spazio a destra per un pulsante sovrapposto (es. il
   *  mostra/nascondi della password). Va passato come prop e non aggiunto
   *  via `className`: due utility di padding in conflitto verrebbero
   *  risolte dall'ordine nel foglio di stile, non da quello delle classi. */
  spaziatura?: "normale" | "conAzione";
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const file = type === "file";
  return (
    <input
      type={type}
      className={cn(
        controlloBase,
        altezzaControllo,
        file
          ? "cursor-pointer file:mr-3 file:h-9.5 file:cursor-pointer file:rounded-l-lg file:border-0 file:bg-surface-muted file:px-3 file:text-sm file:font-medium file:text-foreground hover:file:bg-surface-sunken"
          : spaziatura === "conAzione"
            ? "pl-3 pr-11"
            : "px-3",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn(controlloBase, "px-3 py-2.5 leading-relaxed", className)} {...props} />
  );
}

export function Select({
  className,
  contenitoreClassName,
  dimensione = "md",
  ...props
}: {
  /** Classi per il contenitore, che serve a posizionare la freccia. */
  contenitoreClassName?: string;
  /** "sm" per i menu dentro le righe di una tabella. */
  dimensione?: "sm" | "md";
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={cn("relative block w-full", contenitoreClassName)}>
      <select
        className={cn(
          controlloBase,
          dimensione === "sm" ? "h-8" : altezzaControllo,
          "appearance-none pl-3 pr-9",
          className
        )}
        {...props}
      />
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </span>
  );
}

export function Checkbox({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn("size-4 shrink-0 rounded-sm border-border-strong accent-accent", className)}
      {...props}
    />
  );
}

/**
 * Riga di modulo completa: etichetta sopra il controllo (la disposizione più
 * rapida da scandire secondo gli studi di eye-tracking sui moduli), testo di
 * aiuto e messaggio d'errore accanto al campo a cui si riferiscono, non in
 * cima al modulo.
 *
 * `Field` collega da sé `id`, `aria-describedby` e `aria-invalid` al
 * controllo che gli viene passato: l'associazione etichetta/campo e
 * l'annuncio dell'errore non vanno ricordati caso per caso.
 */
export function Field({
  id,
  label,
  hint,
  error,
  required,
  action,
  className,
  children,
}: {
  id: string;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  /** Elemento allineato a destra dell'etichetta (es. "Password dimenticata?"). */
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const idAiuto = hint ? `${id}-aiuto` : undefined;
  const idErrore = error ? `${id}-errore` : undefined;
  const descritto = [idAiuto, idErrore].filter(Boolean).join(" ") || undefined;

  const controllo = isValidElement(children)
    ? cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        id,
        "aria-describedby": descritto,
        "aria-invalid": error ? true : undefined,
      })
    : children;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {(label || action) && (
        <div className="flex items-baseline justify-between gap-3">
          {label && (
            <Label htmlFor={id} required={required}>
              {label}
            </Label>
          )}
          {action}
        </div>
      )}
      {controllo}
      {hint && (
        <p id={idAiuto} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={idErrore} className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Griglia per i moduli. Una colonna sola è la disposizione più veloce da
 * completare; `colonne={2}` va usato solo per campi strettamente correlati
 * (nome/cognome, importo/data).
 */
export function FormGrid({
  colonne = 1,
  className,
  ...props
}: { colonne?: 1 | 2 } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "grid gap-4",
        colonne === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1",
        className
      )}
      {...props}
    />
  );
}
