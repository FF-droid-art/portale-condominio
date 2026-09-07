"use client";

import { useActionState } from "react";
import { FileText, Upload } from "lucide-react";
import { caricaDocumentoSpesa } from "./actions";
import { Field, Input } from "@/components/ui/input";
import { FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function DocumentoSpesa({
  spesaId,
  documentoUrl,
  signedUrl,
}: {
  spesaId: string;
  documentoUrl: string | null;
  signedUrl: string | null;
}) {
  const [stato, action, pending] = useActionState(caricaDocumentoSpesa, undefined);

  return (
    <div className="flex flex-col gap-4">
      {documentoUrl && signedUrl && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-muted/50 px-4 py-3">
          <span className="flex min-w-0 items-center gap-2.5 text-sm">
            <span
              className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface text-muted-foreground"
              aria-hidden="true"
            >
              <FileText className="size-4" />
            </span>
            <span className="font-medium">Fattura caricata</span>
          </span>
          <Button
            href={signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="secondary"
            size="sm"
          >
            Apri il documento
          </Button>
        </div>
      )}

      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="spesa_id" value={spesaId} />
        <Field
          id="documento"
          label={documentoUrl ? "Sostituisci la fattura" : "Carica la fattura"}
          hint="PDF o immagine, fino a 4 MB."
        >
          <Input name="documento" type="file" accept="application/pdf,image/*" required />
        </Field>
        <FormError>{stato?.errore}</FormError>
        <Button type="submit" variant="secondary" pending={pending} className="w-fit">
          <Upload className="size-4" aria-hidden="true" />
          {pending ? "Caricamento…" : "Carica"}
        </Button>
      </form>
    </div>
  );
}
