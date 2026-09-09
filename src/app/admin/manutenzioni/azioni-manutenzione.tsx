"use client";

import { useState, useTransition } from "react";
import { Check, Trash2, X } from "lucide-react";
import {
  annullaManutenzione,
  completaManutenzione,
  eliminaManutenzione,
} from "./actions";
import { ETICHETTE_PERIODICITA, prossimaScadenza } from "@/lib/manutenzioni";
import { formatData } from "@/lib/format";
import type { Periodicita, StatoManutenzione } from "@/lib/types";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Azioni su una riga dello scadenzario.
 *
 * "Eseguita" chiede la data effettiva perché quasi mai coincide con quella
 * prevista, e mostra in anticipo quale sarà la prossima scadenza: chi spunta
 * deve poter vedere subito che cosa sta creando.
 */
export function AzioniManutenzione({
  id,
  titolo,
  stato,
  periodicita,
  dataProssima,
}: {
  id: string;
  titolo: string;
  stato: StatoManutenzione;
  periodicita: Periodicita;
  dataProssima: string;
}) {
  const [conferma, setConferma] = useState<"completa" | "annulla" | "elimina" | null>(null);
  const [dataEsecuzione, setDataEsecuzione] = useState(() => new Date().toISOString().slice(0, 10));
  const [errore, setErrore] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const prossima = prossimaScadenza(dataProssima, periodicita);

  function esegui(azione: () => Promise<{ errore?: string }>) {
    setErrore(null);
    startTransition(async () => {
      const esito = await azione();
      if (esito?.errore) {
        setErrore(esito.errore);
        return;
      }
      setConferma(null);
    });
  }

  return (
    <span className="flex items-center justify-end gap-1">
      {stato === "programmata" && (
        <>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={() => {
              setErrore(null);
              setDataEsecuzione(new Date().toISOString().slice(0, 10));
              setConferma("completa");
            }}
            aria-label={`Segna "${titolo}" come eseguita`}
            title="Segna come eseguita"
          >
            <Check className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={() => {
              setErrore(null);
              setConferma("annulla");
            }}
            aria-label={`Annulla "${titolo}"`}
            title="Annulla"
          >
            <X className="size-4" />
          </Button>
        </>
      )}
      <Button
        variant="ghost-danger"
        size="sm"
        iconOnly
        onClick={() => {
          setErrore(null);
          setConferma("elimina");
        }}
        aria-label={`Elimina "${titolo}"`}
        title="Elimina"
      >
        <Trash2 className="size-4" />
      </Button>

      <Dialog
        aperto={conferma === "completa"}
        onChiudi={() => setConferma(null)}
        bloccato={pending}
        titolo="Intervento eseguito"
        descrizione={titolo}
        footer={
          <>
            <Button variant="ghost" disabled={pending} onClick={() => setConferma(null)}>
              Annulla
            </Button>
            <Button
              pending={pending}
              onClick={() => esegui(() => completaManutenzione(id, dataEsecuzione))}
            >
              Segna come eseguita
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field
            id={`esecuzione_${id}`}
            label="Data di esecuzione"
            hint="Quando l'intervento è stato fatto davvero."
          >
            <Input
              type="date"
              value={dataEsecuzione}
              onChange={(e) => setDataEsecuzione(e.target.value)}
            />
          </Field>

          <p className="text-sm leading-relaxed text-muted-foreground">
            {prossima ? (
              <>
                La manutenzione è {ETICHETTE_PERIODICITA[periodicita].toLowerCase()}: verrà
                programmata automaticamente la successiva per il{" "}
                <strong className="font-medium text-foreground">{formatData(prossima)}</strong>,
                contata dalla scadenza prevista ({formatData(dataProssima)}) e non dal giorno in
                cui l&apos;intervento è stato eseguito.
              </>
            ) : (
              "È un intervento una tantum: non verrà programmata nessuna scadenza successiva."
            )}
          </p>

          <FormError>{errore}</FormError>
        </div>
      </Dialog>

      <Dialog
        aperto={conferma === "annulla"}
        onChiudi={() => setConferma(null)}
        bloccato={pending}
        titolo="Annullare la scadenza?"
        descrizione={titolo}
        footer={
          <>
            <Button variant="ghost" disabled={pending} onClick={() => setConferma(null)}>
              Torna indietro
            </Button>
            <Button pending={pending} onClick={() => esegui(() => annullaManutenzione(id))}>
              Annulla la scadenza
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          Resta nello storico come annullata e non produce una scadenza successiva. Se invece
          l&apos;intervento è stato fatto, usa &laquo;Segna come eseguita&raquo;.
        </p>
        <FormError className="mt-3">{errore}</FormError>
      </Dialog>

      <Dialog
        aperto={conferma === "elimina"}
        onChiudi={() => setConferma(null)}
        bloccato={pending}
        titolo="Eliminare la manutenzione?"
        descrizione={titolo}
        footer={
          <>
            <Button variant="ghost" disabled={pending} onClick={() => setConferma(null)}>
              Annulla
            </Button>
            <Button
              variant="danger"
              pending={pending}
              onClick={() => esegui(() => eliminaManutenzione(id))}
            >
              Elimina
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          Sparisce dallo scadenzario e dallo storico. Per conservare la traccia conviene
          annullarla invece di eliminarla.
        </p>
        <FormError className="mt-3">{errore}</FormError>
      </Dialog>
    </span>
  );
}
