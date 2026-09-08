"use client";

import { useActionState, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Mail, PenLine, Plus, Trash2 } from "lucide-react";
import { aggiungiFirmatario, inviaRichiestaFirma, rimuoviFirmatario } from "./actions";
import { useAlSuccesso } from "@/lib/hooks";
import type { RuoloFirmatario } from "@/lib/types";
import { Card, CardHeader, CardHeaderText, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormGrid, Input, Select } from "@/components/ui/input";
import { Alert, FormError, FormSuccess } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDataOra } from "@/lib/format";
import { DISCLAIMER_FIRMA } from "@/lib/firma-otp";

export type Firmatario = {
  id: string;
  nominativo: string;
  email: string;
  ruolo: RuoloFirmatario;
  richiestaInviataIl: string | null;
  confermatoIl: string | null;
  /** Ha confermato una versione del verbale poi sostituita. */
  suVerbaleSuperato: boolean;
};

const ETICHETTA_RUOLO: Record<RuoloFirmatario, string> = {
  presidente: "Presidente",
  segretario: "Segretario",
  amministratore: "Amministratore",
  altro: "Altro",
};

/**
 * Conferma "leggera" del verbale: l'amministratore indica chi deve approvarlo
 * (di norma presidente e segretario), il portale invia a ciascuno un
 * collegamento personale e la conferma avviene digitando un codice
 * usa-e-getta ricevuto per email.
 *
 * È volutamente etichettata come NON equivalente a una firma elettronica
 * legale: vedi DISCLAIMER_FIRMA, ripetuto qui, nell'email e nella pagina di
 * conferma perché nessuno dei tre punti di contatto possa fraintenderla.
 */
export function FirmeVerbaleCard({
  assembleaId,
  firmatari,
  verbalePresente,
}: {
  assembleaId: string;
  firmatari: Firmatario[];
  verbalePresente: boolean;
}) {
  const [aperto, setAperto] = useState(false);
  const [stato, action, pending] = useActionState(aggiungiFirmatario, undefined);
  useAlSuccesso(pending, stato, () => setAperto(false));

  const [messaggio, setMessaggio] = useState<{ ok?: string; errore?: string }>({});
  const [inCorso, startTransition] = useTransition();

  function invia(firmaId: string, nominativo: string) {
    setMessaggio({});
    startTransition(async () => {
      const esito = await inviaRichiestaFirma(firmaId, assembleaId);
      setMessaggio(
        esito.errore ? { errore: esito.errore } : { ok: `Richiesta inviata a ${nominativo}.` }
      );
    });
  }

  function rimuovi(firmaId: string) {
    setMessaggio({});
    startTransition(async () => {
      const esito = await rimuoviFirmatario(firmaId, assembleaId);
      if (esito.errore) setMessaggio({ errore: esito.errore });
    });
  }

  const confermati = firmatari.filter((f) => f.confermatoIl).length;

  return (
    <Card>
      <CardHeader>
        <CardHeaderText>
          <CardTitle>Conferma del verbale</CardTitle>
          <CardDescription>
            {firmatari.length
              ? `${confermati} conferme su ${firmatari.length} richieste.`
              : "Chiedi a presidente e segretario di confermare il verbale via email."}
          </CardDescription>
        </CardHeaderText>
        <Button variant="secondary" size="sm" onClick={() => setAperto(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Aggiungi
        </Button>
      </CardHeader>

      {!verbalePresente && (
        <Alert tono="warning" className="mb-4">
          Genera o carica prima il verbale: senza un documento non c&apos;è nulla da confermare.
        </Alert>
      )}

      {!firmatari.length ? (
        <EmptyState
          icon={PenLine}
          compatta
          title="Nessun firmatario indicato"
          description="Aggiungi chi deve confermare il verbale: riceverà per email un collegamento personale."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {firmatari.map((f) => (
            <li
              key={f.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-medium">
                  {f.nominativo}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {ETICHETTA_RUOLO[f.ruolo]}
                  </span>
                </span>
                <span className="truncate text-xs text-muted-foreground">{f.email}</span>
                {f.confermatoIl ? (
                  <>
                    <span className="mt-1 flex items-center gap-1.5 text-xs font-medium text-success">
                      <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
                      Confermato il {formatDataOra(f.confermatoIl)}
                    </span>
                    {f.suVerbaleSuperato && (
                      <span className="mt-1 flex items-center gap-1.5 text-xs font-medium text-warning">
                        <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
                        La conferma riguarda una versione precedente del verbale
                      </span>
                    )}
                  </>
                ) : f.richiestaInviataIl ? (
                  <span className="mt-1 text-xs text-muted-foreground">
                    Richiesta inviata il {formatDataOra(f.richiestaInviataIl)}
                  </span>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {f.confermatoIl ? (
                  <Badge variant="success" punto>
                    Confermato
                  </Badge>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!verbalePresente || inCorso}
                    onClick={() => invia(f.id, f.nominativo)}
                  >
                    <Mail className="size-4" aria-hidden="true" />
                    {f.richiestaInviataIl ? "Rimanda" : "Invia richiesta"}
                  </Button>
                )}
                <Button
                  variant="ghost-danger"
                  size="sm"
                  iconOnly
                  disabled={inCorso}
                  aria-label={`Rimuovi ${f.nominativo} dai firmatari`}
                  onClick={() => rimuovi(f.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <FormSuccess className="mt-3">{messaggio.ok}</FormSuccess>
      <FormError className="mt-3">{messaggio.errore}</FormError>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{DISCLAIMER_FIRMA}</p>

      <Dialog
        aperto={aperto}
        onChiudi={() => setAperto(false)}
        bloccato={pending}
        titolo="Chi deve confermare il verbale"
        descrizione="Riceverà per email un collegamento personale da cui richiedere il codice di conferma."
        larghezza="md"
      >
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="assemblea_id" value={assembleaId} />
          <Field id="nominativo" label="Nominativo" required>
            <Input name="nominativo" placeholder="Es. Mario Bianchi" required />
          </Field>
          <FormGrid colonne={2}>
            <Field id="email" label="Email" required>
              <Input name="email" type="email" inputMode="email" required />
            </Field>
            <Field id="ruolo" label="Ruolo">
              <Select name="ruolo" defaultValue="presidente">
                {(Object.keys(ETICHETTA_RUOLO) as RuoloFirmatario[]).map((r) => (
                  <option key={r} value={r}>
                    {ETICHETTA_RUOLO[r]}
                  </option>
                ))}
              </Select>
            </Field>
          </FormGrid>
          <FormError>{stato?.errore}</FormError>
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setAperto(false)}>
              Annulla
            </Button>
            <Button type="submit" pending={pending}>
              {pending ? "Salvataggio…" : "Aggiungi firmatario"}
            </Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}
