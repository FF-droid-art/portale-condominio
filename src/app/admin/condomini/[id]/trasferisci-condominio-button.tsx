"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function TrasferisciCondominioButton() {
  const [aperto, setAperto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAperto(true)}
        title="Trasferisci il condominio a un altro amministratore"
        className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
      >
        <Share2 className="size-4" /> Trasferisci
      </button>

      {aperto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setAperto(false)}
        >
          <Card
            className="w-full max-w-sm items-center gap-3 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <Share2 className="size-8 text-accent" />
            <p className="text-sm font-semibold">Trasferisci condominio</p>
            <p className="text-sm text-muted-foreground">
              Trasferire la gestione del condominio a un altro amministratore (es. dopo la
              revoca della nomina) sarà presto disponibile. 🚧 Funzione in lavorazione.
            </p>
            <Button type="button" onClick={() => setAperto(false)}>
              Ho capito
            </Button>
          </Card>
        </div>
      )}
    </>
  );
}
