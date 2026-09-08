"use client";

import { useActionState } from "react";
import { Lock, Play } from "lucide-react";
import { apriVotazione, chiudiVotazione } from "./actions";
import type { PuntoOdg } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge, StatoBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/alert";
import { CerchioVotiLive } from "@/components/ui/cerchio-voti";
import { formatMillesimi } from "@/lib/format";
import { etichettaMaggioranza, type Convocazione } from "@/lib/quorum";

export function PuntoOdgCard({
  punto,
  assembleaId,
  condominioId,
  millesimiTotali,
  convocazione,
  unitaTotali,
  unitaIntervenute,
}: {
  punto: PuntoOdg;
  assembleaId: string;
  condominioId: string;
  millesimiTotali: number;
  convocazione: Convocazione;
  unitaTotali: number;
  unitaIntervenute: number;
}) {
  const [statoApri, azioneApri, pendingApri] = useActionState(apriVotazione, undefined);
  const [statoChiudi, azioneChiudi, pendingChiudi] = useActionState(chiudiVotazione, undefined);

  const nonAncoraAperta = punto.stato_votazione === "chiusa" && punto.esito === null;
  const votazioneConclusa = punto.stato_votazione === "chiusa" && punto.esito !== null;
  const votazioneAperta = punto.stato_votazione === "aperta";

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Punto {punto.numero_punto} · {etichettaMaggioranza(punto.tipo_maggioranza)}
          </span>
          <h3 className="text-base font-semibold leading-snug text-pretty">{punto.descrizione}</h3>
        </div>
        {votazioneConclusa ? (
          <StatoBadge tipo="esito" valore={punto.esito} />
        ) : (
          <StatoBadge tipo="stato_votazione" valore={punto.stato_votazione} />
        )}
      </div>

      {nonAncoraAperta && (
        <form action={azioneApri} className="mt-4 flex flex-col items-start gap-1">
          <input type="hidden" name="punto_id" value={punto.id} />
          <input type="hidden" name="assemblea_id" value={assembleaId} />
          <Button type="submit" size="sm" pending={pendingApri}>
            <Play className="size-4" aria-hidden="true" />
            Apri la votazione
          </Button>
        </form>
      )}

      {(votazioneAperta || votazioneConclusa) && (
        <div className="mt-4 flex flex-col gap-5 rounded-xl border border-border bg-surface-muted/40 p-4 sm:flex-row sm:items-start sm:gap-6">
          <CerchioVotiLive
            puntoId={punto.id}
            millesimiTotali={millesimiTotali}
            tallyIniziale={{
              favorevole: votazioneConclusa ? punto.esito_favorevole ?? 0 : punto.tally_favorevole,
              contrario: votazioneConclusa ? punto.esito_contrario ?? 0 : punto.tally_contrario,
              astenuto: votazioneConclusa ? punto.esito_astenuto ?? 0 : punto.tally_astenuto,
              nFavorevole: punto.tally_n_favorevole,
              nContrario: punto.tally_n_contrario,
              nAstenuto: punto.tally_n_astenuto,
            }}
            quorum={{
              tipoMaggioranza: punto.tipo_maggioranza,
              convocazione,
              unitaTotali,
              unitaIntervenute,
            }}
            size={104}
          />

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            {votazioneConclusa && (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm text-muted-foreground">Quorum dell&apos;edificio</span>
                <Badge variant="accent" className="w-fit">
                  <span className="cifre">
                    {formatMillesimi(punto.esito_quorum_totale ?? 0)}
                  </span>{" "}
                  millesimi
                </Badge>
              </div>
            )}

            {votazioneAperta && (
              <form action={azioneChiudi} className="flex flex-col items-start gap-1">
                <input type="hidden" name="punto_id" value={punto.id} />
                <input type="hidden" name="assemblea_id" value={assembleaId} />
                <input type="hidden" name="condominio_id" value={condominioId} />
                <Button type="submit" size="sm" variant="secondary" pending={pendingChiudi}>
                  <Lock className="size-4" aria-hidden="true" />
                  Chiudi la votazione
                </Button>
                <p className="text-xs text-muted-foreground">
                  Alla chiusura l&apos;esito viene calcolato e non sarà più possibile votare.
                </p>
              </form>
            )}
          </div>
        </div>
      )}

      <FormError className="mt-3">{statoApri?.errore ?? statoChiudi?.errore}</FormError>
    </Card>
  );
}
