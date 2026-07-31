"use client";

import { useState, useTransition } from "react";
import { revocaDelega } from "./actions";
import { Button } from "@/components/ui/button";

export function RevocaDelegaButton({
  delegaId,
  assembleaId,
}: {
  delegaId: string;
  assembleaId: string;
}) {
  const [errore, setErrore] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        pending={pending}
        onClick={() =>
          startTransition(async () => {
            const risultato = await revocaDelega(delegaId, assembleaId);
            setErrore(risultato.errore ?? null);
          })
        }
      >
        Revoca delega
      </Button>
      {errore && <p className="text-xs text-danger">{errore}</p>}
    </div>
  );
}
