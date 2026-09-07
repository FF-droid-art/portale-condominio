"use client";

import { useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { revocaDelega } from "./actions";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/alert";

export function RevocaDelegaButton({
  delegaId,
  assembleaId,
  unitaLabel,
}: {
  delegaId: string;
  assembleaId: string;
  unitaLabel?: string;
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
        aria-label={unitaLabel ? `Revoca la delega di ${unitaLabel}` : undefined}
        onClick={() =>
          startTransition(async () => {
            const risultato = await revocaDelega(delegaId, assembleaId);
            setErrore(risultato.errore ?? null);
          })
        }
      >
        <RotateCcw className="size-4" aria-hidden="true" />
        Revoca
      </Button>
      <FormError piccolo>{errore}</FormError>
    </div>
  );
}
