"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatMillesimi } from "@/lib/format";
import { calcolaQuorumDeliberativo, type Convocazione } from "@/lib/quorum";
import { DettaglioQuorum, EsitoQuorumBadge } from "@/components/ui/quorum";

export type Tally = {
  favorevole: number;
  contrario: number;
  astenuto: number;
  /** Numero di unità per scelta: serve alla "maggioranza degli intervenuti". */
  nFavorevole: number;
  nContrario: number;
  nAstenuto: number;
};

/** Dati non votati che servono a valutare il quorum deliberativo del punto. */
export type ContestoQuorumPunto = {
  tipoMaggioranza: string;
  convocazione: Convocazione;
  unitaTotali: number;
  unitaIntervenute: number;
};

/**
 * Cerchio che rappresenta i millesimi di proprietà: gli spicchi si colorano
 * di verde/rosso/grigio man mano che arrivano i voti, aggiornandosi da soli
 * via Supabase Realtime (nessun refresh pagina necessario).
 *
 * La legenda ripete ogni valore in millesimi accanto al colore: il grafico
 * dà il colpo d'occhio, i numeri restano leggibili anche a chi non
 * distingue le tinte o usa uno screen reader (l'immagine ha una
 * descrizione testuale completa).
 *
 * Con `quorum` valorizzato mostra anche se la maggioranza di legge richiesta
 * dal punto è già raggiunta: si appoggia alla stessa sottoscrizione realtime,
 * così il cerchio e il quorum non possono raccontare cose diverse.
 */
export function CerchioVotiLive({
  puntoId,
  millesimiTotali,
  tallyIniziale,
  quorum,
  size = 128,
}: {
  puntoId: string;
  millesimiTotali: number;
  tallyIniziale: Tally;
  quorum?: ContestoQuorumPunto;
  size?: number;
}) {
  const [tally, setTally] = useState<Tally>(tallyIniziale);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`punto-odg-${puntoId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "punti_odg", filter: `id=eq.${puntoId}` },
        (payload) => {
          const nuovo = payload.new as {
            tally_favorevole: number;
            tally_contrario: number;
            tally_astenuto: number;
            tally_n_favorevole: number;
            tally_n_contrario: number;
            tally_n_astenuto: number;
          };
          setTally({
            favorevole: nuovo.tally_favorevole,
            contrario: nuovo.tally_contrario,
            astenuto: nuovo.tally_astenuto,
            nFavorevole: nuovo.tally_n_favorevole,
            nContrario: nuovo.tally_n_contrario,
            nAstenuto: nuovo.tally_n_astenuto,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [puntoId]);

  const totale = millesimiTotali > 0 ? millesimiTotali : 1;
  const finoFavorevole = (tally.favorevole / totale) * 100;
  const finoContrario = finoFavorevole + (tally.contrario / totale) * 100;
  const finoAstenuto = finoContrario + (tally.astenuto / totale) * 100;
  const votantiPercentuale = finoAstenuto;

  const gradient = `conic-gradient(var(--success) 0% ${finoFavorevole}%, var(--danger) ${finoFavorevole}% ${finoContrario}%, var(--muted-foreground) ${finoContrario}% ${finoAstenuto}%, var(--surface-muted) ${finoAstenuto}% 100%)`;

  const voci = [
    { etichetta: "Favorevole", valore: tally.favorevole, colore: "bg-success" },
    { etichetta: "Contrario", valore: tally.contrario, colore: "bg-danger" },
    { etichetta: "Astenuto", valore: tally.astenuto, colore: "bg-muted-foreground" },
  ];

  const esitoQuorum = quorum
    ? calcolaQuorumDeliberativo({
        tipoMaggioranza: quorum.tipoMaggioranza,
        convocazione: quorum.convocazione,
        unitaTotali: quorum.unitaTotali,
        millesimiTotali,
        unitaIntervenute: quorum.unitaIntervenute,
        favorevoliUnita: tally.nFavorevole,
        favorevoliMillesimi: tally.favorevole,
      })
    : null;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex items-center gap-4">
        <div
          className="relative shrink-0 rounded-full transition-[background] duration-500 ease-out"
          style={{ width: size, height: size, background: gradient }}
          role="img"
          aria-label={`Favorevole ${formatMillesimi(tally.favorevole)}, contrario ${formatMillesimi(
            tally.contrario
          )}, astenuto ${formatMillesimi(tally.astenuto)} su ${formatMillesimi(millesimiTotali)} millesimi`}
        >
          <div className="absolute inset-[15%] flex flex-col items-center justify-center rounded-full bg-surface">
            <span className="cifre text-lg font-semibold leading-none tracking-tight">
              {votantiPercentuale.toFixed(0)}%
            </span>
            <span className="mt-1 text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
              votanti
            </span>
          </div>
        </div>

        <dl className="flex min-w-0 flex-col gap-2 text-xs">
          {voci.map((voce) => (
            <div key={voce.etichetta} className="flex items-center gap-2">
              <span className={`size-2.5 shrink-0 rounded-full ${voce.colore}`} aria-hidden="true" />
              <dt className="text-muted-foreground">{voce.etichetta}</dt>
              <dd className="cifre font-semibold">{formatMillesimi(voce.valore)}</dd>
            </div>
          ))}
        </dl>
      </div>

      {quorum && esitoQuorum && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              {esitoQuorum.etichetta}
            </span>
            {quorum.unitaIntervenute > 0 && (
              <EsitoQuorumBadge
                esito={esitoQuorum}
                etichettaRaggiunto="Maggioranza raggiunta"
                etichettaMancante="Maggioranza non raggiunta"
              />
            )}
          </div>

          {/* Senza intervenuti registrati la "maggioranza degli intervenuti"
              non ha una base su cui essere calcolata: dirlo è più utile che
              mostrare un "non raggiunta" che sembrerebbe colpa dei voti. */}
          {quorum.unitaIntervenute > 0 ? (
            <DettaglioQuorum
              esito={esitoQuorum}
              riferimento={esitoQuorum.riferimento}
              etichettaTeste="Unità favorevoli"
            />
          ) : (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Nessuna presenza registrata per questa assemblea: senza gli intervenuti la
              maggioranza di legge ({esitoQuorum.riferimento}) non è calcolabile.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
