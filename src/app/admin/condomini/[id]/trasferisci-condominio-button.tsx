"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function TrasferisciCondominioButton() {
  const [aperto, setAperto] = useState(false);

  return (
    <>
      <Button variant="ghost" onClick={() => setAperto(true)}>
        <Share2 className="size-4" aria-hidden="true" />
        Trasferisci a un altro amministratore
      </Button>

      <Dialog
        aperto={aperto}
        onChiudi={() => setAperto(false)}
        titolo="Trasferisci condominio"
        footer={
          <Button onClick={() => setAperto(false)}>Ho capito</Button>
        }
      >
        <Alert tono="warning" titolo="Funzione in lavorazione">
          Il passaggio della gestione di un condominio a un altro amministratore
          (per esempio dopo la revoca della nomina) sarà disponibile in un
          prossimo aggiornamento. Nel frattempo il condominio resta assegnato a
          te.
        </Alert>
      </Dialog>
    </>
  );
}
