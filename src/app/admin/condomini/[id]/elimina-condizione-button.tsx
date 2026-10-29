"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { eliminaCondizioneSicurezza } from "../actions";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/alert";

/**
 * Elimina una voce del registro delle condizioni di sicurezza.
 *
 * La conferma non è un eccesso di zelo: la voce è un dato di registro e
 * cancellarla toglie la traccia di una verifica già eseguita, che non si
 * ricostruisce.
 */
export function EliminaCondizioneButton({
  id,
  condominioId,
  parte,
}: {
  id: string;
  condominioId: string;
  parte: string;
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
        aria-label={`Elimina la voce «${parte}» dal registro delle condizioni di sicurezza`}
        title="Elimina la voce"
      >
        <Trash2 className="size-4" />
      </Button>

      <Dialog
        aperto={aperto}
        onChiudi={() => setAperto(false)}
        bloccato={pending}
        titolo="Eliminare la voce dal registro?"
        descrizione={`«${parte}» non comparirà più tra le condizioni di sicurezza delle parti comuni, né all'amministratore né ai condòmini.`}
        footer={
          <>
            <Button variant="ghost" disabled={pending} onClick={() => setAperto(false)}>
              Annulla
            </Button>
            <Button
              variant="danger"
              pending={pending}
              onClick={() =>
                startTransition(async () => {
                  const risultato = await eliminaCondizioneSicurezza(id, condominioId);
                  if (risultato.errore) {
                    setErrore(risultato.errore);
                    return;
                  }
                  setAperto(false);
                })
              }
            >
              Elimina
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          Se la verifica è stata ripetuta, conviene registrare la nuova voce invece di
          cancellare quella vecchia: il registro deve poter dar conto anche dello storico.
        </p>
        <FormError className="mt-3">{errore}</FormError>
      </Dialog>
    </>
  );
}
