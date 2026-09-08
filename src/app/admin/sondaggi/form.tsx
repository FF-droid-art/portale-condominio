"use client";

import { useActionState, useState } from "react";
import { Plus, X } from "lucide-react";
import { creaSondaggio } from "./actions";
import { MAX_OPZIONI_SONDAGGIO } from "@/lib/sondaggi";
import { useAlSuccesso } from "@/lib/hooks";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import { Alert, FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const OPZIONI_INIZIALI = ["", ""];

export function SondaggioForm({ condomini }: { condomini: { id: string; nome: string }[] }) {
  const [aperto, setAperto] = useState(false);
  const [opzioni, setOpzioni] = useState<string[]>(OPZIONI_INIZIALI);
  const [stato, action, pending] = useActionState(creaSondaggio, undefined);

  useAlSuccesso(pending, stato, () => {
    setAperto(false);
    setOpzioni(OPZIONI_INIZIALI);
  });

  const senzaCondomini = condomini.length === 0;

  return (
    <>
      <Button onClick={() => setAperto(true)} disabled={senzaCondomini}>
        <Plus className="size-4" aria-hidden="true" />
        Nuovo sondaggio
      </Button>

      <Dialog
        aperto={aperto}
        onChiudi={() => setAperto(false)}
        bloccato={pending}
        titolo="Nuovo sondaggio"
        descrizione="Una consultazione informale, fuori assemblea: non delibera nulla, serve a capire come la pensano i condòmini."
        larghezza="md"
      >
        <form action={action} className="flex flex-col gap-4">
          {senzaCondomini && (
            <Alert tono="warning" titolo="Nessun condominio disponibile">
              Crea prima un condominio: un sondaggio si rivolge sempre ai condòmini di uno di essi.
            </Alert>
          )}

          <Field id="condominio_id" label="Condominio" required>
            <Select name="condominio_id" required defaultValue="">
              <option value="" disabled>
                Seleziona condominio
              </option>
              {condomini.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          </Field>

          <Field id="domanda" label="Domanda" required>
            <Input
              name="domanda"
              placeholder="Es. Preferite la tinteggiatura chiara o scura per l'androne?"
              required
            />
          </Field>

          <Field id="descrizione" label="Dettagli" hint="Facoltativo: contesto, preventivi, tempi.">
            <Textarea name="descrizione" rows={3} />
          </Field>

          <div className="flex flex-col gap-2">
            <Label>Opzioni di risposta</Label>
            {opzioni.map((valore, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  name="opzione"
                  aria-label={`Opzione ${i + 1}`}
                  placeholder={`Opzione ${i + 1}`}
                  value={valore}
                  onChange={(e) =>
                    setOpzioni((prec) => prec.map((v, j) => (j === i ? e.target.value : v)))
                  }
                />
                {opzioni.length > 2 && (
                  <Button
                    type="button"
                    variant="ghost-danger"
                    size="sm"
                    iconOnly
                    aria-label={`Rimuovi opzione ${i + 1}`}
                    onClick={() => setOpzioni((prec) => prec.filter((_, j) => j !== i))}
                  >
                    <X className="size-4" />
                  </Button>
                )}
              </div>
            ))}
            {opzioni.length < MAX_OPZIONI_SONDAGGIO && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="w-fit"
                onClick={() => setOpzioni((prec) => [...prec, ""])}
              >
                <Plus className="size-4" aria-hidden="true" />
                Aggiungi opzione
              </Button>
            )}
          </div>

          <Field
            id="scadenza"
            label="Scadenza"
            hint="Facoltativa: dopo questa data e ora il sondaggio si chiude da solo."
          >
            <Input name="scadenza" type="datetime-local" />
          </Field>

          <label className="flex items-start gap-2.5 text-sm">
            <Checkbox name="ponderato" className="mt-0.5" />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">Leggi il risultato pesato per millesimi</span>
              <span className="text-xs text-muted-foreground">
                L&apos;opzione in testa è quella con più millesimi invece che con più risposte,
                come nelle votazioni assembleari. Entrambi i conteggi restano comunque visibili.
              </span>
            </span>
          </label>

          <FormError>{stato?.errore}</FormError>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setAperto(false)}>
              Annulla
            </Button>
            <Button type="submit" pending={pending} disabled={senzaCondomini}>
              {pending ? "Creazione…" : "Crea sondaggio"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
