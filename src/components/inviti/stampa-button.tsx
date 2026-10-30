"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Apre la finestra di stampa del browser.
 *
 * Niente generazione PDF lato server: il foglio dei codici è una pagina
 * HTML già impaginata per la stampa (vedi le regole `print:` nella pagina
 * di riepilogo), e la stampa del browser produce lo stesso risultato
 * potendo anche salvarlo in PDF. Un PDF generato con `pdf-lib`, come
 * quelli del rendiconto, servirebbe solo a riscrivere un'impaginazione che
 * qui esiste già.
 */
export function StampaButton({ etichetta = "Stampa" }: { etichetta?: string }) {
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => window.print()}
      className="print:hidden"
    >
      <Printer className="size-4" aria-hidden="true" />
      {etichetta}
    </Button>
  );
}
