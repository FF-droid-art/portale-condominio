"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * Il codice di invito in chiaro, con il pulsante per copiarlo.
 *
 * Il codice si consegna in tre modi diversi (si detta al telefono, si
 * incolla in una email, si inquadra dal QR) e questo componente serve il
 * secondo: un codice da ricopiare a mano dentro una email è un codice che
 * prima o poi viene sbagliato.
 *
 * `navigator.clipboard` non esiste in contesti non sicuri (http su un
 * indirizzo che non è localhost) e può essere negato dall'utente: in quel
 * caso, al primo tentativo fallito, il pulsante scompare invece di restare
 * lì a non fare nulla. La disponibilità non si controlla prima del primo
 * clic di proposito: farlo richiederebbe un effetto al montaggio (il
 * server non sa cosa supporta il browser) e un render in più per ogni
 * codice mostrato — su un foglio con cinquanta unità sono cinquanta. Il
 * codice resta comunque selezionabile a mano, che è il motivo per cui è un
 * normale nodo di testo e non un'immagine.
 */
export function CodiceCopiabile({
  codice,
  etichetta,
  dimensione = "md",
  className,
}: {
  /** Già formattato `XXXX-XXXX`. */
  codice: string;
  /** Per chi usa uno screen reader: di quale unità è il codice. */
  etichetta: string;
  dimensione?: "sm" | "md";
  className?: string;
}) {
  const [copiato, setCopiato] = useState(false);
  const [copiaDisponibile, setCopiaDisponibile] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  async function copia() {
    try {
      await navigator.clipboard.writeText(codice);
      setCopiato(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopiato(false), 2000);
    } catch (errore) {
      console.error("[inviti] copia del codice negata dal browser", errore);
      setCopiaDisponibile(false);
    }
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className={cn(
          "cifre select-all font-semibold tracking-[0.12em]",
          dimensione === "sm" ? "text-sm" : "text-lg"
        )}
      >
        {codice}
      </span>
      {copiaDisponibile && (
        <Button
          variant="ghost"
          size={dimensione === "sm" ? "xs" : "sm"}
          iconOnly
          onClick={copia}
          // Il pulsante non va in stampa: su carta non c'è niente da copiare.
          className="print:hidden"
          aria-label={copiato ? `Codice di ${etichetta} copiato` : `Copia il codice di ${etichetta}`}
          title={copiato ? "Copiato" : "Copia il codice"}
        >
          {copiato ? (
            <Check className="size-4 text-success" />
          ) : (
            <Copy className="size-4" />
          )}
        </Button>
      )}
    </span>
  );
}
