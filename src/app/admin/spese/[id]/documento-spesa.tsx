"use client";

import { useActionState } from "react";
import { FileText, Upload } from "lucide-react";
import { caricaDocumentoSpesa } from "./actions";
import { Field, Input, Label } from "@/components/ui/input";
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
    <div className="flex flex-col gap-3">
      {documentoUrl && signedUrl && (
        <Button
          href={signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          variant="secondary"
          className="w-fit"
          size="sm"
        >
          <FileText className="size-4" />
          Scarica fattura
        </Button>
      )}

      <form action={action} className="flex items-end gap-2">
        <input type="hidden" name="spesa_id" value={spesaId} />
        <Field className="flex-1">
          <Label htmlFor="documento">
            {documentoUrl ? "Sostituisci fattura" : "Carica fattura (PDF o immagine, max 4MB)"}
          </Label>
          <Input id="documento" name="documento" type="file" accept="application/pdf,image/*" required />
        </Field>
        <Button type="submit" variant="secondary" pending={pending}>
          <Upload className="size-4" />
          Carica
        </Button>
      </form>
      {stato?.errore && <p className="text-sm text-danger">{stato.errore}</p>}
    </div>
  );
}
