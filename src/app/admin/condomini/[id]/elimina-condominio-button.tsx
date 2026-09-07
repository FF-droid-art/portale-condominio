"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { eliminaCondominio } from "../actions";
import { Dialog } from "@/components/ui/dialog";
import { Alert, FormError } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Eliminazione di un condominio.
 *
 * È l'unica azione irreversibile dell'applicazione, quindi la conferma non è
 * un semplice "sei sicuro?": va riscritto il nome del condominio. Il passo in
 * più è deliberato — rende impossibile cancellare per inerzia — ed elenca
 * prima che cosa verrà rimosso insieme al condominio.
 */
export function EliminaCondominioButton({ id, nome }: { id: string; nome: string }) {
  const [aperto, setAperto] = useState(false);
  const [conferma, setConferma] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confermato = conferma.trim().toLowerCase() === nome.trim().toLowerCase();

  function apri() {
    setConferma("");
    setErrore(null);
    setAperto(true);
  }

  function elimina() {
    if (!confermato) return;
    setErrore(null);
    startTransition(async () => {
      // In caso di successo la server action reindirizza alla lista.
      const res = await eliminaCondominio(id);
      if (res && "errore" in res) setErrore(res.errore);
    });
  }

  return (
    <>
      <Button variant="danger-ghost" onClick={apri}>
        <Trash2 className="size-4" aria-hidden="true" />
        Elimina condominio
      </Button>

      <Dialog
        aperto={aperto}
        onChiudi={() => setAperto(false)}
        bloccato={pending}
        titolo="Eliminare questo condominio?"
        descrizione="L'operazione non è reversibile."
        footer={
          <>
            <Button variant="ghost" disabled={pending} onClick={() => setAperto(false)}>
              Annulla
            </Button>
            <Button variant="danger" pending={pending} disabled={!confermato} onClick={elimina}>
              Elimina definitivamente
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Alert tono="danger" titolo={`Verrà rimosso tutto il contenuto di "${nome}"`}>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              <li>le unità immobiliari e i loro millesimi</li>
              <li>le persone in anagrafica e i legami con le unità</li>
              <li>le spese, le ripartizioni e le assemblee collegate</li>
            </ul>
          </Alert>

          <Field
            id="conferma_eliminazione"
            label={
              <>
                Per confermare, scrivi <strong className="font-semibold">{nome}</strong>
              </>
            }
          >
            <Input
              value={conferma}
              onChange={(e) => setConferma(e.target.value)}
              autoComplete="off"
              placeholder={nome}
            />
          </Field>

          <FormError>{errore}</FormError>
        </div>
      </Dialog>
    </>
  );
}
