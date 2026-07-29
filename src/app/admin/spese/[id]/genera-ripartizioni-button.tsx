"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { generaRipartizioni } from "./actions";

export function GeneraRipartizioniButton({
  spesaId,
  condominioId,
  importoTotale,
}: {
  spesaId: string;
  condominioId: string;
  importoTotale: number;
}) {
  const [errore, setErrore] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        pending={pending}
        onClick={() =>
          startTransition(async () => {
            const risultato = await generaRipartizioni(spesaId, condominioId, importoTotale);
            setErrore(risultato.errore ?? null);
          })
        }
      >
        Genera ripartizione per unità
      </Button>
      {errore && <p className="text-sm text-danger">{errore}</p>}
    </div>
  );
}
