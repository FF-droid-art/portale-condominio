"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { annullaPrenotazione } from "./actions";
import { Dialog } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Annulla una propria prenotazione ancora da venire. */
export function AnnullaButton({ id, descrizione }: { id: string; descrizione: string }) {
  const [aperto, setAperto] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button
        variant="ghost-danger"
        size="sm"
        onClick={() => {
          setErrore(null);
          setAperto(true);
        }}
      >
        <X className="size-4" aria-hidden="true" />
        Annulla
      </Button>

      <Dialog
        aperto={aperto}
        onChiudi={() => setAperto(false)}
        bloccato={pending}
        titolo="Annullare la prenotazione?"
        descrizione={descrizione}
        footer={
          <>
            <Button variant="ghost" disabled={pending} onClick={() => setAperto(false)}>
              Torna indietro
            </Button>
            <Button
              variant="danger"
              pending={pending}
              onClick={() =>
                startTransition(async () => {
                  const esito = await annullaPrenotazione(id);
                  if (esito.errore) {
                    setErrore(esito.errore);
                    return;
                  }
                  setAperto(false);
                })
              }
            >
              Annulla la prenotazione
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          La fascia oraria torna subito libera per gli altri condòmini.
        </p>
        <FormError className="mt-3">{errore}</FormError>
      </Dialog>
    </>
  );
}
