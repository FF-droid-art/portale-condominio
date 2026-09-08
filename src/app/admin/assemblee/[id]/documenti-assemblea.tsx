"use client";

import { useState, useTransition } from "react";
import { FileDown, FileText, Sparkles } from "lucide-react";
import { generaESalvaVerbale } from "./actions";
import { Card, CardHeader, CardHeaderText, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, ButtonGroup } from "@/components/ui/button";
import { FormError } from "@/components/ui/alert";

/**
 * Bozze generate dai dati del portale.
 *
 * Fino a ieri l'unico modo di avere convocazione e verbale era caricare un PDF
 * preparato altrove. Qui il documento nasce dai dati già inseriti (ordine del
 * giorno, presenze, deleghe, voti, quorum): l'amministratore lo scarica, lo
 * rifinisce se serve e può comunque sostituirlo con un file proprio dal
 * riquadro "Verbale".
 */
export function DocumentiAssemblea({ assembleaId }: { assembleaId: string }) {
  const [errore, setErrore] = useState<string | undefined>();
  const [inCorso, startTransition] = useTransition();

  function salvaVerbale() {
    setErrore(undefined);
    startTransition(async () => {
      const esito = await generaESalvaVerbale(assembleaId);
      if (esito?.errore) setErrore(esito.errore);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardHeaderText>
          <CardTitle>Documenti generati</CardTitle>
          <CardDescription>
            Bozze costruite dai dati di questa assemblea. Vanno rilette prima
            dell&apos;invio: non sostituiscono la redazione dell&apos;amministratore.
          </CardDescription>
        </CardHeaderText>
      </CardHeader>

      <div className="flex flex-col gap-3">
        <ButtonGroup>
          <Button
            href={`/admin/assemblee/${assembleaId}/documenti?tipo=convocazione`}
            target="_blank"
            rel="noopener noreferrer"
            variant="secondary"
            size="sm"
          >
            <FileText className="size-4" aria-hidden="true" />
            Bozza di convocazione
          </Button>
          <Button
            href={`/admin/assemblee/${assembleaId}/documenti?tipo=verbale`}
            target="_blank"
            rel="noopener noreferrer"
            variant="secondary"
            size="sm"
          >
            <FileDown className="size-4" aria-hidden="true" />
            Bozza di verbale
          </Button>
        </ButtonGroup>

        <div className="flex flex-col items-start gap-1.5 border-t border-border pt-3">
          <Button size="sm" onClick={salvaVerbale} pending={inCorso}>
            <Sparkles className="size-4" aria-hidden="true" />
            {inCorso ? "Generazione…" : "Genera e salva come verbale"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Deposita la bozza di verbale tra i documenti dell&apos;assemblea, visibile ai
            condòmini. Sostituisce il verbale attualmente presente e va rifatta se i dati
            cambiano.
          </p>
        </div>

        <FormError>{errore}</FormError>
      </div>
    </Card>
  );
}
