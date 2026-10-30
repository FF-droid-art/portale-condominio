"use client";

import { useActionState } from "react";
import { Mail, Send } from "lucide-react";
import { inviaConvocazione } from "./actions";
import { FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatDataOra } from "@/lib/format";

/**
 * Rimanda la convocazione con il contenuto completo (luogo, link, ordine
 * del giorno inserito finora) e mostra l'esito dell'ultimo invio — non
 * solo "fatto"/"non fatto": FEAT-04 chiede che l'amministratore possa
 * accorgersi se qualche destinatario non l'ha ricevuta, non solo che un
 * invio sia partito.
 */
export function InviaConvocazione({
  assembleaId,
  ultimoInvio,
}: {
  assembleaId: string;
  ultimoInvio: {
    inviataIl: string | null;
    destinatari: number | null;
    consegnate: number | null;
  };
}) {
  const [stato, action, pending] = useActionState(inviaConvocazione, undefined);

  const haDestinatariMancati =
    ultimoInvio.destinatari != null &&
    ultimoInvio.consegnate != null &&
    ultimoInvio.consegnate < ultimoInvio.destinatari;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2.5 rounded-xl border border-border bg-surface-muted/50 px-4 py-3 text-sm">
        <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        {ultimoInvio.inviataIl ? (
          <span className="text-muted-foreground">
            Ultimo invio: <strong className="text-foreground">{formatDataOra(ultimoInvio.inviataIl)}</strong>,
            richiesta di invio riuscita per{" "}
            <strong className="text-foreground">
              {ultimoInvio.consegnate} di {ultimoInvio.destinatari}
            </strong>{" "}
            destinatari.
            {haDestinatariMancati && (
              <span className="text-warning">
                {" "}
                Per {ultimoInvio.destinatari! - ultimoInvio.consegnate!} non è stato possibile inviarla
                (preferenze di notifica disattivate o invio non riuscito): valuta un altro mezzo.
              </span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">
            Non è ancora stata rimandata con luogo, link e ordine del giorno completi: alla
            creazione dell&apos;assemblea è partita solo una notifica minima.
          </span>
        )}
      </div>

      <form action={action}>
        <input type="hidden" name="assemblea_id" value={assembleaId} />
        <FormError>{stato?.errore}</FormError>
        <Button type="submit" variant="secondary" pending={pending} className="mt-2 w-fit">
          <Send className="size-4" aria-hidden="true" />
          {pending ? "Invio…" : "Invia (o rimanda) la convocazione completa"}
        </Button>
      </form>
    </div>
  );
}
