"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { aggiornaContatti } from "./actions";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { FormError } from "@/components/ui/alert";
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
      <Button
        variant="ghost"
        size="sm"
        iconOnly
        onClick={apri}
        aria-label={`Modifica i contatti di ${nominativo}`}
        title="Modifica i contatti"
      >
        <Pencil className="size-4" />
      </Button>

      <Dialog
        aperto={aperto}
        onChiudi={() => setAperto(false)}
        bloccato={pending}
        titolo={`Contatti di ${nominativo}`}
        descrizione="L'indirizzo email è quello a cui arrivano gli avvisi del condominio."
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
          <Field id="contatto_email" label="Email">
            <Input
              type="email"
              value={em}
              onChange={(e) => setEm(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="nome@esempio.it"
            />
          </Field>
          <Field id="contatto_telefono" label="Telefono" hint="Facoltativo.">
            <Input
              type="tel"
              inputMode="tel"
              value={tel}
              onChange={(e) => setTel(e.target.value)}
              autoComplete="off"
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
