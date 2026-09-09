"use client";

import { useState, useTransition } from "react";
import { Check, EyeOff, Link2, Undo2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/input";
import { FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatValuta } from "@/lib/format";
import {
  annullaAbbinamento,
  confermaAbbinamento,
  ignoraMovimento,
  riprendiMovimento,
} from "./actions";

export type QuotaSelezionabile = {
  id: string;
  etichetta: string;
  importo: number;
};

/**
 * Conferma la proposta del portale con un clic solo.
 *
 * Il pulsante è separato dall'abbinamento manuale apposta: la proposta è già
 * decisa, e chiederne di nuovo la conferma dentro una finestra modale
 * rallenterebbe l'unica operazione che si ripete decine di volte.
 */
export function ConfermaAbbinamentoButton({
  movimentoId,
  ripartizioneId,
  descrizione,
}: {
  movimentoId: string;
  ripartizioneId: string;
  descrizione: string;
}) {
  const [errore, setErrore] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <span className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        pending={pending}
        onClick={() =>
          startTransition(async () => {
            const esito = await confermaAbbinamento(movimentoId, ripartizioneId);
            setErrore(esito.errore ?? null);
          })
        }
        title={`Segna come pagata: ${descrizione}`}
      >
        <Check className="size-4" aria-hidden="true" />
        Conferma
      </Button>
      <FormError>{errore}</FormError>
    </span>
  );
}

/** Sceglie a mano la quota che un movimento salda. */
export function AbbinaManualmenteButton({
  movimentoId,
  importoMovimento,
  quote,
}: {
  movimentoId: string;
  importoMovimento: number;
  quote: QuotaSelezionabile[];
}) {
  const [aperto, setAperto] = useState(false);
  const [scelta, setScelta] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const quotaScelta = quote.find((q) => q.id === scelta);
  const differenza = quotaScelta ? importoMovimento - quotaScelta.importo : 0;

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          setScelta("");
          setErrore(null);
          setAperto(true);
        }}
        disabled={quote.length === 0}
        title={quote.length === 0 ? "Nessuna quota aperta in questo condominio" : undefined}
      >
        <Link2 className="size-4" aria-hidden="true" />
        Abbina
      </Button>

      <Dialog
        aperto={aperto}
        onChiudi={() => setAperto(false)}
        bloccato={pending}
        titolo="Abbina il movimento a una quota"
        descrizione={`Accredito di ${formatValuta(importoMovimento)}. La quota risulterà pagata alla data del movimento.`}
        larghezza="md"
      >
        <div className="flex flex-col gap-4">
          <Field
            id="abbina_quota"
            label="Quota da saldare"
            hint="Sono elencate tutte le quote ancora aperte del condominio, anche quelle di importo diverso."
            required
          >
            <Select value={scelta} onChange={(e) => setScelta(e.target.value)}>
              <option value="" disabled>
                Seleziona una quota
              </option>
              {quote.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.etichetta}
                </option>
              ))}
            </Select>
          </Field>

          {quotaScelta && differenza !== 0 && (
            <p className="text-sm text-warning">
              Attenzione: l&apos;accredito e la quota non coincidono
              {differenza > 0
                ? ` (${formatValuta(differenza)} in più)`
                : ` (${formatValuta(-differenza)} in meno)`}
              . La quota verrà comunque segnata come pagata per intero.
            </p>
          )}

          <FormError>{errore}</FormError>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" disabled={pending} onClick={() => setAperto(false)}>
              Annulla
            </Button>
            <Button
              pending={pending}
              disabled={!scelta}
              onClick={() =>
                startTransition(async () => {
                  const esito = await confermaAbbinamento(movimentoId, scelta);
                  if (esito.errore) {
                    setErrore(esito.errore);
                    return;
                  }
                  setAperto(false);
                })
              }
            >
              Abbina
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

/** Mette da parte un movimento che non riguarda le quote. */
export function IgnoraMovimentoButton({ movimentoId }: { movimentoId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      iconOnly
      pending={pending}
      aria-label="Metti da parte questo movimento"
      title="Non riguarda le quote"
      onClick={() => startTransition(() => ignoraMovimento(movimentoId).then(() => undefined))}
    >
      <EyeOff className="size-4" />
    </Button>
  );
}

/** Rimette in coda un movimento messo da parte o abbinato per sbaglio. */
export function RipristinaMovimentoButton({
  movimentoId,
  abbinato,
}: {
  movimentoId: string;
  abbinato: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      pending={pending}
      onClick={() =>
        startTransition(() =>
          (abbinato ? annullaAbbinamento(movimentoId) : riprendiMovimento(movimentoId)).then(
            () => undefined
          )
        )
      }
      title={
        abbinato
          ? "La quota torna da pagare e il movimento torna in coda"
          : "Rimetti il movimento tra quelli da abbinare"
      }
    >
      <Undo2 className="size-4" aria-hidden="true" />
      {abbinato ? "Sgancia" : "Riprendi"}
    </Button>
  );
}
