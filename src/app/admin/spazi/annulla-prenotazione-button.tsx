"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { annullaPrenotazioneAdmin } from "./actions";
import { Dialog } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Annulla una prenotazione altrui: la riga resta, con stato "annullata". */
export function AnnullaPrenotazioneButton({
  id,
  descrizione,
}: {
  id: string;
  descrizione: string;
}) {
  const [aperto, setAperto] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button
        variant="ghost-danger"
        size="sm"
        iconOnly
        onClick={() => {
          setErrore(null);
          setAperto(true);
        }}
        aria-label={`Annulla la prenotazione di ${descrizione}`}
        title="Annulla la prenotazione"
      >
        <X className="size-4" />
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
                  const esito = await annullaPrenotazioneAdmin(id);
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
          La fascia oraria torna libera. Chi aveva prenotato continua a vedere la prenotazione
          nella sua area riservata, segnata come annullata: il portale non gli manda alcun
          avviso, quindi conviene dirglielo.
        </p>
        <FormError className="mt-3">{errore}</FormError>
      </Dialog>
    </>
  );
}
