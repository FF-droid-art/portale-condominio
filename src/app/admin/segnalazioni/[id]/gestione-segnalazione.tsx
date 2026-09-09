"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { aggiornaSegnalazione, eliminaSegnalazione } from "../actions";
import {
  ETICHETTE_PRIORITA,
  ETICHETTE_STATO_SEGNALAZIONE,
  PRIORITA_SEGNALAZIONE,
  STATI_SEGNALAZIONE,
} from "@/lib/segnalazioni";
import type { PrioritaSegnalazione, StatoSegnalazione } from "@/lib/types";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/input";
import { FormError, FormSuccess } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Presa in carico di una segnalazione: stato, priorità e fornitore assegnato.
 *
 * Un solo pulsante di salvataggio per i tre campi: sono le tre decisioni che
 * l'amministratore prende in un colpo solo quando apre la scheda.
 */
export function GestioneSegnalazione({
  id,
  stato,
  priorita,
  fornitoreId,
  fornitori,
}: {
  id: string;
  stato: StatoSegnalazione;
  priorita: PrioritaSegnalazione;
  fornitoreId: string | null;
  fornitori: { id: string; nome: string; attivo: boolean }[];
}) {
  const [valori, setValori] = useState({
    stato: stato as string,
    priorita: priorita as string,
    fornitoreId: fornitoreId ?? "",
  });
  const [errore, setErrore] = useState<string | null>(null);
  const [salvato, setSalvato] = useState(false);
  const [conferma, setConferma] = useState(false);
  const [pending, startTransition] = useTransition();

  const modificato =
    valori.stato !== stato ||
    valori.priorita !== priorita ||
    valori.fornitoreId !== (fornitoreId ?? "");

  // Un fornitore disattivato dopo l'assegnazione resta nell'elenco, altrimenti
  // il menu mostrerebbe "nessuno" pur essendoci un'assegnazione in corso.
  const selezionabili = fornitori.filter((f) => f.attivo || f.id === fornitoreId);

  function salva() {
    setErrore(null);
    setSalvato(false);
    startTransition(async () => {
      const esito = await aggiornaSegnalazione({
        id,
        stato: valori.stato,
        priorita: valori.priorita,
        fornitoreId: valori.fornitoreId || null,
      });
      if ("errore" in esito) {
        setErrore(esito.errore);
        return;
      }
      setSalvato(true);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Field id="segn_stato" label="Stato">
        <Select
          value={valori.stato}
          onChange={(e) => setValori((v) => ({ ...v, stato: e.target.value }))}
        >
          {STATI_SEGNALAZIONE.map((s) => (
            <option key={s} value={s}>
              {ETICHETTE_STATO_SEGNALAZIONE[s]}
            </option>
          ))}
        </Select>
      </Field>

      <Field id="segn_priorita" label="Priorità">
        <Select
          value={valori.priorita}
          onChange={(e) => setValori((v) => ({ ...v, priorita: e.target.value }))}
        >
          {PRIORITA_SEGNALAZIONE.map((p) => (
            <option key={p} value={p}>
              {ETICHETTE_PRIORITA[p]}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        id="segn_fornitore"
        label="Fornitore assegnato"
        hint={
          selezionabili.length
            ? "Chi se ne occupa. Il condòmino vede il nome nella sua scheda."
            : "Nessun fornitore registrato per questo condominio."
        }
      >
        <Select
          value={valori.fornitoreId}
          onChange={(e) => setValori((v) => ({ ...v, fornitoreId: e.target.value }))}
        >
          <option value="">Nessuno</option>
          {selezionabili.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
              {f.attivo ? "" : " (non attivo)"}
            </option>
          ))}
        </Select>
      </Field>

      <FormError>{errore}</FormError>
      {salvato && !modificato && <FormSuccess>Segnalazione aggiornata.</FormSuccess>}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" pending={pending} disabled={!modificato} onClick={salva}>
          {pending ? "Salvataggio…" : "Salva"}
        </Button>
        <Button
          size="sm"
          variant="ghost-danger"
          onClick={() => {
            setErrore(null);
            setConferma(true);
          }}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          Elimina
        </Button>
      </div>

      <Dialog
        aperto={conferma}
        onChiudi={() => setConferma(false)}
        bloccato={pending}
        titolo="Eliminare la segnalazione?"
        descrizione="Spariscono anche tutti gli aggiornamenti della cronologia."
        footer={
          <>
            <Button variant="ghost" disabled={pending} onClick={() => setConferma(false)}>
              Annulla
            </Button>
            <Button
              variant="danger"
              pending={pending}
              onClick={() =>
                startTransition(async () => {
                  const esito = await eliminaSegnalazione(id);
                  if (esito?.errore) setErrore(esito.errore);
                })
              }
            >
              Elimina
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          Per conservare la traccia di un problema risolto conviene chiuderla invece di
          eliminarla: chiusa resta consultabile, sia a te sia a chi l&apos;ha aperta.
        </p>
        <FormError className="mt-3">{errore}</FormError>
      </Dialog>
    </div>
  );
}
