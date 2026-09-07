"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { aggiornaMillesimi } from "./actions";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { FormError } from "@/components/ui/alert";
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
        aria-label={`Modifica i millesimi di ${identificativo}`}
        title="Modifica i millesimi"
        className="group inline-flex items-center gap-1.5 rounded-md text-left transition-colors hover:text-accent-ink"
      >
        <span className="cifre font-semibold">{formatMillesimi(millesimi)}</span>
        <Pencil
          className="size-3.5 text-muted-foreground transition-colors group-hover:text-accent-ink"
          aria-hidden="true"
        />
      </button>

      <Dialog
        aperto={aperto}
        onChiudi={() => setAperto(false)}
        bloccato={pending}
        titolo={`Millesimi di ${identificativo}`}
        descrizione="I millesimi generali su cui vengono calcolate le quote di spesa e il peso del voto in assemblea."
        footer={
          <>
            <Button variant="ghost" disabled={pending} onClick={() => setAperto(false)}>
              Annulla
            </Button>
            <Button pending={pending} onClick={salva}>
              Salva
            </Button>
          </>
        }
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            salva();
          }}
        >
          <Field id="millesimi_valore" label="Millesimi di proprietà">
            <Input
              type="number"
              min={0}
              step="0.001"
              inputMode="decimal"
              value={valore}
              onChange={(e) => setValore(e.target.value)}
              className="cifre"
            />
          </Field>
          <FormError>{errore}</FormError>
          <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
            Salva
          </button>
        </form>
      </Dialog>
    </>
  );
}
