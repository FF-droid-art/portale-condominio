"use client";

import { useState, useTransition } from "react";
import { Wand2 } from "lucide-react";
import { generaCodiciInvitoMancanti } from "@/app/admin/condomini/[id]/inviti/actions";
import { Button } from "@/components/ui/button";
import { FormError, FormSuccess } from "@/components/ui/alert";

/**
 * Crea i codici delle unità che non ne hanno ancora uno.
 *
 * Da qui in avanti ogni unità nasce già con il suo codice (il trigger
 * `trg_unita_crea_invito` del database): questo pulsante serve una volta
 * sola per ciascun condominio, quello creato prima della funzionalità.
 * Resta visibile anche dopo perché è innocuo — a codici tutti presenti
 * risponde "nessun codice da creare" — e perché nasconderlo richiederebbe
 * di spiegare altrove cosa fare se un codice manca.
 */
export function GeneraMancantiButton({
  condominioId,
  mancanti,
}: {
  condominioId: string;
  /** Quante unità risultano senza codice al momento del render. */
  mancanti: number;
}) {
  const [errore, setErrore] = useState<string | null>(null);
  const [esito, setEsito] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <span className="flex flex-col items-end gap-1.5 print:hidden">
      <Button
        variant={mancanti > 0 ? "primary" : "secondary"}
        size="sm"
        pending={pending}
        onClick={() =>
          startTransition(async () => {
            setErrore(null);
            setEsito(null);
            const risultato = await generaCodiciInvitoMancanti(condominioId);
            if ("errore" in risultato) {
              setErrore(risultato.errore);
              return;
            }
            setEsito(
              risultato.creati === 0
                ? "Nessun codice da creare: tutte le unità ne hanno già uno."
                : risultato.creati === 1
                  ? "Creato il codice di 1 unità."
                  : `Creati i codici di ${risultato.creati} unità.`
            );
          })
        }
      >
        <Wand2 className="size-4" aria-hidden="true" />
        Genera i codici mancanti
      </Button>
      <FormError>{errore}</FormError>
      <FormSuccess>{esito}</FormSuccess>
    </span>
  );
}
