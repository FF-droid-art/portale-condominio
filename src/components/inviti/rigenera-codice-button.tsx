"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { rigeneraCodiceInvito } from "@/app/admin/condomini/[id]/inviti/actions";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/alert";

/**
 * Rigenera il codice di invito di un'unità.
 *
 * Serve quando un codice è finito alla persona sbagliata: il nuovo
 * sostituisce il vecchio, che smette di valere nello stesso istante. La
 * conferma c'è perché l'operazione ha una conseguenza che non si vede da
 * questa pagina — chi ha ricevuto il foglio con il codice vecchio non
 * potrà più usarlo e va avvisato.
 *
 * Chi è già collegato all'unità resta collegato: il codice serve solo al
 * momento della registrazione.
 */
export function RigeneraCodiceButton({
  unitaId,
  condominioId,
  identificativo,
  dimensione = "sm",
}: {
  unitaId: string;
  condominioId: string;
  identificativo: string;
  dimensione?: "xs" | "sm";
}) {
  const [aperto, setAperto] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button
        variant="ghost"
        size={dimensione}
        iconOnly
        onClick={() => {
          setErrore(null);
          setAperto(true);
        }}
        className="print:hidden"
        aria-label={`Rigenera il codice di invito di ${identificativo}`}
        title="Rigenera il codice"
      >
        <RefreshCw className="size-4" />
      </Button>

      <Dialog
        aperto={aperto}
        onChiudi={() => setAperto(false)}
        bloccato={pending}
        titolo={`Rigenerare il codice di ${identificativo}?`}
        descrizione="Il codice attuale smette di funzionare subito e ne viene generato uno nuovo."
        footer={
          <>
            <Button variant="ghost" disabled={pending} onClick={() => setAperto(false)}>
              Annulla
            </Button>
            <Button
              pending={pending}
              onClick={() =>
                startTransition(async () => {
                  const esito = await rigeneraCodiceInvito({ unitaId, condominioId });
                  if ("errore" in esito) {
                    setErrore(esito.errore);
                    return;
                  }
                  setAperto(false);
                })
              }
            >
              Rigenera
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          Fallo se il codice è stato consegnato alla persona sbagliata. Chi si è già
          registrato con il codice vecchio resta collegato all&apos;unità; chi deve ancora
          farlo avrà bisogno di quello nuovo.
        </p>
        <FormError className="mt-3">{errore}</FormError>
      </Dialog>
    </>
  );
}
