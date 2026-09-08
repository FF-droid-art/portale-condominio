"use client";

import { useState, useTransition } from "react";
import { rispondiSondaggio } from "../actions";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/alert";
import { formatMillesimi } from "@/lib/format";
import { cn } from "@/lib/cn";

export type UnitaRispondente = {
  id: string;
  identificativo: string;
  millesimi: number;
  /** Opzione già scelta per questa unità, se c'è. */
  opzioneScelta: string | null;
};

/**
 * Una scheda di risposta per ogni unità posseduta: come nel voto assembleare
 * la risposta appartiene all'unità, non alla persona, così chi possiede due
 * appartamenti pesa per entrambi ed è chiaro per quale sta rispondendo.
 */
export function RispostaForm({
  sondaggioId,
  unita,
  opzioni,
  mostraIdentificativo,
}: {
  sondaggioId: string;
  unita: UnitaRispondente;
  opzioni: { id: string; testo: string }[];
  /** Con una sola unità l'intestazione è rumore. */
  mostraIdentificativo: boolean;
}) {
  const [scelta, setScelta] = useState(unita.opzioneScelta ?? "");
  const [errore, setErrore] = useState<string | undefined>();
  const [inCorso, startTransition] = useTransition();

  const invariato = scelta === (unita.opzioneScelta ?? "");

  function salva() {
    setErrore(undefined);
    startTransition(async () => {
      const esito = await rispondiSondaggio({
        sondaggioId,
        opzioneId: scelta,
        unitaId: unita.id,
      });
      if (esito?.errore) setErrore(esito.errore);
    });
  }

  const nomeGruppo = `sondaggio-${sondaggioId}-${unita.id}`;

  return (
    <div className="flex flex-col gap-3">
      {mostraIdentificativo && (
        <p className="text-sm font-medium">
          {unita.identificativo}{" "}
          <span className="cifre font-normal text-muted-foreground">
            · {formatMillesimi(unita.millesimi)} millesimi
          </span>
        </p>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Scegli una risposta per {unita.identificativo}</legend>
        {opzioni.map((o) => (
          <label
            key={o.id}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors",
              scelta === o.id
                ? "border-accent bg-accent-subtle font-medium text-accent-ink"
                : "border-border hover:bg-surface-muted"
            )}
          >
            <input
              type="radio"
              name={nomeGruppo}
              value={o.id}
              checked={scelta === o.id}
              onChange={() => setScelta(o.id)}
              className="size-4 shrink-0 accent-accent"
            />
            <span className="min-w-0">{o.testo}</span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={salva} pending={inCorso} disabled={!scelta || invariato}>
          {unita.opzioneScelta ? "Aggiorna la risposta" : "Invia la risposta"}
        </Button>
        {unita.opzioneScelta && invariato && (
          <span className="text-xs text-muted-foreground">
            Puoi cambiare idea finché il sondaggio è aperto.
          </span>
        )}
      </div>

      <FormError>{errore}</FormError>
    </div>
  );
}
