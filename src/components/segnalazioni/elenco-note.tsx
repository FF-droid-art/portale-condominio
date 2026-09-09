import { Lock, MessageSquare } from "lucide-react";
import { formatDataOra } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export type NotaSegnalazione = {
  id: string;
  testo: string;
  interna: boolean;
  created_at: string;
  autore_id: string;
  autore: { nome: string; cognome: string } | null;
};

/**
 * Cronologia di una segnalazione.
 *
 * Sul nome dell'autore: la RLS della tabella "utenti" non permette a un
 * condòmino di leggere la riga dell'amministratore, quindi per lui il join
 * torna vuoto. Invece di mostrare un trattino, il nome viene dedotto dal
 * confronto con l'amministratore del condominio (che il condòmino può leggere):
 * la nota resta attribuita correttamente senza allargare la visibilità dei dati
 * personali.
 */
export function ElencoNote({
  note,
  utenteCorrenteId,
  amministratoreId,
}: {
  note: NotaSegnalazione[];
  utenteCorrenteId: string;
  amministratoreId?: string | null;
}) {
  if (!note.length) {
    return (
      <EmptyState
        compatta
        icon={MessageSquare}
        title="Nessun aggiornamento"
        description="Gli aggiornamenti e le risposte compariranno qui, in ordine di arrivo."
      />
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {note.map((nota) => {
        const mia = nota.autore_id === utenteCorrenteId;
        const nome = nota.autore
          ? `${nota.autore.nome} ${nota.autore.cognome}`
          : nota.autore_id === amministratoreId
            ? "Amministratore"
            : "Utente del condominio";

        return (
          <li
            key={nota.id}
            className={
              nota.interna
                ? "flex flex-col gap-1.5 rounded-xl border border-dashed border-warning/40 bg-warning-bg/40 px-4 py-3"
                : "flex flex-col gap-1.5 rounded-xl border border-border bg-surface px-4 py-3"
            }
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-medium">{mia ? "Tu" : nome}</span>
              <span className="cifre text-xs text-muted-foreground">
                {formatDataOra(nota.created_at)}
              </span>
              {nota.interna && (
                <Badge variant="warning">
                  <Lock className="size-3" aria-hidden="true" />
                  Nota interna
                </Badge>
              )}
            </div>
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {nota.testo}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
