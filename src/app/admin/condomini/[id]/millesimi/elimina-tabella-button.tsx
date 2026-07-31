"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { eliminaTabellaMillesimale } from "./actions";

export function EliminaTabellaButton({
  tabellaId,
  condominioId,
}: {
  tabellaId: string;
  condominioId: string;
}) {
  const [errore, setErrore] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className="text-muted-foreground hover:text-danger disabled:opacity-50"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const risultato = await eliminaTabellaMillesimale(tabellaId, condominioId);
            setErrore(risultato.errore ?? null);
          })
        }
        aria-label="Elimina tabella"
      >
        <X className="size-4" />
      </button>
      {errore && <p className="text-xs text-danger">{errore}</p>}
    </div>
  );
}
