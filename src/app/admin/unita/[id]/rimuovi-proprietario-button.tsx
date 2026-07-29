"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { rimuoviProprietario } from "./actions";

export function RimuoviProprietarioButton({
  id,
  unitaId,
}: {
  id: string;
  unitaId: string;
}) {
  const [errore, setErrore] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="danger"
        size="sm"
        pending={pending}
        onClick={() =>
          startTransition(async () => {
            const risultato = await rimuoviProprietario(id, unitaId);
            setErrore(risultato.errore ?? null);
          })
        }
      >
        Rimuovi
      </Button>
      {errore && <p className="text-xs text-danger">{errore}</p>}
    </div>
  );
}
