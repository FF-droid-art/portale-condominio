import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Intestazione di pagina: sempre nello stesso posto e nello stesso ordine
 * (dove sono → dove sono arrivato da → che pagina è → che cosa posso farci).
 *
 * La costanza della posizione è metà del lavoro di orientamento: chi entra
 * in una pagina di dettaglio trova il ritorno indietro sempre in alto a
 * sinistra e l'azione principale sempre in alto a destra.
 */
export function PageHeader({
  titolo,
  descrizione,
  eyebrow,
  indietro,
  azioni,
  meta,
  className,
}: {
  titolo: React.ReactNode;
  descrizione?: React.ReactNode;
  /** Riga di contesto sopra il titolo (es. il condominio di appartenenza). */
  eyebrow?: React.ReactNode;
  /** Collegamento di ritorno alla sezione superiore. */
  indietro?: { href: string; label: string };
  /** Azioni principali della pagina, allineate a destra del titolo. */
  azioni?: React.ReactNode;
  /** Badge o dati brevi sotto al titolo. */
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-4", className)}>
      {indietro && (
        <Link
          href={indietro.href}
          className="-ml-1 inline-flex w-fit items-center gap-1 rounded-md py-0.5 pr-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          {indietro.label}
        </Link>
      )}

      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          {eyebrow && (
            <div className="text-sm font-medium text-muted-foreground">{eyebrow}</div>
          )}
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            {titolo}
          </h1>
          {descrizione && (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {descrizione}
            </p>
          )}
          {meta && <div className="mt-1 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>

        {azioni && <div className="flex flex-wrap items-center gap-2">{azioni}</div>}
      </div>
    </header>
  );
}

/** Contenitore standard del contenuto di una pagina: un unico ritmo verticale. */
export function PageBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex min-w-0 flex-col gap-6 sm:gap-8", className)} {...props} />;
}
