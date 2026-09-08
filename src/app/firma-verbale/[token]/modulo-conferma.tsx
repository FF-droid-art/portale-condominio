"use client";

import { useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { confermaFirma, richiediCodice } from "./actions";
import { Field, Input } from "@/components/ui/input";
import { Alert, FormError, FormSuccess } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { OTP_VALIDITA_MINUTI } from "@/lib/firma-otp";

/**
 * Due passi espliciti — "mandami il codice", poi "ecco il codice" — invece di
 * spedire il codice insieme al collegamento: il link identifica la persona, il
 * codice dimostra che ha accesso alla casella indicata dall'amministratore.
 */
export function ModuloConferma({
  token,
  codiceGiaRichiesto,
}: {
  token: string;
  codiceGiaRichiesto: boolean;
}) {
  const [inviato, setInviato] = useState(codiceGiaRichiesto);
  const [messaggio, setMessaggio] = useState<string | undefined>();
  const [errore, setErrore] = useState<string | undefined>();
  const [codice, setCodice] = useState("");
  const [inCorso, startTransition] = useTransition();

  function chiediCodice() {
    setErrore(undefined);
    setMessaggio(undefined);
    startTransition(async () => {
      const esito = await richiediCodice(token);
      if (esito.errore) setErrore(esito.errore);
      else {
        setInviato(true);
        setMessaggio(esito.messaggio);
      }
    });
  }

  function conferma(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrore(undefined);
    setMessaggio(undefined);
    startTransition(async () => {
      const esito = await confermaFirma(token, codice);
      if (esito.errore) setErrore(esito.errore);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <Button onClick={chiediCodice} pending={inCorso} variant={inviato ? "secondary" : "primary"} full>
        <Mail className="size-4" aria-hidden="true" />
        {inviato ? "Invia di nuovo il codice" : "Inviami il codice via email"}
      </Button>

      {inviato && (
        <form onSubmit={conferma} className="flex flex-col gap-4">
          <Field
            id="codice"
            label="Codice ricevuto per email"
            hint={`Sei cifre, valide ${OTP_VALIDITA_MINUTI} minuti.`}
          >
            <Input
              name="codice"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              placeholder="000000"
              className="cifre tracking-[0.4em]"
              value={codice}
              onChange={(e) => setCodice(e.target.value)}
              required
            />
          </Field>
          <Button type="submit" pending={inCorso} full>
            Conferma il verbale
          </Button>
        </form>
      )}

      <FormSuccess>{messaggio}</FormSuccess>
      <FormError>{errore}</FormError>

      {!inviato && (
        <Alert tono="info">
          Il codice arriva all&apos;indirizzo email indicato dall&apos;amministratore: non viene
          mostrato qui né inviato insieme a questo collegamento.
        </Alert>
      )}
    </div>
  );
}
