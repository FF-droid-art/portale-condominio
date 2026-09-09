"use client";

import { useActionState, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { prenotaSpazio } from "./actions";
import { useAlSuccesso } from "@/lib/hooks";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormGrid, Input, Select, Textarea } from "@/components/ui/input";
import { FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export type UnitaPrenotante = { id: string; identificativo: string };

/**
 * Prenotazione di una fascia oraria.
 *
 * Giorno e due orari, non due campi "data e ora": è come si pensa una
 * prenotazione ("sabato dalle 18 alle 20") ed evita che si possa comporre per
 * sbaglio una fascia che scavalca la mezzanotte. Gli attributi `min`/`max` sui
 * campi orario mostrano subito i limiti dello spazio, ma la verifica vera resta
 * sul server: qui servono a non far sbagliare, non a garantire.
 */
export function PrenotaForm({
  spazioId,
  nomeSpazio,
  oraApertura,
  oraChiusura,
  durataMassimaOre,
  unita,
  oggi,
}: {
  spazioId: string;
  nomeSpazio: string;
  oraApertura: string;
  oraChiusura: string;
  durataMassimaOre: number | null;
  unita: UnitaPrenotante[];
  /** Data odierna secondo l'orologio del condominio, come "aaaa-mm-gg". */
  oggi: string;
}) {
  const [aperto, setAperto] = useState(false);
  const [stato, action, pending] = useActionState(prenotaSpazio, undefined);

  useAlSuccesso(pending, stato, () => setAperto(false));

  const apertura = oraApertura.slice(0, 5);
  const chiusura = oraChiusura.slice(0, 5);

  return (
    <>
      <Button size="sm" onClick={() => setAperto(true)} disabled={unita.length === 0}>
        <CalendarPlus className="size-4" aria-hidden="true" />
        Prenota
      </Button>

      <Dialog
        aperto={aperto}
        onChiudi={() => setAperto(false)}
        bloccato={pending}
        titolo={`Prenota — ${nomeSpazio}`}
        descrizione={`Prenotabile dalle ${apertura} alle ${chiusura}${
          durataMassimaOre
            ? `, per un massimo di ${durataMassimaOre} ${durataMassimaOre === 1 ? "ora" : "ore"}`
            : ""
        }.`}
      >
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="spazio_id" value={spazioId} />

          {unita.length > 1 ? (
            <Field id={`pren_unita_${spazioId}`} label="Per quale unità" required>
              <Select name="unita_id" required defaultValue={unita[0]?.id}>
                {unita.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.identificativo}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <input type="hidden" name="unita_id" value={unita[0]?.id ?? ""} />
          )}

          <Field id={`pren_giorno_${spazioId}`} label="Giorno" required>
            <Input name="giorno" type="date" min={oggi} defaultValue={oggi} required />
          </Field>

          <FormGrid colonne={2}>
            <Field id={`pren_da_${spazioId}`} label="Dalle" required>
              <Input
                name="ora_inizio"
                type="time"
                min={apertura}
                max={chiusura}
                defaultValue={apertura}
                required
              />
            </Field>
            <Field id={`pren_a_${spazioId}`} label="Alle" required>
              <Input
                name="ora_fine"
                type="time"
                min={apertura}
                max={chiusura}
                required
              />
            </Field>
          </FormGrid>

          <Field
            id={`pren_note_${spazioId}`}
            label="Note"
            hint="Facoltative: il motivo, il numero di persone, un recapito."
          >
            <Textarea name="note" rows={2} />
          </Field>

          <FormError>{stato?.errore}</FormError>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setAperto(false)}>
              Annulla
            </Button>
            <Button type="submit" pending={pending}>
              {pending ? "Prenotazione…" : "Conferma prenotazione"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
