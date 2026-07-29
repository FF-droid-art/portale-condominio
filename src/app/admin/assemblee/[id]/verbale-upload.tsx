"use client";

import { useActionState } from "react";
import { FileText, Upload } from "lucide-react";
import { caricaVerbale } from "./actions";
import { Field, Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function VerbaleUpload({
  assembleaId,
  verbaleUrl,
  signedUrl,
}: {
  assembleaId: string;
  verbaleUrl: string | null;
  signedUrl: string | null;
}) {
  const [stato, action, pending] = useActionState(caricaVerbale, undefined);

  return (
    <div className="flex flex-col gap-3">
      {verbaleUrl && signedUrl && (
        <Button
          href={signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          variant="secondary"
          className="w-fit"
          size="sm"
        >
          <FileText className="size-4" />
          Scarica verbale
        </Button>
      )}

      <form action={action} className="flex items-end gap-2">
        <input type="hidden" name="assemblea_id" value={assembleaId} />
        <Field className="flex-1">
          <Label htmlFor="verbale">
            {verbaleUrl ? "Sostituisci verbale" : "Carica verbale (PDF o immagine, max 4MB)"}
          </Label>
          <Input id="verbale" name="verbale" type="file" accept="application/pdf,image/*" required />
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
