"use client";

import { useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Alert, FormError } from "@/components/ui/alert";
import { annullaImportazione } from "@/app/admin/importa/cronologia-actions";

/**
 * Annulla un'importazione, rimuovendo i dati che aveva creato.
 *
 * La conferma è in una finestra modale e non in linea nella riga della
 * tabella: l'operazione cancella dati reali e merita di essere letta, non
 * confermata di sfuggita mentre si scorre l'elenco.
 */
export function AnnullaImportazioneButton({
  batchId,
  nomeFile,
}: {
  batchId: string;
  nomeFile?: string;
}) {
  const [aperto, setAperto] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setErrore(null);
          setAperto(true);
        }}
        aria-label={nomeFile ? `Annulla l'importazione di ${nomeFile}` : undefined}
      >
        <RotateCcw className="size-4" aria-hidden="true" />
        Annulla
      </Button>

      <Dialog
        aperto={aperto}
        onChiudi={() => setAperto(false)}
        bloccato={pending}
        titolo="Annullare questa importazione?"
        descrizione={nomeFile}
        footer={
          <>
            <Button variant="ghost" disabled={pending} onClick={() => setAperto(false)}>
              Mantieni i dati
            </Button>
            <Button
              variant="danger"
              pending={pending}
              onClick={() =>
                startTransition(async () => {
                  const risultato = await annullaImportazione(batchId);
                  if (risultato.errore) {
                    setErrore(risultato.errore);
                    return;
                  }
                  setAperto(false);
                })
              }
            >
              Annulla l&apos;importazione
            </Button>
          </>
        }
      >
        <Alert tono="warning" titolo="I dati creati da questa importazione verranno rimossi">
          Le modifiche fatte a mano dopo l&apos;importazione su quegli stessi dati andranno perse.
          L&apos;operazione non è reversibile.
        </Alert>
        <FormError className="mt-3">{errore}</FormError>
      </Dialog>
    </>
  );
}
