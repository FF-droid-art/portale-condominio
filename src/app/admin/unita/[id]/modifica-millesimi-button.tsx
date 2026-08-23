"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { aggiornaMillesimi } from "./actions";
import { Card } from "@/components/ui/card";
import { Field, Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatMillesimi } from "@/lib/format";

export function ModificaMillesimiButton({
  unitaId,
  condominioId,
  identificativo,
  millesimi,
}: {
  unitaId: string;
  condominioId: string;
  identificativo: string;
  millesimi: number;
}) {
  const [aperto, setAperto] = useState(false);
  const [valore, setValore] = useState(String(millesimi));
  const [errore, setErrore] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function apri() {
    setValore(String(millesimi));
    setErrore(null);
    setAperto(true);
  }

  function salva() {
    setErrore(null);
    const numero = Number(valore.replace(",", "."));
    startTransition(async () => {
      const res = await aggiornaMillesimi({ unitaId, condominioId, millesimi: numero });
      if ("errore" in res) {
        setErrore(res.errore);
        return;
      }
      setAperto(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={apri}
        title="Modifica millesimi"
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-accent"
      >
        {formatMillesimi(millesimi)}
        <Pencil className="size-3.5" />
      </button>

      {aperto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !pending && setAperto(false)}
        >
          <Card className="w-full max-w-sm gap-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold">Millesimi di {identificativo}</p>
            <Field>
              <Label htmlFor="millesimi_valore">Millesimi di proprietà</Label>
              <Input
                id="millesimi_valore"
                type="number"
                min={0}
                step="0.001"
                value={valore}
                onChange={(e) => setValore(e.target.value)}
              />
            </Field>
            {errore && <p className="text-sm text-danger">{errore}</p>}
            <div className="flex gap-3">
              <Button type="button" pending={pending} onClick={salva}>
                Salva
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
