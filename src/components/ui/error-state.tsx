"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Schermata di errore condivisa dai vari confini di errore.
 *
 * Dice tre cose, in quest'ordine: che cosa è successo, che cosa si può fare
 * subito (riprovare, senza ricaricare tutta la pagina) e dove andare
 * altrimenti. Il codice tecnico è in fondo e in piccolo: non serve a chi
 * legge, ma serve a chi dovrà cercare l'errore nei log.
 */
export function ErrorState({
  titolo = "Qualcosa non ha funzionato",
  descrizione = "Non siamo riusciti a caricare questa pagina. Spesso è un problema temporaneo: riprova fra un istante.",
  digest,
  onRiprova,
  tornaA,
}: {
  titolo?: string;
  descrizione?: string;
  digest?: string;
  onRiprova?: () => void;
  tornaA?: { href: string; label: string };
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <span
          className="grid size-12 place-items-center rounded-2xl bg-danger-bg text-danger"
          aria-hidden="true"
        >
          <AlertTriangle className="size-6" />
        </span>

        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold tracking-tight">{titolo}</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">{descrizione}</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {onRiprova && (
            <Button onClick={onRiprova}>
              <RotateCcw className="size-4" aria-hidden="true" />
              Riprova
            </Button>
          )}
          {tornaA && (
            <Button href={tornaA.href} variant="secondary">
              {tornaA.label}
            </Button>
          )}
        </div>

        {digest && (
          <p className="font-mono text-xs text-muted-foreground/70">
            Codice errore: {digest}
          </p>
        )}
      </div>
    </div>
  );
}
