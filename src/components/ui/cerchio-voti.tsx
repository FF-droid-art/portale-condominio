"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatMillesimi } from "@/lib/format";

type Tally = { favorevole: number; contrario: number; astenuto: number };

/**
 * Cerchio che rappresenta i millesimi di proprietà: gli spicchi si colorano
 * di verde/rosso/grigio man mano che arrivano i voti, aggiornandosi da soli
 * via Supabase Realtime (nessun refresh pagina necessario).
 */
export function CerchioVotiLive({
  puntoId,
  millesimiTotali,
  tallyIniziale,
  size = 128,
}: {
  puntoId: string;
  millesimiTotali: number;
  tallyIniziale: Tally;
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
          };
          setTally({
            favorevole: nuovo.tally_favorevole,
            contrario: nuovo.tally_contrario,
            astenuto: nuovo.tally_astenuto,
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

  return (
    <div className="flex items-center gap-4">
      <div
        className="relative shrink-0 rounded-full transition-[background] duration-500 ease-out"
        style={{ width: size, height: size, background: gradient }}
        role="img"
        aria-label={`Favorevole ${formatMillesimi(tally.favorevole)}, contrario ${formatMillesimi(
          tally.contrario
        )}, astenuto ${formatMillesimi(tally.astenuto)} su ${formatMillesimi(millesimiTotali)} millesimi`}
      >
        <div className="absolute inset-[16%] flex flex-col items-center justify-center rounded-full bg-surface">
          <span className="text-base font-semibold leading-none">
            {votantiPercentuale.toFixed(0)}%
          </span>
          <span className="mt-1 text-[10px] text-muted-foreground">votanti</span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 shrink-0 rounded-full bg-success" />
          Favorevole {formatMillesimi(tally.favorevole)}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 shrink-0 rounded-full bg-danger" />
          Contrario {formatMillesimi(tally.contrario)}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 shrink-0 rounded-full bg-muted-foreground" />
          Astenuto {formatMillesimi(tally.astenuto)}
        </span>
      </div>
    </div>
  );
}
