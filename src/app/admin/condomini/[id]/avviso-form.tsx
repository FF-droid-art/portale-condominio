"use client";

import { useState, useTransition } from "react";
import { Mail, Send } from "lucide-react";
import { inviaAvviso } from "../actions";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Alert, FormError, FormSuccess } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Invio di un avviso via email a tutti i soggetti di un condominio.
 *
 * Il numero di destinatari è scritto sul pulsante di invio: chi preme sa
 * esattamente quante persone riceveranno il messaggio, e senza destinatari
 * il pulsante resta disabilitato con la spiegazione del perché.
 */
export function AvvisoForm({
  condominioId,
  destinatari,
}: {
  condominioId: string;
  destinatari: number;
}) {
  const [aperto, setAperto] = useState(false);
  const [oggetto, setOggetto] = useState("");
  const [messaggio, setMessaggio] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [successo, setSuccesso] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function apri() {
    setErrore(null);
    setSuccesso(null);
    setAperto(true);
  }

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
    <>
      <Button onClick={apri}>
        <Mail className="size-4" aria-hidden="true" />
        Invia avviso
      </Button>

      <Dialog
        aperto={aperto}
        onChiudi={() => setAperto(false)}
        bloccato={pending}
        titolo="Avviso ai condòmini"
        descrizione="Un'email a tutti i soggetti delle unità di questo condominio che hanno un indirizzo in anagrafica."
        larghezza="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            invia();
          }}
          className="flex flex-col gap-4"
        >
          {destinatari === 0 && (
            <Alert tono="warning" titolo="Nessun destinatario">
              Nessuna persona di questo condominio ha un indirizzo email in
              anagrafica. Aggiungine uno dalla scheda di un&apos;unità per poter
              inviare avvisi.
            </Alert>
          )}

          <Field id="avviso_oggetto" label="Oggetto" required>
            <Input
              value={oggetto}
              onChange={(e) => setOggetto(e.target.value)}
              placeholder="Es. Convocazione assemblea ordinaria"
              required
              disabled={destinatari === 0}
            />
          </Field>

          <Field
            id="avviso_messaggio"
            label="Messaggio"
            required
            hint="Testo semplice: gli a capo vengono mantenuti nell'email."
          >
            <Textarea
              rows={7}
              value={messaggio}
              onChange={(e) => setMessaggio(e.target.value)}
              required
              disabled={destinatari === 0}
            />
          </Field>

          <FormError>{errore}</FormError>
          <FormSuccess>{successo}</FormSuccess>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => setAperto(false)}
            >
              Chiudi
            </Button>
            <Button type="submit" pending={pending} disabled={pending || destinatari === 0}>
              <Send className="size-4" aria-hidden="true" />
              {destinatari > 0
                ? `Invia a ${destinatari} ${destinatari === 1 ? "destinatario" : "destinatari"}`
                : "Nessun destinatario"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
