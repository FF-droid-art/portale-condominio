"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { creaManutenzione } from "./actions";
import { ETICHETTE_PERIODICITA, PERIODICITA } from "@/lib/manutenzioni";
import { formatData } from "@/lib/format";
import { useAlSuccesso } from "@/lib/hooks";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormGrid, Input, Select, Textarea } from "@/components/ui/input";
import { Alert, FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type Opzione = { id: string; nome: string };
type FornitoreOpzione = { id: string; nome: string; condominio_id: string; attivo: boolean };
type SpesaOpzione = { id: string; descrizione: string; condominio_id: string; data_spesa: string };

/**
 * Nuova manutenzione programmata.
 *
 * Fornitore e spesa collegata dipendono dal condominio scelto: il filtro è
 * fatto qui, sul client, sui dati già caricati dalla pagina, così scegliendo lo
 * stabile le due tendine si restringono subito senza un altro giro al server.
 */
export function ManutenzioneForm({
  condomini,
  fornitori,
  spese,
}: {
  condomini: Opzione[];
  fornitori: FornitoreOpzione[];
  spese: SpesaOpzione[];
}) {
  const [aperto, setAperto] = useState(false);
  const [condominioId, setCondominioId] = useState("");
  const [stato, action, pending] = useActionState(creaManutenzione, undefined);

  useAlSuccesso(pending, stato, () => {
    setAperto(false);
    setCondominioId("");
  });

  const senzaCondomini = condomini.length === 0;
  const fornitoriDelCondominio = fornitori.filter(
    (f) => f.condominio_id === condominioId && f.attivo
  );
  const speseDelCondominio = spese.filter((s) => s.condominio_id === condominioId);

  return (
    <>
      <Button size="sm" onClick={() => setAperto(true)} disabled={senzaCondomini}>
        <Plus className="size-4" aria-hidden="true" />
        Nuova manutenzione
      </Button>

      <Dialog
        aperto={aperto}
        onChiudi={() => setAperto(false)}
        bloccato={pending}
        titolo="Nuova manutenzione programmata"
        descrizione="La scadenza del prossimo intervento. Se è periodica, quando la spunterai come eseguita il portale programmerà da sé quella successiva."
        larghezza="md"
      >
        <form action={action} className="flex flex-col gap-4">
          {senzaCondomini && (
            <Alert tono="warning" titolo="Nessun condominio disponibile">
              Crea prima un condominio.
            </Alert>
          )}

          <Field id="man_condominio" label="Condominio" required>
            <Select
              name="condominio_id"
              required
              value={condominioId}
              onChange={(e) => setCondominioId(e.target.value)}
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

          <Field id="man_titolo" label="Intervento" required>
            <Input name="titolo" placeholder="Es. Verifica periodica ascensore" required />
          </Field>

          <Field id="man_descrizione" label="Note" hint="Facoltativo: riferimenti di contratto, prescrizioni.">
            <Textarea name="descrizione" rows={2} />
          </Field>

          <FormGrid colonne={2}>
            <Field id="man_data" label="Prossima scadenza" required>
              <Input name="data_prossima" type="date" required />
            </Field>
            <Field id="man_periodicita" label="Periodicità">
              <Select name="periodicita" defaultValue="annuale">
                {PERIODICITA.map((p) => (
                  <option key={p} value={p}>
                    {ETICHETTE_PERIODICITA[p]}
                  </option>
                ))}
              </Select>
            </Field>
          </FormGrid>

          <FormGrid colonne={2}>
            <Field
              id="man_fornitore"
              label="Fornitore"
              hint={
                condominioId && fornitoriDelCondominio.length === 0
                  ? "Nessun fornitore attivo per questo condominio."
                  : "Facoltativo."
              }
            >
              <Select name="fornitore_id" defaultValue="">
                <option value="">Nessuno</option>
                {fornitoriDelCondominio.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </Select>
            </Field>

            <Field id="man_costo" label="Costo previsto" hint="Facoltativo, in euro.">
              <Input name="costo_previsto" type="number" min="0" step="0.01" inputMode="decimal" />
            </Field>
          </FormGrid>

          <Field
            id="man_spesa"
            label="Spesa collegata"
            hint="Facoltativo: se l'intervento è già stato fatturato, collega la spesa registrata."
          >
            <Select name="spesa_id" defaultValue="">
              <option value="">Nessuna</option>
              {speseDelCondominio.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.descrizione} — {formatData(s.data_spesa)}
                </option>
              ))}
            </Select>
          </Field>

          <FormError>{stato?.errore}</FormError>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setAperto(false)}>
              Annulla
            </Button>
            <Button type="submit" pending={pending} disabled={senzaCondomini}>
              {pending ? "Salvataggio…" : "Programma intervento"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
