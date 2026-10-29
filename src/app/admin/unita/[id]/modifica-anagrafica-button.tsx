"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { aggiornaDatiAnagrafici } from "./actions";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormGrid, Input, Textarea } from "@/components/ui/input";
import { FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Dati di anagrafe di una persona del condominio: contatti più i dati
 * che l'art. 1130, n. 6, c.c. richiede per il registro (codice fiscale,
 * residenza o domicilio).
 *
 * Nessuno dei campi di registro è obbligatorio: si raccolgono mano a
 * mano che la persona li comunica, e un modulo che li pretendesse tutti
 * impedirebbe anche solo di correggere un'email.
 */
export function ModificaAnagraficaButton({
  anagraficaId,
  unitaId,
  nominativo,
  email,
  telefono,
  codiceFiscale,
  residenzaDomicilio,
}: {
  anagraficaId: string;
  unitaId: string;
  nominativo: string;
  email: string | null;
  telefono: string | null;
  codiceFiscale: string | null;
  residenzaDomicilio: string | null;
}) {
  const [aperto, setAperto] = useState(false);
  const [em, setEm] = useState(email ?? "");
  const [tel, setTel] = useState(telefono ?? "");
  const [cf, setCf] = useState(codiceFiscale ?? "");
  const [residenza, setResidenza] = useState(residenzaDomicilio ?? "");
  const [errore, setErrore] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function apri() {
    setEm(email ?? "");
    setTel(telefono ?? "");
    setCf(codiceFiscale ?? "");
    setResidenza(residenzaDomicilio ?? "");
    setErrore(null);
    setAperto(true);
  }

  function salva() {
    setErrore(null);
    startTransition(async () => {
      const res = await aggiornaDatiAnagrafici({
        anagraficaId,
        unitaId,
        email: em,
        telefono: tel.trim() || null,
        codiceFiscale: cf.trim() || null,
        residenzaDomicilio: residenza.trim() || null,
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
        aria-label={`Modifica i dati di anagrafe di ${nominativo}`}
        title="Modifica i dati di anagrafe"
      >
        <Pencil className="size-4" />
      </Button>

      <Dialog
        aperto={aperto}
        onChiudi={() => setAperto(false)}
        bloccato={pending}
        titolo={`Dati di ${nominativo}`}
        descrizione="Codice fiscale e residenza compongono il registro di anagrafe condominiale; l'email è quella a cui arrivano gli avvisi."
        larghezza="md"
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
          <FormGrid colonne={2}>
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
          </FormGrid>

          <Field
            id="anagrafica_codice_fiscale"
            label="Codice fiscale"
            hint="Facoltativo. 16 caratteri per una persona, 11 cifre per una società."
          >
            <Input
              value={cf}
              onChange={(e) => setCf(e.target.value.toUpperCase())}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={16}
              placeholder="RSSMRA80A01H501U"
              className="cifre"
            />
          </Field>

          <Field
            id="anagrafica_residenza"
            label="Residenza o domicilio"
            hint="Facoltativa. Via, numero civico, CAP, comune e provincia."
          >
            <Textarea
              rows={2}
              value={residenza}
              onChange={(e) => setResidenza(e.target.value)}
              placeholder="Via Roma 1, 00100 Roma (RM)"
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
