import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { formatMillesimi } from "@/lib/format";
import type { RisultatiSondaggio as DatiRisultati } from "@/lib/sondaggi";

/**
 * Esito di un sondaggio: una barra per opzione, con entrambe le letture —
 * quante unità hanno risposto così e quanti millesimi rappresentano.
 *
 * Mostrarle sempre tutte e due è deliberato: in un condominio le due
 * maggioranze possono divergere (poche unità grandi contro molte piccole), ed
 * è proprio quella divergenza il dato interessante prima di portare il tema in
 * assemblea. L'evidenza sull'opzione "in testa" segue il criterio scelto
 * dall'amministratore alla creazione.
 */
export function RisultatiSondaggio({
  risultati,
  ponderato,
  opzioneScelta,
}: {
  risultati: DatiRisultati;
  ponderato: boolean;
  /** Opzione votata dall'utente corrente, se ne ha votata una. */
  opzioneScelta?: string | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3.5">
        {risultati.opzioni.map((o) => {
          const percentuale = ponderato ? o.percentualeMillesimi : o.percentualeRisposte;
          return (
            <li key={o.id} className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <span className="truncate">{o.testo}</span>
                  {o.id === opzioneScelta && (
                    <Badge variant="accent">La tua risposta</Badge>
                  )}
                </span>
                <span className="cifre shrink-0 text-sm font-semibold tracking-tight">
                  {percentuale.toFixed(0)}%
                </span>
              </div>

              <div
                className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"
                role="progressbar"
                aria-valuenow={Math.round(percentuale)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${o.testo}: ${o.risposte} risposte, ${formatMillesimi(
                  o.millesimi
                )} millesimi`}
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-500",
                    o.inTesta ? "bg-accent" : "bg-border-strong"
                  )}
                  style={{ width: `${Math.min(percentuale, 100)}%` }}
                />
              </div>

              <span className="cifre text-xs text-muted-foreground">
                {o.risposte} {o.risposte === 1 ? "risposta" : "risposte"} ·{" "}
                {formatMillesimi(o.millesimi)} millesimi
              </span>
            </li>
          );
        })}
      </ul>

      <p className="border-t border-border pt-3 text-xs text-muted-foreground">
        Hanno risposto {risultati.risposteTotali}{" "}
        {risultati.risposteTotali === 1 ? "unità" : "unità"} (
        {risultati.partecipazioneUnita.toFixed(0)}% del totale), per{" "}
        {formatMillesimi(risultati.millesimiTotaliRisposte)} millesimi (
        {risultati.partecipazioneMillesimi.toFixed(0)}% dell&apos;edificio).{" "}
        {ponderato
          ? "L'opzione in evidenza è quella con più millesimi."
          : "L'opzione in evidenza è quella con più risposte."}
      </p>
    </div>
  );
}
