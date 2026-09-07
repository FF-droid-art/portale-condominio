"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { aggiornaContoCorrente } from "./actions";
import { Field, Input } from "@/components/ui/input";
import { FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { Condominio } from "@/lib/types";

/**
 * Coordinate bancarie del condominio.
 *
 * Finché un conto è già salvato la scheda mostra un riepilogo in sola
 * lettura — è così che si usa nove volte su dieci — e passa ai campi
 * modificabili solo su richiesta.
 */
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
      <div className="flex flex-col gap-4">
        <dl className="flex flex-col divide-y divide-border text-sm">
          <RigaConto etichetta="IBAN" valore={iban} mono />
          {banca.trim() && <RigaConto etichetta="Banca" valore={banca} />}
          {intestatario.trim() && <RigaConto etichetta="Intestatario" valore={intestatario} />}
        </dl>
        <Button variant="secondary" size="sm" className="w-fit" onClick={() => setModifica(true)}>
          <Pencil className="size-4" aria-hidden="true" />
          Modifica
        </Button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        salva();
      }}
    >
      <Field id="cc_iban" label="IBAN">
        <Input
          value={iban}
          onChange={(e) => setIban(e.target.value)}
          placeholder="IT00 X000 0000 0000 0000 0000 000"
          autoCapitalize="characters"
          spellCheck={false}
          className="font-mono"
        />
      </Field>
      <Field id="cc_banca" label="Banca">
        <Input
          value={banca}
          onChange={(e) => setBanca(e.target.value)}
          placeholder="Nome della banca"
        />
      </Field>
      <Field id="cc_intestatario" label="Intestatario del conto">
        <Input
          value={intestatario}
          onChange={(e) => setIntestatario(e.target.value)}
          placeholder="Es. Condominio Via Roma 12"
        />
      </Field>

      <FormError>{errore}</FormError>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" pending={pending}>
          Salva conto corrente
        </Button>
        {condominio.iban && (
          <Button
            type="button"
            variant="ghost"
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
    </form>
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
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 first:pt-0 last:pb-0">
      <dt className="text-muted-foreground">{etichetta}</dt>
      <dd className={mono ? "break-all font-mono text-xs font-medium" : "font-medium"}>
        {valore}
      </dd>
    </div>
  );
}
