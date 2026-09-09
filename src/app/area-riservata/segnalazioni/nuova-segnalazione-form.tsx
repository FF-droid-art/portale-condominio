"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { creaSegnalazione } from "./actions";
import {
  CATEGORIE_SEGNALAZIONE,
  ETICHETTE_CATEGORIA_SEGNALAZIONE,
  ETICHETTE_PRIORITA,
  PRIORITA_SEGNALAZIONE,
} from "@/lib/segnalazioni";
import { useAlSuccesso } from "@/lib/hooks";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormGrid, Input, Select, Textarea } from "@/components/ui/input";
import { Alert, FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export type UnitaSegnalabile = {
  id: string;
  identificativo: string;
  condominio_id: string;
  condominio_nome: string;
};

/**
 * Apertura di una segnalazione.
 *
 * Il primo campo non è il condominio ma il LUOGO: chi ha una sola unità trova
 * già tutto scelto, chi ne ha più d'una sceglie una volta sola e da lì si
 * ricava il condominio. Le "parti comuni" sono un'opzione per ciascun
 * condominio, così la distinzione unità/parti comuni non richiede un secondo
 * controllo da capire.
 */
export function NuovaSegnalazioneForm({ unita }: { unita: UnitaSegnalabile[] }) {
  const [aperto, setAperto] = useState(false);
  const [stato, action, pending] = useActionState(creaSegnalazione, undefined);

  const condomini = Array.from(
    new Map(unita.map((u) => [u.condominio_id, u.condominio_nome])).entries()
  ).map(([id, nome]) => ({ id, nome }));

  // valore = "condominioId:unitaId" ("" per le parti comuni)
  const opzioni = [
    ...unita.map((u) => ({
      valore: `${u.condominio_id}:${u.id}`,
      etichetta:
        condomini.length > 1 ? `${u.condominio_nome} — ${u.identificativo}` : u.identificativo,
    })),
    ...condomini.map((c) => ({
      valore: `${c.id}:`,
      etichetta: condomini.length > 1 ? `${c.nome} — parti comuni` : "Parti comuni",
    })),
  ];

  const [luogo, setLuogo] = useState(opzioni[0]?.valore ?? "");
  const [condominioId, unitaId] = luogo.split(":");

  useAlSuccesso(pending, stato, () => setAperto(false));

  const senzaUnita = unita.length === 0;

  return (
    <>
      <Button onClick={() => setAperto(true)} disabled={senzaUnita}>
        <Plus className="size-4" aria-hidden="true" />
        Nuova segnalazione
      </Button>

      <Dialog
        aperto={aperto}
        onChiudi={() => setAperto(false)}
        bloccato={pending}
        titolo="Nuova segnalazione"
        descrizione="Un guasto o un disservizio da far vedere all'amministratore. Le segnalazioni sulle parti comuni sono visibili a tutto il condominio, quelle sulla tua unità solo a te e all'amministratore."
        larghezza="md"
      >
        <form action={action} className="flex flex-col gap-4">
          {senzaUnita && (
            <Alert tono="warning" titolo="Nessuna unità collegata">
              Il tuo account non è ancora associato a un&apos;unità immobiliare: chiedi
              all&apos;amministratore di collegarti.
            </Alert>
          )}

          <input type="hidden" name="condominio_id" value={condominioId ?? ""} />
          <input type="hidden" name="unita_id" value={unitaId ?? ""} />

          <Field id="segn_luogo" label="Dove" required>
            <Select value={luogo} onChange={(e) => setLuogo(e.target.value)} required>
              {opzioni.map((o) => (
                <option key={o.valore} value={o.valore}>
                  {o.etichetta}
                </option>
              ))}
            </Select>
          </Field>

          <Field id="segn_titolo" label="Di che cosa si tratta" required>
            <Input name="titolo" placeholder="Es. L'ascensore si ferma tra il 2° e il 3° piano" required />
          </Field>

          <Field
            id="segn_descrizione"
            label="Descrizione"
            hint="Quando succede, da quanto tempo, se è già capitato: più dettagli ci sono, meno sopralluoghi servono."
            required
          >
            <Textarea name="descrizione" rows={4} required />
          </Field>

          <FormGrid colonne={2}>
            <Field id="segn_categoria" label="Categoria">
              <Select name="categoria" defaultValue="altro">
                {CATEGORIE_SEGNALAZIONE.map((c) => (
                  <option key={c} value={c}>
                    {ETICHETTE_CATEGORIA_SEGNALAZIONE[c]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="segn_priorita" label="Urgenza">
              <Select name="priorita" defaultValue="normale">
                {PRIORITA_SEGNALAZIONE.map((p) => (
                  <option key={p} value={p}>
                    {ETICHETTE_PRIORITA[p]}
                  </option>
                ))}
              </Select>
            </Field>
          </FormGrid>

          <Field
            id="segn_foto"
            label="Foto"
            hint="Facoltativa, fino a 4 MB. Una foto risparmia quasi sempre un sopralluogo."
          >
            <Input name="foto" type="file" accept="image/*" />
          </Field>

          <FormError>{stato?.errore}</FormError>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setAperto(false)}>
              Annulla
            </Button>
            <Button type="submit" pending={pending} disabled={senzaUnita}>
              {pending ? "Invio…" : "Invia segnalazione"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
