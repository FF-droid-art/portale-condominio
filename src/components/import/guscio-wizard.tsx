import { CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { IndicatoreFasi } from "@/components/import/indicatore-fasi";
import { cn } from "@/lib/cn";

/**
 * Cornice comune alle tre procedure di importazione.
 *
 * Le tre importazioni hanno campi e regole diverse ma la stessa struttura in
 * quattro passi: tenere identiche cornice, indicatore di avanzamento e
 * posizione dei pulsanti significa che chi ne ha imparata una le sa usare
 * tutte.
 */
export function GuscioWizard({
  fase,
  titoloPasso,
  descrizionePasso,
  children,
}: {
  fase: 0 | 1 | 2 | 3;
  titoloPasso: string;
  descrizionePasso?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card padding="none" className="overflow-hidden">
      <div className="border-b border-border bg-surface-muted/40 px-5 py-4 sm:px-6">
        <IndicatoreFasi fase={fase} />
      </div>

      <div className="flex flex-col gap-5 px-5 py-6 sm:px-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold tracking-tight">{titoloPasso}</h2>
          {descrizionePasso && (
            <p className="text-sm leading-relaxed text-muted-foreground">{descrizionePasso}</p>
          )}
        </div>
        {children}
      </div>
    </Card>
  );
}

/** Barra dei pulsanti in fondo a un passo: indietro a sinistra, avanti a destra. */
export function AzioniPasso({
  indietro,
  avanti,
  className,
}: {
  indietro?: React.ReactNode;
  avanti?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5",
        className
      )}
    >
      <div className="flex items-center gap-2">{indietro}</div>
      <div className="flex items-center gap-2">{avanti}</div>
    </div>
  );
}

/**
 * Esito finale dell'importazione: riuscita o fallita, con che cosa è stato
 * scritto oppure che cosa è andato storto, riga per riga.
 */
export function PannelloEsito({
  ok,
  titolo,
  dettaglio,
  erroreGenerale,
  erroriRiga,
  azioni,
}: {
  ok: boolean;
  titolo: string;
  dettaglio?: React.ReactNode;
  erroreGenerale?: string;
  erroriRiga?: { indice: number; messaggio: string }[];
  azioni: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div
        role="status"
        className={cn(
          "flex items-start gap-3 rounded-xl border px-4 py-4",
          ok ? "border-success/25 bg-success-bg" : "border-danger/25 bg-danger-bg"
        )}
      >
        {ok ? (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
        ) : (
          <XCircle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden="true" />
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <p className={cn("font-semibold", ok ? "text-success" : "text-danger")}>{titolo}</p>
          {dettaglio && (
            <div className="text-sm leading-relaxed text-foreground/80">{dettaglio}</div>
          )}
          {erroreGenerale && (
            <p className="text-sm leading-relaxed text-danger">{erroreGenerale}</p>
          )}
        </div>
      </div>

      {erroriRiga && erroriRiga.length > 0 && (
        <ul className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface-muted/40 p-4 text-sm">
          {erroriRiga.map((e) => (
            <li key={e.indice} className="flex gap-2">
              <span className="cifre shrink-0 font-medium text-muted-foreground">
                Riga {e.indice + 1}
              </span>
              <span className="text-danger">{e.messaggio}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">{azioni}</div>
    </div>
  );
}
