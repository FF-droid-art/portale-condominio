"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { annullaImportazione } from "@/app/admin/importa/cronologia-actions";

export function AnnullaImportazioneButton({ batchId }: { batchId: string }) {
  const [confermaRichiesta, setConfermaRichiesta] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confermaRichiesta) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setConfermaRichiesta(true)}
      >
        Annulla
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Sicuro?</span>
      <Button
        variant="danger"
        size="sm"
        pending={pending}
        onClick={() =>
          startTransition(async () => {
            const risultato = await annullaImportazione(batchId);
            if (risultato.errore) {
              setErrore(risultato.errore);
              setConfermaRichiesta(false);
            }
          })
        }
      >
        Conferma
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfermaRichiesta(false)}>
        Annulla
      </Button>
      {errore && <span className="text-xs text-danger">{errore}</span>}
    </div>
  );
}
