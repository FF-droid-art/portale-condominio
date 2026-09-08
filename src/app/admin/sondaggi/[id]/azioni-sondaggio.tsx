"use client";

import { useState, useTransition } from "react";
import { Lock, Trash2, Unlock } from "lucide-react";
import { cambiaStatoSondaggio, eliminaSondaggio } from "../actions";
import { Dialog } from "@/components/ui/dialog";
import { Button, ButtonGroup } from "@/components/ui/button";
import { FormError } from "@/components/ui/alert";

export function AzioniSondaggio({
  sondaggioId,
  stato,
}: {
  sondaggioId: string;
  stato: "aperto" | "chiuso";
}) {
  const [errore, setErrore] = useState<string | undefined>();
  const [confermaAperta, setConfermaAperta] = useState(false);
  const [inCorso, startTransition] = useTransition();

  function cambiaStato() {
    setErrore(undefined);
    startTransition(async () => {
      const esito = await cambiaStatoSondaggio(
        sondaggioId,
        stato === "aperto" ? "chiuso" : "aperto"
      );
      if (esito.errore) setErrore(esito.errore);
    });
  }

  function elimina() {
    setErrore(undefined);
    startTransition(async () => {
      const esito = await eliminaSondaggio(sondaggioId);
      if (esito?.errore) {
        setErrore(esito.errore);
        setConfermaAperta(false);
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <ButtonGroup>
        <Button variant="secondary" onClick={cambiaStato} pending={inCorso}>
          {stato === "aperto" ? (
            <>
              <Lock className="size-4" aria-hidden="true" />
              Chiudi il sondaggio
            </>
          ) : (
            <>
              <Unlock className="size-4" aria-hidden="true" />
              Riapri il sondaggio
            </>
          )}
        </Button>
        <Button
          variant="danger-ghost"
          iconOnly
          aria-label="Elimina il sondaggio"
          disabled={inCorso}
          onClick={() => setConfermaAperta(true)}
        >
          <Trash2 className="size-4" />
        </Button>
      </ButtonGroup>

      <FormError piccolo>{errore}</FormError>

      <Dialog
        aperto={confermaAperta}
        onChiudi={() => setConfermaAperta(false)}
        bloccato={inCorso}
        titolo="Eliminare il sondaggio?"
        descrizione="Vengono cancellate anche tutte le risposte già raccolte. L'operazione non è reversibile."
        footer={
          <>
            <Button variant="ghost" disabled={inCorso} onClick={() => setConfermaAperta(false)}>
              Annulla
            </Button>
            <Button variant="danger" pending={inCorso} onClick={elimina}>
              Elimina
            </Button>
          </>
        }
      />
    </div>
  );
}
