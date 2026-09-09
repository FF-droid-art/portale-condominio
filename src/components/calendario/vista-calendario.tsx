import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Section } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { formatData } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  ETICHETTE_TIPO_EVENTO,
  NOMI_GIORNI_SETTIMANA,
  grigliaMese,
  nomeMese,
  prossimiEventi,
  raggruppaPerGiorno,
  spostaMese,
  type EventoCalendario,
  type TipoEventoCalendario,
} from "@/lib/calendario";

/**
 * Vista del calendario condominiale, identica per l'amministratore e per il
 * condòmino: cambia solo che cosa ci finisce dentro, e quello lo decidono le
 * pagine con le loro query.
 *
 * La navigazione tra i mesi è fatta di collegamenti e non di stato del client:
 * il mese sta nell'indirizzo, quindi una schermata si può mandare a qualcuno,
 * il tasto Indietro funziona e la pagina resta un componente server. Per una
 * vista di sola lettura non serve altro.
 */

const COLORE_TIPO: Record<TipoEventoCalendario, string> = {
  assemblea: "bg-accent",
  manutenzione: "bg-muted-foreground",
  prenotazione: "bg-success",
  scadenza_pagamento: "bg-warning",
};

export function VistaCalendario({
  eventi,
  mese,
  /** Indirizzo della pagina, a cui si aggiunge `?mese=`. */
  baseHref,
  oggi,
}: {
  eventi: EventoCalendario[];
  mese: string;
  baseHref: string;
  oggi: string;
}) {
  const perGiorno = raggruppaPerGiorno(eventi);
  const settimane = grigliaMese(mese);
  const prossimi = prossimiEventi(eventi, oggi, 12);

  return (
    <>
      <Section
        titolo={nomeMese(mese)}
        descrizione="Assemblee, manutenzioni programmate, prenotazioni degli spazi e scadenze di pagamento, tutte sulla stessa pagina."
        azioni={
          <div className="flex items-center gap-1">
            <Button
              href={`${baseHref}?mese=${spostaMese(mese, -1)}`}
              variant="ghost"
              size="sm"
              iconOnly
              aria-label={`Vai a ${nomeMese(spostaMese(mese, -1))}`}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button href={`${baseHref}?mese=${oggi.slice(0, 7)}`} variant="ghost" size="sm">
              Oggi
            </Button>
            <Button
              href={`${baseHref}?mese=${spostaMese(mese, 1)}`}
              variant="ghost"
              size="sm"
              iconOnly
              aria-label={`Vai a ${nomeMese(spostaMese(mese, 1))}`}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        }
      >
        <div className="scorrimento-sottile overflow-x-auto">
          <div className="min-w-[42rem]">
            <div className="grid grid-cols-7 gap-px border-b border-border pb-2">
              {NOMI_GIORNI_SETTIMANA.map((giorno) => (
                <div
                  key={giorno}
                  className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {giorno}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-px bg-border">
              {settimane.flat().map((giorno) => {
                const delGiorno = perGiorno.get(giorno.data) ?? [];
                const isOggi = giorno.data === oggi;
                return (
                  <div
                    key={giorno.data}
                    className={cn(
                      "flex min-h-24 flex-col gap-1 bg-surface p-1.5",
                      !giorno.nelMese && "bg-surface-muted/50"
                    )}
                  >
                    <span
                      className={cn(
                        "cifre self-start rounded-md px-1.5 text-xs font-medium",
                        isOggi
                          ? "bg-accent text-accent-foreground"
                          : giorno.nelMese
                            ? "text-foreground"
                            : "text-muted-foreground/60"
                      )}
                    >
                      {Number(giorno.data.slice(8, 10))}
                    </span>

                    {delGiorno.slice(0, 3).map((evento, i) => (
                      <VoceGiorno key={`${evento.data}-${i}`} evento={evento} />
                    ))}

                    {delGiorno.length > 3 && (
                      <span className="px-1 text-[0.6875rem] text-muted-foreground">
                        e altri {delGiorno.length - 3}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <Legenda />
      </Section>

      <Section
        titolo="Prossimi eventi"
        descrizione="Quello che viene, in ordine, senza dover cambiare mese."
      >
        {prossimi.length ? (
          <ul className="flex flex-col divide-y divide-border">
            {prossimi.map((evento, i) => (
              <li key={`${evento.data}-${i}`} className="py-3 first:pt-0 last:pb-0">
                <RigaEvento evento={evento} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            compatta
            icon={CalendarDays}
            title="Niente in programma"
            description="Non ci sono assemblee, manutenzioni, prenotazioni o scadenze da qui in avanti."
          />
        )}
      </Section>
    </>
  );
}

function VoceGiorno({ evento }: { evento: EventoCalendario }) {
  const contenuto = (
    <span className="flex items-center gap-1 truncate">
      <span
        className={cn("size-1.5 shrink-0 rounded-full", COLORE_TIPO[evento.tipo])}
        aria-hidden="true"
      />
      <span className="truncate">
        {evento.ora ? `${evento.ora} ` : ""}
        {evento.titolo}
      </span>
    </span>
  );

  const classi =
    "block rounded px-1 py-0.5 text-[0.6875rem] leading-tight text-muted-foreground";

  return evento.href ? (
    <Link
      href={evento.href}
      className={cn(classi, "transition-colors hover:bg-surface-muted hover:text-foreground")}
      title={`${ETICHETTE_TIPO_EVENTO[evento.tipo]}: ${evento.titolo}`}
    >
      {contenuto}
    </Link>
  ) : (
    <span className={classi} title={`${ETICHETTE_TIPO_EVENTO[evento.tipo]}: ${evento.titolo}`}>
      {contenuto}
    </span>
  );
}

function RigaEvento({ evento }: { evento: EventoCalendario }) {
  const contenuto = (
    <>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-medium">{evento.titolo}</span>
        <span className="text-xs text-muted-foreground">
          {formatData(evento.data)}
          {evento.ora ? ` · ${evento.ora}` : ""}
          {evento.sottotitolo ? ` · ${evento.sottotitolo}` : ""}
        </span>
      </span>
      <Badge variant="outline" punto className="shrink-0">
        {ETICHETTE_TIPO_EVENTO[evento.tipo]}
      </Badge>
    </>
  );

  return evento.href ? (
    <Link
      href={evento.href}
      className="flex flex-wrap items-center justify-between gap-3 rounded transition-colors hover:text-accent-ink"
    >
      {contenuto}
    </Link>
  ) : (
    <span className="flex flex-wrap items-center justify-between gap-3">{contenuto}</span>
  );
}

/** Il colore da solo non basta: la legenda dice che cosa significa ciascuno. */
function Legenda() {
  return (
    <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
      {(Object.keys(ETICHETTE_TIPO_EVENTO) as TipoEventoCalendario[]).map((tipo) => (
        <li key={tipo} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className={cn("size-1.5 shrink-0 rounded-full", COLORE_TIPO[tipo])}
            aria-hidden="true"
          />
          {ETICHETTE_TIPO_EVENTO[tipo]}
        </li>
      ))}
    </ul>
  );
}
