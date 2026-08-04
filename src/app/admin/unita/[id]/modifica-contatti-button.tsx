"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { aggiornaContatti } from "./actions";
import { Card } from "@/components/ui/card";
import { Field, Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ModificaContattiButton({
  anagraficaId,
  unitaId,
  nominativo,
  email,
  telefono,
}: {
  anagraficaId: string;
  unitaId: string;
  nominativo: string;
  email: string | null;
  telefono: string | null;
}) {
  const [aperto, setAperto] = useState(false);
  const [em, setEm] = useState(email ?? "");
  const [tel, setTel] = useState(telefono ?? "");
  const [errore, setErrore] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function apri() {
    setEm(email ?? "");
    setTel(telefono ?? "");
    setErrore(null);
    setAperto(true);
  }

  function salva() {
    setErrore(null);
    startTransition(async () => {
      const res = await aggiornaContatti({
        anagraficaId,
        unitaId,
        email: em,
        telefono: tel.trim() || null,
      });
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
        title="Modifica email e telefono"
        className="text-muted-foreground hover:text-accent"
      >
        <Pencil className="size-4" />
      </button>

      {aperto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !pending && setAperto(false)}
        >
          <Card className="w-full max-w-sm gap-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold">Contatti di {nominativo}</p>
            <Field>
              <Label htmlFor="contatto_email">Email</Label>
              <Input
                id="contatto_email"
                type="email"
                value={em}
                onChange={(e) => setEm(e.target.value)}
              />
            </Field>
            <Field>
              <Label htmlFor="contatto_telefono">Telefono</Label>
              <Input
                id="contatto_telefono"
                value={tel}
                onChange={(e) => setTel(e.target.value)}
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
