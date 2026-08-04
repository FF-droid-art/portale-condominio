"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { aggiornaContoCorrente } from "./actions";
import { Field, Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Condominio } from "@/lib/types";

export function ContoCorrenteForm({ condominio }: { condominio: Condominio }) {
  const [iban, setIban] = useState(condominio.iban ?? "");
  const [banca, setBanca] = useState(condominio.banca ?? "");
  const [intestatario, setIntestatario] = useState(condominio.intestatario_conto ?? "");
  const [modifica, setModifica] = useState(!condominio.iban);
  const [errore, setErrore] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const haConto = Boolean(iban.trim());

  function salva() {
    setErrore(null);
    startTransition(async () => {
      const res = await aggiornaContoCorrente({
        condominioId: condominio.id,
        iban,
        banca,
        intestatarioConto: intestatario,
      });
      if ("errore" in res) {
        setErrore(res.errore);
        return;
      }
      setModifica(false);
    });
  }

  // Vista riassunto: conto già salvato e non in modifica.
  if (!modifica && haConto) {
    return (
      <div className="flex flex-col gap-3">
        <dl className="flex flex-col gap-2 text-sm">
          <RigaConto etichetta="IBAN" valore={iban} mono />
          {banca.trim() && <RigaConto etichetta="Banca" valore={banca} />}
          {intestatario.trim() && <RigaConto etichetta="Intestatario" valore={intestatario} />}
        </dl>
        <button
          type="button"
          onClick={() => setModifica(true)}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-accent hover:underline"
        >
          <Pencil className="size-4" /> Modifica
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Field>
        <Label htmlFor="iban">IBAN</Label>
        <Input
          id="iban"
          value={iban}
          onChange={(e) => setIban(e.target.value)}
          placeholder="IT00 X000 0000 0000 0000 0000 000"
        />
      </Field>
      <Field>
        <Label htmlFor="banca">Banca</Label>
        <Input
          id="banca"
          value={banca}
          onChange={(e) => setBanca(e.target.value)}
          placeholder="Nome della banca"
        />
      </Field>
      <Field>
        <Label htmlFor="intestatario_conto">Intestatario conto</Label>
        <Input
          id="intestatario_conto"
          value={intestatario}
          onChange={(e) => setIntestatario(e.target.value)}
          placeholder="Es. Condominio Via Roma 12"
        />
      </Field>

      {errore && <p className="text-sm text-danger">{errore}</p>}

      <div className="flex gap-3">
        <Button type="button" pending={pending} onClick={salva}>
          Salva conto corrente
        </Button>
        {condominio.iban && (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              setIban(condominio.iban ?? "");
              setBanca(condominio.banca ?? "");
              setIntestatario(condominio.intestatario_conto ?? "");
              setErrore(null);
              setModifica(false);
            }}
          >
            Annulla
          </Button>
        )}
      </div>
    </div>
  );
}

function RigaConto({
  etichetta,
  valore,
  mono,
}: {
  etichetta: string;
  valore: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{etichetta}</dt>
      <dd className={mono ? "font-mono text-xs font-medium" : "font-medium"}>{valore}</dd>
    </div>
  );
}
