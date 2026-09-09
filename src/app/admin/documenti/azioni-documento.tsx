"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { aggiornaDocumento, eliminaDocumento } from "./actions";
import { CATEGORIE_DOCUMENTO, ETICHETTE_CATEGORIA_DOCUMENTO } from "@/lib/archivio";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Modifica dei metadati e cancellazione di un documento in archivio.
 *
 * Il file caricato non si sostituisce: si carica la versione nuova e si
 * elimina la vecchia. Sovrascrivere in silenzio un documento che i condòmini
 * hanno già consultato (un regolamento, una polizza) è proprio la cosa che in
 * un archivio non deve poter succedere per sbaglio.
 */
export function AzioniDocumento({
  documento,
}: {
  documento: {
    id: string;
    titolo: string;
    descrizione: string | null;
    categoria: string;
    nome_file: string;
  };
}) {
  const [modifica, setModifica] = useState(false);
  const [conferma, setConferma] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [campi, setCampi] = useState({
    titolo: documento.titolo,
    descrizione: documento.descrizione ?? "",
    categoria: documento.categoria,
  });

  function apriModifica() {
    setCampi({
      titolo: documento.titolo,
      descrizione: documento.descrizione ?? "",
      categoria: documento.categoria,
    });
    setErrore(null);
    setModifica(true);
  }

  function salva() {
    setErrore(null);
    startTransition(async () => {
      const esito = await aggiornaDocumento({ id: documento.id, ...campi });
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
        aria-label={`Modifica ${documento.titolo}`}
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
        aria-label={`Elimina ${documento.titolo}`}
        title="Elimina"
      >
        <Trash2 className="size-4" />
      </Button>

      <Dialog
        aperto={modifica}
        onChiudi={() => setModifica(false)}
        bloccato={pending}
        titolo="Modifica documento"
        descrizione={documento.nome_file}
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
          <Field id={`doc_tit_${documento.id}`} label="Titolo" required>
            <Input
              value={campi.titolo}
              onChange={(e) => setCampi((c) => ({ ...c, titolo: e.target.value }))}
              required
            />
          </Field>

          <Field id={`doc_cat_${documento.id}`} label="Categoria">
            <Select
              value={campi.categoria}
              onChange={(e) => setCampi((c) => ({ ...c, categoria: e.target.value }))}
            >
              {CATEGORIE_DOCUMENTO.map((c) => (
                <option key={c} value={c}>
                  {ETICHETTE_CATEGORIA_DOCUMENTO[c]}
                </option>
              ))}
            </Select>
          </Field>

          <Field id={`doc_desc_${documento.id}`} label="Descrizione">
            <Textarea
              rows={2}
              value={campi.descrizione}
              onChange={(e) => setCampi((c) => ({ ...c, descrizione: e.target.value }))}
            />
          </Field>

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
        titolo="Eliminare il documento?"
        descrizione={`"${documento.titolo}" sparirà dall'archivio di tutti i condòmini.`}
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
                  const esito = await eliminaDocumento(documento.id);
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
          Viene rimosso anche il file caricato: l&apos;operazione non è annullabile.
        </p>
        <FormError className="mt-3">{errore}</FormError>
      </Dialog>
    </span>
  );
}
