"use client";

import { useActionState } from "react";
import { ExternalLink, Video } from "lucide-react";
import { aggiornaLinkVideoconferenza } from "./actions";
import { Field, Input } from "@/components/ui/input";
import { FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function LinkVideoconferenza({
  assembleaId,
  link,
}: {
  assembleaId: string;
  link: string | null;
}) {
  const [stato, action, pending] = useActionState(aggiornaLinkVideoconferenza, undefined);

  return (
    <div className="flex flex-col gap-4">
      {link && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-muted/50 px-4 py-3">
          <span className="flex min-w-0 items-center gap-2.5 text-sm">
            <span
              className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface text-muted-foreground"
              aria-hidden="true"
            >
              <Video className="size-4" />
            </span>
            <span className="truncate font-medium">Riunione online attiva</span>
          </span>
          <Button
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            variant="secondary"
            size="sm"
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            Apri riunione
          </Button>
        </div>
      )}

      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="assemblea_id" value={assembleaId} />
        <Field
          id="link_videoconferenza"
          label="Link della videoconferenza"
          hint="Zoom, Google Meet, Webex… I condòmini lo vedranno nella loro pagina dell'assemblea."
        >
          <Input
            name="link_videoconferenza"
            type="url"
            inputMode="url"
            placeholder="https://…"
            defaultValue={link ?? ""}
          />
        </Field>
        <FormError>{stato?.errore}</FormError>
        <Button type="submit" variant="secondary" pending={pending} className="w-fit">
          {pending ? "Salvataggio…" : "Salva link"}
        </Button>
      </form>
    </div>
  );
}
