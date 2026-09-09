"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { aggiornaFornitore, eliminaFornitore } from "./actions";
import { CATEGORIE_FORNITORE, ETICHETTE_CATEGORIA_FORNITORE } from "@/lib/manutenzioni";
import type { Fornitore } from "@/lib/types";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, FormGrid, Input, Select, Textarea } from "@/components/ui/input";
import { FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Modifica e cancellazione di un fornitore.
 *
 * "Non attivo" invece della sola cancellazione: un fornitore sostituito resta
 * collegato alle manutenzioni e alle segnalazioni passate, e cancellarlo
 * lascerebbe quei riferimenti vuoti. La cancellazione vera resta disponibile
 * per le righe inserite per sbaglio.
 */
export function AzioniFornitore({ fornitore }: { fornitore: Fornitore }) {
  const [modifica, setModifica] = useState(false);
  const [conferma, setConferma] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [campi, setCampi] = useState({
    nome: fornitore.nome,
    categoria: fornitore.categoria as string,
    referente: fornitore.referente ?? "",
    email: fornitore.email ?? "",
    telefono: fornitore.telefono ?? "",
    partitaIva: fornitore.partita_iva ?? "",
    note: fornitore.note ?? "",
    attivo: fornitore.attivo,
  });

  function apriModifica() {
    setCampi({
      nome: fornitore.nome,
      categoria: fornitore.categoria,
      referente: fornitore.referente ?? "",
      email: fornitore.email ?? "",
      telefono: fornitore.telefono ?? "",
      partitaIva: fornitore.partita_iva ?? "",
      note: fornitore.note ?? "",
      attivo: fornitore.attivo,
    });
    setErrore(null);
    setModifica(true);
  }

  function salva() {
    setErrore(null);
    startTransition(async () => {
      const esito = await aggiornaFornitore({ id: fornitore.id, ...campi });
      if ("errore" in esito) {
        setErrore(esito.errore);
        return;
      }
      setModifica(false);
    });
  }

  return (
    <span className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        iconOnly
        onClick={apriModifica}
        aria-label={`Modifica ${fornitore.nome}`}
        title="Modifica"
      >
        <Pencil className="size-4" />
      </Button>
      <Button
        variant="ghost-danger"
        size="sm"
        iconOnly
        onClick={() => {
          setErrore(null);
          setConferma(true);
        }}
        aria-label={`Elimina ${fornitore.nome}`}
        title="Elimina"
      >
        <Trash2 className="size-4" />
      </Button>

      <Dialog
        aperto={modifica}
        onChiudi={() => setModifica(false)}
        bloccato={pending}
        titolo="Modifica fornitore"
        larghezza="md"
        footer={
          <>
            <Button variant="ghost" disabled={pending} onClick={() => setModifica(false)}>
              Annulla
            </Button>
            <Button pending={pending} onClick={salva}>
              Salva modifiche
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
          <Field id={`forn_nome_${fornitore.id}`} label="Ragione sociale" required>
            <Input
              value={campi.nome}
              onChange={(e) => setCampi((c) => ({ ...c, nome: e.target.value }))}
              required
            />
          </Field>

          <Field id={`forn_cat_${fornitore.id}`} label="Categoria">
            <Select
              value={campi.categoria}
              onChange={(e) => setCampi((c) => ({ ...c, categoria: e.target.value }))}
            >
              {CATEGORIE_FORNITORE.map((c) => (
                <option key={c} value={c}>
                  {ETICHETTE_CATEGORIA_FORNITORE[c]}
                </option>
              ))}
            </Select>
          </Field>

          <FormGrid colonne={2}>
            <Field id={`forn_ref_${fornitore.id}`} label="Referente">
              <Input
                value={campi.referente}
                onChange={(e) => setCampi((c) => ({ ...c, referente: e.target.value }))}
              />
            </Field>
            <Field id={`forn_piva_${fornitore.id}`} label="Partita IVA">
              <Input
                value={campi.partitaIva}
                onChange={(e) => setCampi((c) => ({ ...c, partitaIva: e.target.value }))}
              />
            </Field>
          </FormGrid>

          <FormGrid colonne={2}>
            <Field id={`forn_email_${fornitore.id}`} label="Email">
              <Input
                type="email"
                value={campi.email}
                onChange={(e) => setCampi((c) => ({ ...c, email: e.target.value }))}
              />
            </Field>
            <Field id={`forn_tel_${fornitore.id}`} label="Telefono">
              <Input
                type="tel"
                value={campi.telefono}
                onChange={(e) => setCampi((c) => ({ ...c, telefono: e.target.value }))}
              />
            </Field>
          </FormGrid>

          <Field id={`forn_note_${fornitore.id}`} label="Note">
            <Textarea
              rows={2}
              value={campi.note}
              onChange={(e) => setCampi((c) => ({ ...c, note: e.target.value }))}
            />
          </Field>

          <label className="flex items-start gap-2.5 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={campi.attivo}
              onChange={(e) => setCampi((c) => ({ ...c, attivo: e.target.checked }))}
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">Fornitore attivo</span>
              <span className="text-xs text-muted-foreground">
                Se lo disattivi resta collegato allo storico, ma non compare più tra le scelte
                quando assegni una segnalazione o programmi un intervento.
              </span>
            </span>
          </label>

          <FormError>{errore}</FormError>
          <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
            Salva
          </button>
        </form>
      </Dialog>

      <Dialog
        aperto={conferma}
        onChiudi={() => setConferma(false)}
        bloccato={pending}
        titolo="Eliminare il fornitore?"
        descrizione={`"${fornitore.nome}" verrà rimosso dall'anagrafica.`}
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
                  const esito = await eliminaFornitore(fornitore.id);
                  if (esito.errore) {
                    setErrore(esito.errore);
                    return;
                  }
                  setConferma(false);
                })
              }
            >
              Elimina
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          Le manutenzioni e le segnalazioni che gli erano assegnate restano, ma senza più il
          riferimento al fornitore. Se ti serve solo toglierlo dalle scelte future, conviene
          disattivarlo dalla modifica.
        </p>
        <FormError className="mt-3">{errore}</FormError>
      </Dialog>
    </span>
  );
}
