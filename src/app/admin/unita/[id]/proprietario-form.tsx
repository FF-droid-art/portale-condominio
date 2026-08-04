"use client";

import { useState, useTransition } from "react";
import { aggiungiSoggetto } from "./actions";
import { haQuota } from "@/lib/ruoli";
import { Card } from "@/components/ui/card";
import { Field, Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const OPZIONI_TIPO_SOGGETTO: { value: string; label: string }[] = [
  { value: "proprietario", label: "Proprietario" },
  { value: "nudo_proprietario", label: "Nudo proprietario" },
  { value: "usufruttuario", label: "Usufruttuario" },
  { value: "conduttore", label: "Conduttore" },
  { value: "comodatario", label: "Comodatario" },
  { value: "assegnatario", label: "Assegnatario" },
];

type Esistente = { id: string; nominativo: string; email: string | null };

export function ProprietarioForm({
  unitaId,
  condominioId,
}: {
  unitaId: string;
  condominioId: string;
}) {
  const [nominativo, setNominativo] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [tipoSoggetto, setTipoSoggetto] = useState("proprietario");
  const [quota, setQuota] = useState("100");
  const [dirittoVoto, setDirittoVoto] = useState(true);

  const [errore, setErrore] = useState<string | null>(null);
  const [conferma, setConferma] = useState<Esistente | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setNominativo("");
    setEmail("");
    setTelefono("");
    setTipoSoggetto("proprietario");
    setQuota("100");
    setDirittoVoto(true);
  }

  function invia(opts: { riusaId?: string; forzaNuovo?: boolean }) {
    setErrore(null);
    startTransition(async () => {
      const res = await aggiungiSoggetto({
        unitaId,
        condominioId,
        nominativo,
        email,
        telefono: telefono.trim() || null,
        tipoSoggetto,
        quota: Number(quota),
        dirittoVoto,
        riusaId: opts.riusaId,
        forzaNuovo: opts.forzaNuovo,
      });

      if ("needsConfirm" in res) {
        setConferma(res.esistente);
        return;
      }
      if ("errore" in res) {
        setErrore(res.errore);
        setConferma(null);
        return;
      }
      // successo
      setConferma(null);
      reset();
    });
  }

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          invia({});
        }}
        className="flex flex-col gap-3"
      >
        <Field>
          <Label htmlFor="nominativo">Nome / Denominazione</Label>
          <Input
            id="nominativo"
            value={nominativo}
            onChange={(e) => setNominativo(e.target.value)}
            required
          />
        </Field>

        <Field>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>

        <Field>
          <Label htmlFor="telefono">Telefono (opzionale)</Label>
          <Input
            id="telefono"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
          />
        </Field>

        <Field>
          <Label htmlFor="tipo_soggetto">Ruolo</Label>
          <Select
            id="tipo_soggetto"
            value={tipoSoggetto}
            onChange={(e) => setTipoSoggetto(e.target.value)}
          >
            {OPZIONI_TIPO_SOGGETTO.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>

        {haQuota(tipoSoggetto) && (
          <Field>
            <Label htmlFor="quota_possesso">Quota di possesso (%)</Label>
            <Input
              id="quota_possesso"
              type="number"
              step="0.01"
              min="0.01"
              max="100"
              value={quota}
              onChange={(e) => setQuota(e.target.value)}
              required
            />
          </Field>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={dirittoVoto}
            onChange={(e) => setDirittoVoto(e.target.checked)}
            className="size-4"
          />
          Ha diritto di voto in assemblea
        </label>

        {errore && <p className="text-sm text-danger">{errore}</p>}

        <Button type="submit" pending={pending} disabled={pending}>
          Aggiungi soggetto
        </Button>
      </form>

      {conferma && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !pending && setConferma(null)}
        >
          <Card
            className="w-full max-w-sm gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm">
              In questo condominio esiste già{" "}
              <span className="font-semibold">{conferma.nominativo}</span>
              {conferma.email ? ` (${conferma.email})` : ""}. È la stessa persona?
            </p>
            <div className="flex gap-3">
              <Button
                type="button"
                pending={pending}
                onClick={() => invia({ riusaId: conferma.id })}
              >
                Sì, è la stessa
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => invia({ forzaNuovo: true })}
              >
                No, è un&apos;altra
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
