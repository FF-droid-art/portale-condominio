"use client";

import { useActionState, useState } from "react";
import { Upload } from "lucide-react";
import { caricaDocumento } from "./actions";
import { CATEGORIE_DOCUMENTO, ETICHETTE_CATEGORIA_DOCUMENTO } from "@/lib/archivio";
import { useAlSuccesso } from "@/lib/hooks";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Alert, FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function DocumentoForm({
  condomini,
  condominioPreselezionato,
}: {
  condomini: { id: string; nome: string }[];
  condominioPreselezionato?: string;
}) {
  const [aperto, setAperto] = useState(false);
  const [stato, action, pending] = useActionState(caricaDocumento, undefined);

  useAlSuccesso(pending, stato, () => setAperto(false));

  const senzaCondomini = condomini.length === 0;

  return (
    <>
      <Button onClick={() => setAperto(true)} disabled={senzaCondomini}>
        <Upload className="size-4" aria-hidden="true" />
        Carica documento
      </Button>

      <Dialog
        aperto={aperto}
        onChiudi={() => setAperto(false)}
        bloccato={pending}
        titolo="Carica un documento"
        descrizione="Finisce nell'archivio del condominio: tutti i condòmini di quello stabile potranno scaricarlo dalla loro area riservata."
        larghezza="md"
      >
        <form action={action} className="flex flex-col gap-4">
          {senzaCondomini && (
            <Alert tono="warning" titolo="Nessun condominio disponibile">
              Crea prima un condominio.
            </Alert>
          )}

          <Field id="doc_condominio" label="Condominio" required>
            <Select
              name="condominio_id"
              required
              defaultValue={condominioPreselezionato ?? ""}
            >
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

          <Field id="doc_categoria" label="Categoria">
            <Select name="categoria" defaultValue="altro">
              {CATEGORIE_DOCUMENTO.map((c) => (
                <option key={c} value={c}>
                  {ETICHETTE_CATEGORIA_DOCUMENTO[c]}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            id="doc_titolo"
            label="Titolo"
            hint="Come lo cercherà un condòmino. Se lo lasci vuoto vale il nome del file."
          >
            <Input name="titolo" placeholder="Es. Regolamento condominiale approvato nel 2019" />
          </Field>

          <Field id="doc_descrizione" label="Descrizione" hint="Facoltativa.">
            <Textarea name="descrizione" rows={2} />
          </Field>

          <Field id="doc_file" label="File" hint="PDF, immagine o foglio di calcolo, fino a 10 MB." required>
            <Input
              name="file"
              type="file"
              accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx,.odt,.ods"
              required
            />
          </Field>

          <FormError>{stato?.errore}</FormError>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setAperto(false)}>
              Annulla
            </Button>
            <Button type="submit" pending={pending} disabled={senzaCondomini}>
              {pending ? "Caricamento…" : "Carica"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
