"use client";

import { useState } from "react";
import Link from "next/link";
import { FileSpreadsheet, Plus } from "lucide-react";
import { CondominioForm } from "./form";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

/**
 * Azione principale della pagina "Condomìni".
 *
 * Il modulo di creazione vive in una finestra modale invece che in una
 * colonna fissa accanto all'elenco: si apre quando serve e lascia tutta la
 * larghezza ai dati, che è ciò che si guarda il 99% delle volte.
 */
export function NuovoCondominioBox() {
  const [aperto, setAperto] = useState(false);

  return (
    <>
      <Button onClick={() => setAperto(true)}>
        <Plus className="size-4" aria-hidden="true" />
        Nuovo condominio
      </Button>

      <Dialog
        aperto={aperto}
        onChiudi={() => setAperto(false)}
        titolo="Nuovo condominio"
        descrizione="Bastano nome e indirizzo: tutto il resto si può completare dopo, dalla scheda del condominio."
        larghezza="md"
      >
        <CondominioForm
          onFatto={() => setAperto(false)}
          annulla={
            <Button variant="ghost" onClick={() => setAperto(false)}>
              Annulla
            </Button>
          }
        />

        <p className="mt-6 border-t border-border pt-4 text-sm text-muted-foreground">
          Hai già i dati in un foglio di calcolo?{" "}
          <Link
            href="/admin/importa/condomini-unita"
            className="inline-flex items-center gap-1 rounded font-medium text-accent-ink underline-offset-4 hover:underline"
          >
            <FileSpreadsheet className="size-3.5" aria-hidden="true" />
            Importa condomìni e unità da un file
          </Link>
        </p>
      </Dialog>
    </>
  );
}
