"use client";

import { useState, useTransition } from "react";
import { inviaAvviso } from "../actions";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function AvvisoForm({
  condominioId,
  destinatari,
}: {
  condominioId: string;
  destinatari: number;
}) {
  const [oggetto, setOggetto] = useState("");
  const [messaggio, setMessaggio] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [successo, setSuccesso] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function invia() {
    setErrore(null);
    setSuccesso(null);
    startTransition(async () => {
      const res = await inviaAvviso({ condominioId, oggetto, messaggio });
      if ("errore" in res) {
        setErrore(res.errore);
        return;
      }
      setSuccesso(res.nota ?? `Avviso inviato a ${res.destinatari} destinatari.`);
      setOggetto("");
      setMessaggio("");
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        invia();
      }}
      className="flex flex-col gap-3"
    >
      <p className="text-sm text-muted-foreground">
        Invia un&apos;email a tutti i soggetti delle unità di questo condominio.
      </p>
      <Field>
        <Label htmlFor="avviso_oggetto">Oggetto</Label>
        <Input
          id="avviso_oggetto"
          value={oggetto}
          onChange={(e) => setOggetto(e.target.value)}
          required
        />
      </Field>
      <Field>
        <Label htmlFor="avviso_messaggio">Messaggio</Label>
        <Textarea
          id="avviso_messaggio"
          rows={4}
          value={messaggio}
          onChange={(e) => setMessaggio(e.target.value)}
          required
        />
      </Field>
      {errore && <p className="text-sm text-danger">{errore}</p>}
      {successo && <p className="text-sm text-success">{successo}</p>}
      <Button type="submit" pending={pending} disabled={pending || destinatari === 0}>
        {destinatari > 0
          ? `Invia avviso a ${destinatari} destinatari`
          : "Nessun destinatario con email"}
      </Button>
    </form>
  );
}
