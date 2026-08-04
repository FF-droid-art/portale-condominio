"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { eliminaCondominio } from "../actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function EliminaCondominioButton({ id, nome }: { id: string; nome: string }) {
  const [aperto, setAperto] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function elimina() {
    setErrore(null);
    startTransition(async () => {
      // In caso di successo la server action reindirizza alla lista.
      const res = await eliminaCondominio(id);
      if (res && "errore" in res) setErrore(res.errore);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setErrore(null);
          setAperto(true);
        }}
        className="inline-flex items-center gap-1.5 text-sm text-danger hover:underline"
      >
        <Trash2 className="size-4" /> Elimina
      </button>

      {aperto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !pending && setAperto(false)}
        >
          <Card className="w-full max-w-sm gap-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm">
              Eliminare <span className="font-semibold">{nome}</span>? Verranno rimossi
              anche unità, persone, millesimi e legami collegati. L&apos;operazione non è
              reversibile.
            </p>
            {errore && <p className="text-sm text-danger">{errore}</p>}
            <div className="flex gap-3">
              <Button type="button" variant="danger" pending={pending} onClick={elimina}>
                Elimina
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => setAperto(false)}
              >
                Annulla
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
