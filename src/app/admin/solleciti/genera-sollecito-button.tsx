"use client";

import { useState, useTransition } from "react";
import { FileDown, Send } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Field, Checkbox, Select, Textarea } from "@/components/ui/input";
import { Alert, FormError, FormSuccess } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DESCRIZIONI_LIVELLO,
  ETICHETTE_LIVELLO,
  LIVELLI_SOLLECITO,
  type LivelloSollecito,
} from "@/lib/solleciti";
import { registraSollecito } from "./actions";

/**
 * Genera il sollecito di una unità.
 *
 * Il livello arriva già scelto (quello suggerito dai giorni di ritardo) ma
 * resta modificabile: chi amministra conosce la persona, e può decidere che
 * per quel condòmino il tono giusto è un altro.
 *
 * L'anteprima del PDF è un collegamento a parte, apribile prima di registrare
 * qualunque cosa: si guarda la lettera, e solo dopo si decide se mandarla.
 */
export function GeneraSollecitoButton({
  unitaId,
  identificativo,
  livelloSuggerito,
  destinatariConAccount,
}: {
  unitaId: string;
  identificativo: string;
  livelloSuggerito: LivelloSollecito;
  /** Quanti intestatari hanno un account e quindi possono ricevere l'email. */
  destinatariConAccount: number;
}) {
  const [aperto, setAperto] = useState(false);
  const [livello, setLivello] = useState<LivelloSollecito>(livelloSuggerito);
  const [note, setNote] = useState("");
  const [inviaEmail, setInviaEmail] = useState(destinatariConAccount > 0);
  const [errore, setErrore] = useState<string | null>(null);
  const [esito, setEsito] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function apri() {
    setLivello(livelloSuggerito);
    setNote("");
    setInviaEmail(destinatariConAccount > 0);
    setErrore(null);
    setEsito(null);
    setAperto(true);
  }

  function conferma() {
    startTransition(async () => {
      const risultato = await registraSollecito({ unitaId, livello, note, inviaEmail });
      if ("errore" in risultato) {
        setErrore(risultato.errore);
        return;
      }
      const pezzi = [`Sollecito registrato per ${identificativo}.`];
      if (risultato.emailInviate) {
        pezzi.push(
          `Email inviata a ${risultato.emailInviate} ${
            risultato.emailInviate === 1 ? "destinatario" : "destinatari"
          }.`
        );
      }
      if (risultato.emailSaltate) {
        pezzi.push(
          `${risultato.emailSaltate} ${
            risultato.emailSaltate === 1 ? "destinatario ha" : "destinatari hanno"
          } disattivato questo avviso.`
        );
      }
      if (risultato.senzaAccount) {
        pezzi.push(
          `${risultato.senzaAccount} ${
            risultato.senzaAccount === 1 ? "intestatario" : "intestatari"
          } senza account: recapita la lettera a parte.`
        );
      }
      setEsito(pezzi.join(" "));
      setErrore(null);
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={apri}>
        <Send className="size-4" aria-hidden="true" />
        Genera sollecito
      </Button>

      <Dialog
        aperto={aperto}
        onChiudi={() => setAperto(false)}
        bloccato={pending}
        titolo={`Sollecito per ${identificativo}`}
        descrizione="Scegli il tono, guarda l'anteprima e poi registra l'invio."
        larghezza="md"
      >
        <div className="flex flex-col gap-4">
          <Field
            id="sollecito_livello"
            label="Livello"
            hint={DESCRIZIONI_LIVELLO[livello]}
            required
          >
            <Select
              value={String(livello)}
              onChange={(e) => setLivello(Number(e.target.value) as LivelloSollecito)}
            >
              {LIVELLI_SOLLECITO.map((l) => (
                <option key={l} value={l}>
                  {ETICHETTE_LIVELLO[l]}
                  {l === livelloSuggerito ? " (suggerito)" : ""}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            id="sollecito_note"
            label="Nota interna"
            hint="Non compare nella lettera: serve a te per ricordare come è andata."
          >
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>

          {destinatariConAccount > 0 ? (
            <label
              htmlFor="sollecito_email"
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3"
            >
              <Checkbox
                id="sollecito_email"
                checked={inviaEmail}
                onChange={(e) => setInviaEmail(e.target.checked)}
                className="mt-0.5"
              />
              <span className="flex flex-col gap-1">
                <span className="text-sm font-medium">
                  Manda anche un avviso via email
                </span>
                <span className="text-xs leading-relaxed text-muted-foreground">
                  A {destinatariConAccount}{" "}
                  {destinatariConAccount === 1 ? "intestatario" : "intestatari"} con un account
                  sul portale. Chi ha disattivato questo tipo di avviso non lo riceve: il
                  sollecito resta comunque registrato.
                </span>
              </span>
            </label>
          ) : (
            <Alert tono="warning" titolo="Nessun destinatario raggiungibile via email">
              Nessun intestatario di questa unità ha un account sul portale. Scarica il PDF e
              recapitalo per posta o a mano.
            </Alert>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Button
              href={`/admin/solleciti/${unitaId}?livello=${livello}`}
              target="_blank"
              rel="noopener noreferrer"
              variant="ghost"
              size="sm"
            >
              <FileDown className="size-4" aria-hidden="true" />
              Anteprima PDF
            </Button>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() => setAperto(false)}
              >
                {esito ? "Chiudi" : "Annulla"}
              </Button>
              <Button pending={pending} disabled={Boolean(esito)} onClick={conferma}>
                {pending ? "Registrazione…" : "Registra il sollecito"}
              </Button>
            </div>
          </div>

          <FormError>{errore}</FormError>
          <FormSuccess>{esito}</FormSuccess>
        </div>
      </Dialog>
    </>
  );
}
