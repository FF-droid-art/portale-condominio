"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { aggiornaCondominio } from "../actions";
import { Card } from "@/components/ui/card";
import { Field, Input, Label } from "@/components/ui/input";
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
      <button
        type="button"
        onClick={apri}
        title="Modifica nome, indirizzo e codice fiscale"
        className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
      >
        <Pencil className="size-4" /> Modifica
      </button>

      {aperto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !pending && setAperto(false)}
        >
          <Card className="w-full max-w-sm gap-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold">Modifica condominio</p>
            <Field>
              <Label htmlFor="mod_nome">Nome</Label>
              <Input id="mod_nome" value={n} onChange={(e) => setN(e.target.value)} />
            </Field>
            <Field>
              <Label htmlFor="mod_indirizzo">Indirizzo</Label>
              <Input id="mod_indirizzo" value={ind} onChange={(e) => setInd(e.target.value)} />
            </Field>
            <Field>
              <Label htmlFor="mod_cf">Codice fiscale (opzionale)</Label>
              <Input id="mod_cf" value={cf} onChange={(e) => setCf(e.target.value)} />
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
