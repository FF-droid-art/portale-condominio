"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { ritiraSegnalazione } from "../actions";
import { Dialog } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Ritiro della propria segnalazione, possibile solo finché è ancora aperta. */
export function RitiraSegnalazioneButton({ id }: { id: string }) {
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
        <Trash2 className="size-4" aria-hidden="true" />
        Ritira
      </Button>

      <Dialog
        aperto={aperto}
        onChiudi={() => setAperto(false)}
        bloccato={pending}
        titolo="Ritirare la segnalazione?"
        descrizione="Sparisce anche dalla scrivania dell'amministratore, insieme a tutti gli aggiornamenti."
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
                  const esito = await ritiraSegnalazione(id);
                  if (esito?.errore) setErrore(esito.errore);
                })
              }
            >
              Ritira
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          Si può ritirare solo finché nessuno l&apos;ha presa in carico: dopo, la traccia serve
          anche all&apos;amministratore.
        </p>
        <FormError className="mt-3">{errore}</FormError>
      </Dialog>
    </>
  );
}
