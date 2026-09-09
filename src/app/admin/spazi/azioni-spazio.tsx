"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { aggiornaSpazio, eliminaSpazio } from "./actions";
import type { SpazioComune } from "@/lib/types";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, FormGrid, Input, Textarea } from "@/components/ui/input";
import { FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function AzioniSpazio({
  spazio,
  prenotazioniFuture,
}: {
  spazio: SpazioComune;
  /** Prenotazioni confermate ancora da venire: si perdono se lo spazio è eliminato. */
  prenotazioniFuture: number;
}) {
  const [modifica, setModifica] = useState(false);
  const [conferma, setConferma] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [campi, setCampi] = useState({
    nome: spazio.nome,
    descrizione: spazio.descrizione ?? "",
    posti: String(spazio.posti),
    oraApertura: spazio.ora_apertura.slice(0, 5),
    oraChiusura: spazio.ora_chiusura.slice(0, 5),
    durataMassimaOre: spazio.durata_massima_ore ? String(spazio.durata_massima_ore) : "",
    attivo: spazio.attivo,
  });

  function apriModifica() {
    setCampi({
      nome: spazio.nome,
      descrizione: spazio.descrizione ?? "",
      posti: String(spazio.posti),
      oraApertura: spazio.ora_apertura.slice(0, 5),
      oraChiusura: spazio.ora_chiusura.slice(0, 5),
      durataMassimaOre: spazio.durata_massima_ore ? String(spazio.durata_massima_ore) : "",
      attivo: spazio.attivo,
    });
    setErrore(null);
    setModifica(true);
  }

  function salva() {
    setErrore(null);
    startTransition(async () => {
      const esito = await aggiornaSpazio({
        id: spazio.id,
        nome: campi.nome,
        descrizione: campi.descrizione,
        posti: Number(campi.posti) || 1,
        oraApertura: campi.oraApertura,
        oraChiusura: campi.oraChiusura,
        durataMassimaOre: campi.durataMassimaOre ? Number(campi.durataMassimaOre) : null,
        attivo: campi.attivo,
      });
      if ("errore" in esito) {
        setErrore(esito.errore);
        return;
      }
      setModifica(false);
    });
  }

  return (
    <span className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        iconOnly
        onClick={apriModifica}
        aria-label={`Modifica ${spazio.nome}`}
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
        aria-label={`Elimina ${spazio.nome}`}
        title="Elimina"
      >
        <Trash2 className="size-4" />
      </Button>

      <Dialog
        aperto={modifica}
        onChiudi={() => setModifica(false)}
        bloccato={pending}
        titolo="Modifica spazio"
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
          <Field id={`sp_nome_${spazio.id}`} label="Nome" required>
            <Input
              value={campi.nome}
              onChange={(e) => setCampi((c) => ({ ...c, nome: e.target.value }))}
              required
            />
          </Field>

          <Field id={`sp_desc_${spazio.id}`} label="Descrizione">
            <Textarea
              rows={2}
              value={campi.descrizione}
              onChange={(e) => setCampi((c) => ({ ...c, descrizione: e.target.value }))}
            />
          </Field>

          <FormGrid colonne={2}>
            <Field id={`sp_ap_${spazio.id}`} label="Prenotabile dalle">
              <Input
                type="time"
                value={campi.oraApertura}
                onChange={(e) => setCampi((c) => ({ ...c, oraApertura: e.target.value }))}
              />
            </Field>
            <Field id={`sp_ch_${spazio.id}`} label="fino alle">
              <Input
                type="time"
                value={campi.oraChiusura}
                onChange={(e) => setCampi((c) => ({ ...c, oraChiusura: e.target.value }))}
              />
            </Field>
          </FormGrid>

          <FormGrid colonne={2}>
            <Field id={`sp_posti_${spazio.id}`} label="Posti prenotabili insieme">
              <Input
                type="number"
                min="1"
                step="1"
                value={campi.posti}
                onChange={(e) => setCampi((c) => ({ ...c, posti: e.target.value }))}
              />
            </Field>
            <Field
              id={`sp_dur_${spazio.id}`}
              label="Durata massima (ore)"
              hint="Vuoto = nessun limite."
            >
              <Input
                type="number"
                min="1"
                step="1"
                value={campi.durataMassimaOre}
                onChange={(e) => setCampi((c) => ({ ...c, durataMassimaOre: e.target.value }))}
              />
            </Field>
          </FormGrid>

          <label className="flex items-start gap-2.5 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={campi.attivo}
              onChange={(e) => setCampi((c) => ({ ...c, attivo: e.target.checked }))}
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">Prenotabile</span>
              <span className="text-xs text-muted-foreground">
                Togli la spunta per sospendere le nuove prenotazioni (lavori, chiusura
                stagionale) senza cancellare quelle già confermate.
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
        titolo="Eliminare lo spazio?"
        descrizione={spazio.nome}
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
                  const esito = await eliminaSpazio(spazio.id);
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
          {prenotazioniFuture > 0
            ? `Ci sono ancora ${prenotazioniFuture} ${
                prenotazioniFuture === 1 ? "prenotazione" : "prenotazioni"
              } da venire: verranno cancellate senza avvisare chi le ha fatte. Per fermare solo le nuove richieste conviene togliere la spunta «Prenotabile» dalla modifica.`
            : "Vengono cancellate anche tutte le prenotazioni passate registrate su questo spazio."}
        </p>
        <FormError className="mt-3">{errore}</FormError>
      </Dialog>
    </span>
  );
}
