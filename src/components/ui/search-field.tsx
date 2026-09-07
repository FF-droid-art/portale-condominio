"use client";

import { useId } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Campo di ricerca che filtra elenchi già caricati.
 *
 * Non interroga il server: lavora sui dati che la pagina ha già ricevuto.
 * Serve a chi ha decine di righe e sa già che cosa sta cercando, e non
 * cambia in alcun modo che cosa la pagina è autorizzata a mostrare.
 */
export function SearchField({
  valore,
  onCambia,
  placeholder = "Cerca…",
  etichetta = "Cerca nell'elenco",
  className,
}: {
  valore: string;
  onCambia: (v: string) => void;
  placeholder?: string;
  etichetta?: string;
  className?: string;
}) {
  const id = useId();

  return (
    <div className={cn("relative w-full sm:max-w-xs", className)}>
      <label htmlFor={id} className="sr-only">
        {etichetta}
      </label>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        id={id}
        type="search"
        role="searchbox"
        value={valore}
        onChange={(e) => onCambia(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-border-strong bg-surface pl-9 pr-9 text-sm placeholder:text-muted-foreground/70 transition-colors hover:border-muted-foreground/50 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {valore && (
        <button
          type="button"
          onClick={() => onCambia("")}
          aria-label="Cancella la ricerca"
          className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
