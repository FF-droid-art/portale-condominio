"use client";

import { useActionState } from "react";
import { Video } from "lucide-react";
import { aggiornaLinkVideoconferenza } from "./actions";
import { Field, Input, Label } from "@/components/ui/input";
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
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="assemblea_id" value={assembleaId} />
      <Field>
        <Label htmlFor="link_videoconferenza">Link videoconferenza (Zoom, Meet, Webex...)</Label>
        <div className="flex gap-2">
          <Input
            id="link_videoconferenza"
            name="link_videoconferenza"
            type="url"
            placeholder="https://..."
            defaultValue={link ?? ""}
          />
          <Button type="submit" variant="secondary" pending={pending}>
            Salva
          </Button>
        </div>
      </Field>
      {stato?.errore && <p className="text-sm text-danger">{stato.errore}</p>}
      {link && (
        <Button
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          variant="secondary"
          className="w-fit"
          size="sm"
        >
          <Video className="size-4" />
          Apri riunione
        </Button>
      )}
    </form>
  );
}
