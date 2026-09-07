import { Building2 } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Marchio del prodotto: un blocco di brand con l'icona dell'edificio e il
 * logotipo su due pesi. La stessa forma compare nella barra laterale, nelle
 * pagine di autenticazione e nel sito pubblico, così l'identità resta una
 * sola in tutta l'applicazione.
 */
export function Logo({
  soloSimbolo,
  inverso,
  className,
}: {
  soloSimbolo?: boolean;
  /** Variante per sfondi scuri (hero pubblico, pagine di autenticazione). */
  inverso?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-[0.625rem] text-white shadow-xs",
          inverso
            ? "bg-white/12 ring-1 ring-inset ring-white/25"
            : "bg-gradient-to-br from-navy-light to-accent"
        )}
        aria-hidden="true"
      >
        <Building2 className="size-4.5" />
      </span>
      {!soloSimbolo && (
        <span
          className={cn(
            "text-[0.9375rem] font-semibold leading-none tracking-tight",
            inverso ? "text-white" : "text-foreground"
          )}
        >
          <span className={inverso ? "text-white/65" : "text-muted-foreground"}>Portale</span>{" "}
          Condominio
        </span>
      )}
    </span>
  );
}
