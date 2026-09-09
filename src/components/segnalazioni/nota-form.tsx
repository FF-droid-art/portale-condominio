"use client";

import { useActionState, useRef } from "react";
import { Send } from "lucide-react";
import { useAlSuccesso } from "@/lib/hooks";
import { Checkbox, Field, Textarea } from "@/components/ui/input";
import { FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type StatoForm = { errore?: string } | undefined;

/**
 * Aggiunta di una nota alla cronologia di una segnalazione.
 *
 * L'azione arriva come prop perché il modulo è identico nelle due aree ma le
 * azioni no: quella dell'amministratore può marcare la nota come interna,
 * quella del condòmino no. Passare la server action invece di duplicare il
 * componente tiene una sola volta il comportamento (svuota il campo dopo
 * l'invio riuscito, annuncia l'errore accanto al campo).
 */
export function NotaSegnalazioneForm({
  segnalazioneId,
  azione,
  permetteInterna = false,
  etichetta = "Aggiungi un aggiornamento",
}: {
  segnalazioneId: string;
  azione: (stato: StatoForm, formData: FormData) => Promise<StatoForm>;
  permetteInterna?: boolean;
  etichetta?: string;
}) {
  const [stato, action, pending] = useActionState(azione, undefined);
  const form = useRef<HTMLFormElement>(null);

  useAlSuccesso(pending, stato, () => form.current?.reset());

  return (
    <form ref={form} action={action} className="flex flex-col gap-3">
      <input type="hidden" name="segnalazione_id" value={segnalazioneId} />

      <Field
        id={`nota_${segnalazioneId}`}
        label={etichetta}
        hint={
          permetteInterna
            ? "Chi ha aperto la segnalazione riceve l'aggiornamento nella sua area riservata."
            : "L'amministratore lo vedrà nella scheda della segnalazione."
        }
      >
        <Textarea
          name="testo"
          rows={3}
          required
          placeholder="Es. Il tecnico è passato oggi, torna lunedì con il pezzo di ricambio."
        />
      </Field>

      {permetteInterna && (
        <label className="flex items-start gap-2.5 text-sm">
          <Checkbox name="interna" className="mt-0.5" />
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">Nota interna</span>
            <span className="text-xs text-muted-foreground">
              Visibile solo a te: serve per i promemoria di lavorazione, non arriva al condòmino.
            </span>
          </span>
        </label>
      )}

      <FormError>{stato?.errore}</FormError>

      <Button type="submit" variant="secondary" size="sm" pending={pending} className="w-fit">
        <Send className="size-4" aria-hidden="true" />
        {pending ? "Invio…" : "Aggiungi"}
      </Button>
    </form>
  );
}
