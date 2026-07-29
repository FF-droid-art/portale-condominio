"use client";

import { useActionState } from "react";
import { apriVotazione, chiudiVotazione } from "./actions";
import type { PuntoOdg } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge, StatoBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CerchioVotiLive } from "@/components/ui/cerchio-voti";
import { formatMillesimi } from "@/lib/format";

export function PuntoOdgCard({
  punto,
  assembleaId,
  condominioId,
  millesimiTotali,
}: {
  punto: PuntoOdg;
  assembleaId: string;
  condominioId: string;
  millesimiTotali: number;
}) {
  const [statoApri, azioneApri, pendingApri] = useActionState(apriVotazione, undefined);
  const [statoChiudi, azioneChiudi, pendingChiudi] = useActionState(chiudiVotazione, undefined);

  const nonAncoraAperta = punto.stato_votazione === "chiusa" && punto.esito === null;
  const votazioneConclusa = punto.stato_votazione === "chiusa" && punto.esito !== null;
  const votazioneAperta = punto.stato_votazione === "aperta";

  return (
    <Card className="gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            Punto {punto.numero_punto} · maggioranza {punto.tipo_maggioranza}
          </p>
          <p className="font-medium">{punto.descrizione}</p>
        </div>
        {votazioneConclusa ? (
          <StatoBadge tipo="esito" valore={punto.esito} />
        ) : (
          <StatoBadge tipo="stato_votazione" valore={punto.stato_votazione} />
        )}
      </div>

      {nonAncoraAperta && (
        <form action={azioneApri}>
          <input type="hidden" name="punto_id" value={punto.id} />
          <input type="hidden" name="assemblea_id" value={assembleaId} />
          <Button type="submit" size="sm" pending={pendingApri}>
            Apri votazione
          </Button>
        </form>
      )}

      {(votazioneAperta || votazioneConclusa) && (
        <div className="flex flex-wrap items-center gap-4 rounded-xl bg-surface-muted/50 p-4">
          <CerchioVotiLive
            puntoId={punto.id}
            millesimiTotali={millesimiTotali}
            tallyIniziale={{
              favorevole: votazioneConclusa ? punto.esito_favorevole ?? 0 : punto.tally_favorevole,
              contrario: votazioneConclusa ? punto.esito_contrario ?? 0 : punto.tally_contrario,
              astenuto: votazioneConclusa ? punto.esito_astenuto ?? 0 : punto.tally_astenuto,
            }}
            size={104}
          />

          <div className="flex flex-1 min-w-[180px] flex-col gap-2">
            {votazioneConclusa && (
              <Badge variant="accent" className="w-fit">
                Quorum edificio {formatMillesimi(punto.esito_quorum_totale ?? 0)}
              </Badge>
            )}

            {votazioneAperta && (
              <form action={azioneChiudi}>
                <input type="hidden" name="punto_id" value={punto.id} />
                <input type="hidden" name="assemblea_id" value={assembleaId} />
                <input type="hidden" name="condominio_id" value={condominioId} />
                <Button type="submit" size="sm" variant="secondary" pending={pendingChiudi}>
                  Chiudi votazione
                </Button>
              </form>
            )}
          </div>
        </div>
      )}

      {(statoApri?.errore || statoChiudi?.errore) && (
        <p className="text-sm text-danger">
          {statoApri?.errore ?? statoChiudi?.errore}
        </p>
      )}
    </Card>
  );
}
