"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, ChevronRight, Home, Search } from "lucide-react";
import { SearchField } from "@/components/ui/search-field";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";

export type CondominioInElenco = {
  id: string;
  nome: string;
  indirizzo: string;
  codice_fiscale: string | null;
  numeroUnita: number;
};

/**
 * Elenco dei condomìni come schede cliccabili.
 *
 * Una scheda per condominio, e non una riga di tabella, perché qui i dati
 * sono pochi e quello che conta è arrivare in fretta al condominio giusto:
 * nome grande, indirizzo sotto, numero di unità a destra. La ricerca filtra
 * i dati già caricati, senza nuove richieste al server.
 */
export function ElencoCondomini({ condomini }: { condomini: CondominioInElenco[] }) {
  const [ricerca, setRicerca] = useState("");

  const visibili = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    if (!q) return condomini;
    return condomini.filter((c) =>
      [c.nome, c.indirizzo, c.codice_fiscale ?? ""].some((campo) =>
        campo.toLowerCase().includes(q)
      )
    );
  }, [condomini, ricerca]);

  return (
    <div className="flex flex-col gap-4">
      {condomini.length > 4 && (
        <SearchField
          valore={ricerca}
          onCambia={setRicerca}
          placeholder="Cerca per nome, indirizzo o codice fiscale…"
          etichetta="Cerca fra i condomìni"
        />
      )}

      {visibili.length === 0 ? (
        <EmptyState
          compatta
          icon={Search}
          title="Nessun condominio trovato"
          description={`Nessun risultato per "${ricerca}". Prova con un altro nome o indirizzo.`}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {visibili.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/condomini/${c.id}`}
                className={cn(
                  "group flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5",
                  "transition-[border-color,box-shadow,transform] duration-150",
                  "hover:-translate-y-px hover:border-border-strong hover:shadow-card-hover"
                )}
              >
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-muted text-muted-foreground transition-colors group-hover:bg-accent-subtle group-hover:text-accent-ink"
                  aria-hidden="true"
                >
                  <Building2 className="size-5" />
                </span>

                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-semibold tracking-tight">{c.nome}</span>
                  <span className="truncate text-sm text-muted-foreground">
                    {c.indirizzo}
                    {c.codice_fiscale ? ` · ${c.codice_fiscale}` : ""}
                  </span>
                </span>

                <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  <Home className="size-3.5" aria-hidden="true" />
                  <span className="cifre">{c.numeroUnita}</span>
                  <span className="hidden sm:inline">
                    {c.numeroUnita === 1 ? "unità" : "unità"}
                  </span>
                </span>

                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
