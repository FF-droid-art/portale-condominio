"use client";

import { useActionState } from "react";
import { FileText, Upload } from "lucide-react";
import { caricaVerbale } from "./actions";
import { Field, Input } from "@/components/ui/input";
import { FormError } from "@/components/ui/alert";
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
    <div className="flex flex-col gap-4">
      {verbaleUrl && signedUrl && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-muted/50 px-4 py-3">
          <span className="flex min-w-0 items-center gap-2.5 text-sm">
            <span
              className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface text-muted-foreground"
              aria-hidden="true"
            >
              <FileText className="size-4" />
            </span>
            <span className="font-medium">Verbale caricato</span>
          </span>
          <Button
            href={signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="secondary"
            size="sm"
          >
            Scarica il verbale
          </Button>
        </div>
      )}

      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="assemblea_id" value={assembleaId} />
        <Field
          id="verbale"
          label={verbaleUrl ? "Sostituisci il verbale" : "Carica il verbale"}
          hint="PDF o immagine, fino a 4 MB."
        >
          <Input name="verbale" type="file" accept="application/pdf,image/*" required />
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
