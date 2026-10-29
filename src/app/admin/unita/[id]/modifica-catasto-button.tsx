"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { aggiornaDatiCatastali } from "./actions";
import { formatDatiCatastali } from "@/lib/anagrafe";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormGrid, Input } from "@/components/ui/input";
import { FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Dati catastali dell'unità (art. 1130, n. 6, c.c.).
 *
 * Si modificano direttamente dalla riga che li mostra, come i millesimi:
 * sono quattro valori che si ricopiano da una visura in un colpo solo e
 * non meritano una pagina a parte. Tutti facoltativi, perché un'unità
 * esiste nel portale molto prima che se ne abbia la visura.
 */
export function ModificaCatastoButton({
  unitaId,
  condominioId,
  identificativo,
  foglio,
  particella,
  subalterno,
  categoria,
}: {
  unitaId: string;
  condominioId: string;
  identificativo: string;
  foglio: string | null;
  particella: string | null;
  subalterno: string | null;
  categoria: string | null;
}) {
  const [aperto, setAperto] = useState(false);
  const [fg, setFg] = useState(foglio ?? "");
  const [part, setPart] = useState(particella ?? "");
  const [sub, setSub] = useState(subalterno ?? "");
  const [cat, setCat] = useState(categoria ?? "");
  const [errore, setErrore] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const riga = formatDatiCatastali({ foglio, particella, subalterno, categoria });

  function apri() {
    setFg(foglio ?? "");
    setPart(particella ?? "");
    setSub(subalterno ?? "");
    setCat(categoria ?? "");
    setErrore(null);
    setAperto(true);
  }

  function salva() {
    setErrore(null);
    startTransition(async () => {
      const res = await aggiornaDatiCatastali({
        unitaId,
        condominioId,
        foglio: fg.trim() || null,
        particella: part.trim() || null,
        subalterno: sub.trim() || null,
        categoria: cat.trim() || null,
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
        aria-label={`Modifica i dati catastali di ${identificativo}`}
        title="Modifica i dati catastali"
        className="group inline-flex items-center gap-1.5 rounded-md text-left transition-colors hover:text-accent-ink"
      >
        <span className={riga ? "font-medium" : "text-muted-foreground"}>
          {riga ?? "Da inserire"}
        </span>
        <Pencil
          className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-accent-ink"
          aria-hidden="true"
        />
      </button>

      <Dialog
        aperto={aperto}
        onChiudi={() => setAperto(false)}
        bloccato={pending}
        titolo={`Dati catastali di ${identificativo}`}
        descrizione="Come riportati in visura. Fanno parte del registro di anagrafe condominiale e si possono completare in un secondo momento."
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
            <Field id="catasto_foglio" label="Foglio">
              <Input
                value={fg}
                onChange={(e) => setFg(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="12"
                className="cifre"
              />
            </Field>
            <Field id="catasto_particella" label="Particella (mappale)">
              <Input
                value={part}
                onChange={(e) => setPart(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="345"
                className="cifre"
              />
            </Field>
          </FormGrid>

          <FormGrid colonne={2}>
            <Field
              id="catasto_subalterno"
              label="Subalterno"
              hint="Si scrive come in visura, zeri iniziali compresi."
            >
              <Input
                value={sub}
                onChange={(e) => setSub(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="007"
                className="cifre"
              />
            </Field>
            <Field id="catasto_categoria" label="Categoria" hint="Es. A/2, A/10, C/6.">
              <Input
                value={cat}
                onChange={(e) => setCat(e.target.value.toUpperCase())}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="A/2"
              />
            </Field>
          </FormGrid>

          <FormError>{errore}</FormError>
          <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
            Salva
          </button>
        </form>
      </Dialog>
    </>
  );
}
