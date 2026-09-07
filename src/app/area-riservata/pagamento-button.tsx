"use client";

import { CreditCard } from "lucide-react";
import { avviaPagamento } from "./actions";
import { Button } from "@/components/ui/button";

export function PagamentoButton({
  ripartizioneId,
  descrizione,
}: {
  ripartizioneId: string;
  /** Serve solo all'etichetta accessibile: in una tabella con tante righe
   *  "Paga ora" da solo non dice quale quota si sta pagando. */
  descrizione?: string;
}) {
  return (
    <form action={avviaPagamento}>
      <input type="hidden" name="ripartizione_id" value={ripartizioneId} />
      <Button
        type="submit"
        size="sm"
        aria-label={descrizione ? `Paga ora: ${descrizione}` : undefined}
      >
        <CreditCard className="size-4" aria-hidden="true" />
        Paga ora
      </Button>
    </form>
  );
}
