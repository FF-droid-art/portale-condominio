import { Info } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { formatMillesimi } from "@/lib/format";
import { DISCLAIMER_QUORUM, type ComponenteQuorum, type EsitoQuorum } from "@/lib/quorum";

/**
 * Rappresentazione di un quorum: due condizioni che devono valere insieme
 * (teste e millesimi), ciascuna con quanto si è raggiunto e quanto serve.
 *
 * Il "raggiunto/non raggiunto" non è affidato al solo colore: c'è sempre
 * l'etichetta testuale e, sotto, i numeri per esteso — chi deve verbalizzare
 * ha bisogno del numero, non dell'impressione.
 */

function BarraQuorum({
  etichetta,
  componente,
  formato,
  unita,
}: {
  etichetta: string;
  componente: ComponenteQuorum;
  formato: (n: number) => string;
  unita?: string;
}) {
  const percentuale =
    componente.richiesto > 0
      ? Math.min((componente.valore / componente.richiesto) * 100, 100)
      : 0;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-xs font-medium text-muted-foreground">{etichetta}</span>
        <span className="cifre text-sm font-semibold tracking-tight">
          {formato(componente.valore)}
          <span className="text-xs font-normal text-muted-foreground">
            {" / "}
            {formato(componente.richiesto)}
            {unita ? ` ${unita}` : ""}
          </span>
        </span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted"
        role="progressbar"
        aria-valuenow={Math.round(percentuale)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${etichetta}: ${formato(componente.valore)} su ${formato(
          componente.richiesto
        )} necessari`}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            componente.raggiunto ? "bg-success" : "bg-warning"
          )}
          style={{ width: `${percentuale}%` }}
        />
      </div>
    </div>
  );
}

export function EsitoQuorumBadge({
  esito,
  etichettaRaggiunto = "Raggiunto",
  etichettaMancante = "Non raggiunto",
}: {
  esito: { raggiunto: boolean };
  etichettaRaggiunto?: string;
  etichettaMancante?: string;
}) {
  return (
    <Badge variant={esito.raggiunto ? "success" : "warning"} punto>
      {esito.raggiunto ? etichettaRaggiunto : etichettaMancante}
    </Badge>
  );
}

/** Le due barre (teste e millesimi) di un quorum, con il riferimento di legge. */
export function DettaglioQuorum({
  esito,
  riferimento,
  etichettaTeste,
  className,
}: {
  esito: EsitoQuorum;
  riferimento?: string;
  /** Es. "Unità intervenute" oppure "Unità favorevoli". */
  etichettaTeste: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <BarraQuorum
        etichetta={etichettaTeste}
        componente={esito.teste}
        formato={(n) => String(Math.round(n))}
      />
      <BarraQuorum
        etichetta="Millesimi"
        componente={esito.millesimi}
        formato={formatMillesimi}
      />
      {riferimento && (
        <p className="text-xs text-muted-foreground">Soglia di legge: {riferimento}</p>
      )}
    </div>
  );
}

/** Avvertenza da mostrare una sola volta per pagina, sotto ai calcoli. */
export function DisclaimerQuorum({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 text-xs leading-relaxed text-muted-foreground",
        className
      )}
    >
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>{DISCLAIMER_QUORUM}</span>
    </p>
  );
}
