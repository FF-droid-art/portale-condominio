"use client";

import { useOptimistic, useState, useTransition } from "react";
import { UserCheck } from "lucide-react";
import { aggiornaPresenza } from "./actions";
import type { ModalitaPresenza } from "@/lib/types";
import { Card, CardHeader, CardHeaderText, CardTitle, CardDescription } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FormError } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMillesimi } from "@/lib/format";

export type RigaPresenza = {
  unitaId: string;
  identificativo: string;
  millesimi: number;
  /** null = assente. */
  modalita: ModalitaPresenza | null;
  /** Nome del delegato, se questa unità ha conferito delega. */
  delegataA: string | null;
};

const OPZIONI: { valore: "" | ModalitaPresenza; etichetta: string }[] = [
  { valore: "", etichetta: "Assente" },
  { valore: "presenza", etichetta: "In presenza" },
  { valore: "remoto", etichetta: "Da remoto" },
];

/**
 * Registro delle presenze: è il dato che manca al portale per calcolare il
 * quorum costitutivo, che altrimenti si potrebbe solo dedurre da chi ha già
 * votato (cioè troppo tardi, visto che il quorum va accertato prima).
 *
 * Le unità che hanno conferito delega non si segnano presenti: intervengono
 * automaticamente se il delegato è presente, così i loro millesimi non
 * vengono contati due volte.
 */
export function PresenzeCard({
  assembleaId,
  righe,
  modificabile,
}: {
  assembleaId: string;
  righe: RigaPresenza[];
  /** A seduta conclusa il registro resta consultabile ma non modificabile. */
  modificabile: boolean;
}) {
  const [errore, setErrore] = useState<string | undefined>();
  const [, startTransition] = useTransition();

  // In assemblea si spuntano dieci presenze di fila: il menu deve rispondere
  // subito e allinearsi dopo, non restare fermo sul valore precedente finché
  // il server non risponde.
  const [righeMostrate, applicaSubito] = useOptimistic(
    righe,
    (stato: RigaPresenza[], modifica: { unitaId: string; modalita: ModalitaPresenza | null }) =>
      stato.map((r) =>
        r.unitaId === modifica.unitaId ? { ...r, modalita: modifica.modalita } : r
      )
  );

  const presenti = righeMostrate.filter((r) => r.modalita).length;
  const delegate = righeMostrate.filter((r) => !r.modalita && r.delegataA).length;

  function cambia(unitaId: string, valore: string) {
    const modalita = valore ? (valore as ModalitaPresenza) : null;
    setErrore(undefined);
    startTransition(async () => {
      applicaSubito({ unitaId, modalita });
      const esito = await aggiornaPresenza({ assembleaId, unitaId, modalita });
      if (esito?.errore) setErrore(esito.errore);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardHeaderText>
          <CardTitle>Presenze</CardTitle>
          <CardDescription>
            {presenti === 0
              ? "Segna chi partecipa: il quorum costitutivo si calcola da qui."
              : `${presenti} ${presenti === 1 ? "unità presente" : "unità presenti"}${
                  delegate > 0 ? `, ${delegate} rappresentate per delega` : ""
                }.`}
          </CardDescription>
        </CardHeaderText>
      </CardHeader>

      {!righeMostrate.length ? (
        <EmptyState
          icon={UserCheck}
          compatta
          title="Nessuna unità nel condominio"
          description="Aggiungi le unità immobiliari al condominio per poter registrare le presenze."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {righeMostrate.map((riga) => (
            <li
              key={riga.unitaId}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5 first:pt-0 last:pb-0"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-medium">{riga.identificativo}</span>
                <span className="cifre text-xs text-muted-foreground">
                  {formatMillesimi(riga.millesimi)} millesimi
                </span>
              </div>

              {riga.delegataA && !riga.modalita ? (
                <Badge variant="accent">Delegata a {riga.delegataA}</Badge>
              ) : (
                <Select
                  aria-label={`Partecipazione di ${riga.identificativo}`}
                  dimensione="sm"
                  contenitoreClassName="w-auto"
                  className="w-auto min-w-36 text-sm"
                  value={riga.modalita ?? ""}
                  disabled={!modificabile}
                  onChange={(e) => cambia(riga.unitaId, e.target.value)}
                >
                  {OPZIONI.map((o) => (
                    <option key={o.valore} value={o.valore}>
                      {o.etichetta}
                    </option>
                  ))}
                </Select>
              )}
            </li>
          ))}
        </ul>
      )}

      <FormError className="mt-3">{errore}</FormError>
    </Card>
  );
}
