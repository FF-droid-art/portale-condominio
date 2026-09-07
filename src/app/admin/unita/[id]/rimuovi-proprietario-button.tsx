"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { rimuoviProprietario } from "./actions";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/alert";

/**
 * Scollega un soggetto dall'unità.
 *
 * Il legame viene cancellato, non archiviato, quindi la conferma è
 * necessaria: nell'elenco i pulsanti di rimozione sono uno sotto l'altro ed
 * è facile premere quello sbagliato.
 */
export function RimuoviProprietarioButton({
  id,
  unitaId,
  nominativo,
}: {
  id: string;
  unitaId: string;
  nominativo?: string;
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
        aria-label={nominativo ? `Rimuovi ${nominativo} da questa unità` : "Rimuovi il soggetto"}
        title="Rimuovi"
      >
        <Trash2 className="size-4" />
      </Button>

      <Dialog
        aperto={aperto}
        onChiudi={() => setAperto(false)}
        bloccato={pending}
        titolo="Rimuovere il soggetto dall'unità?"
        descrizione={
          nominativo
            ? `${nominativo} non risulterà più collegato a questa unità.`
            : "Il soggetto non risulterà più collegato a questa unità."
        }
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
                  const risultato = await rimuoviProprietario(id, unitaId);
                  if (risultato.errore) {
                    setErrore(risultato.errore);
                    return;
                  }
                  setAperto(false);
                })
              }
            >
              Rimuovi
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          La persona resta in anagrafica del condominio e potrà essere ricollegata in seguito, a
          questa o a un&apos;altra unità.
        </p>
        <FormError className="mt-3">{errore}</FormError>
      </Dialog>
    </>
  );
}
