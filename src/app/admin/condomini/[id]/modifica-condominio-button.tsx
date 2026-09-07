"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { aggiornaCondominio } from "../actions";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function ModificaCondominioButton({
  id,
  nome,
  indirizzo,
  codiceFiscale,
}: {
  id: string;
  nome: string;
  indirizzo: string;
  codiceFiscale: string | null;
}) {
  const [aperto, setAperto] = useState(false);
  const [n, setN] = useState(nome);
  const [ind, setInd] = useState(indirizzo);
  const [cf, setCf] = useState(codiceFiscale ?? "");
  const [errore, setErrore] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function apri() {
    setN(nome);
    setInd(indirizzo);
    setCf(codiceFiscale ?? "");
    setErrore(null);
    setAperto(true);
  }

  function salva() {
    setErrore(null);
    startTransition(async () => {
      const res = await aggiornaCondominio({
        id,
        nome: n,
        indirizzo: ind,
        codiceFiscale: cf.trim() || null,
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
      <Button variant="secondary" onClick={apri}>
        <Pencil className="size-4" aria-hidden="true" />
        Modifica
      </Button>

      <Dialog
        aperto={aperto}
        onChiudi={() => setAperto(false)}
        bloccato={pending}
        titolo="Modifica condominio"
        descrizione="Nome, indirizzo e codice fiscale del condominio."
        footer={
          <>
            <Button variant="ghost" disabled={pending} onClick={() => setAperto(false)}>
              Annulla
            </Button>
            <Button pending={pending} onClick={salva}>
              Salva modifiche
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
          <Field id="mod_nome" label="Nome" required>
            <Input value={n} onChange={(e) => setN(e.target.value)} required />
          </Field>
          <Field id="mod_indirizzo" label="Indirizzo" required>
            <Input value={ind} onChange={(e) => setInd(e.target.value)} required />
          </Field>
          <Field id="mod_cf" label="Codice fiscale" hint="Facoltativo.">
            <Input
              value={cf}
              onChange={(e) => setCf(e.target.value)}
              autoCapitalize="characters"
              spellCheck={false}
            />
          </Field>
          <FormError>{errore}</FormError>
          {/* Invio da tastiera: il pulsante di conferma visibile sta nel piè
              di pagina della finestra, questo serve solo al tasto Invio. */}
          <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
            Salva
          </button>
        </form>
      </Dialog>
    </>
  );
}
