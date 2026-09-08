"use client";

import { useCallback, useEffect, useState } from "react";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { calcolaQuorumCostitutivo, type Convocazione } from "@/lib/quorum";
import { Card, CardHeader, CardHeaderText, CardTitle, CardDescription } from "@/components/ui/card";
import { DettaglioQuorum, DisclaimerQuorum, EsitoQuorumBadge } from "@/components/ui/quorum";
import { formatMillesimi } from "@/lib/format";

export type RiepilogoQuorum = {
  unita_totali: number;
  millesimi_totali: number;
  unita_intervenute: number;
  millesimi_intervenuti: number;
  unita_presenti: number;
  unita_rappresentate: number;
};

export const RIEPILOGO_VUOTO: RiepilogoQuorum = {
  unita_totali: 0,
  millesimi_totali: 0,
  unita_intervenute: 0,
  millesimi_intervenuti: 0,
  unita_presenti: 0,
  unita_rappresentate: 0,
};

/** Ogni quanto ricontrollare il quorum mentre l'assemblea è in corso. */
const INTERVALLO_MS = 15_000;

/**
 * Quorum costitutivo dell'assemblea, aggiornato mentre la seduta è in corso.
 *
 * I dati arrivano dalla funzione SQL assemblea_riepilogo_quorum, che
 * restituisce solo aggregati: un condomino non può leggere le unità né le
 * presenze altrui, ma deve poter vedere se l'assemblea è costituita. Il
 * ricalcolo è a intervallo invece che via realtime perché le presenze sono
 * visibili a ciascuno solo per le proprie unità, quindi un evento realtime non
 * arriverebbe comunque a tutti i partecipanti.
 *
 * Il valore iniziale arriva dal server e vive poi nello stato locale: quando
 * il server ne produce uno nuovo (dopo la registrazione di una presenza) la
 * pagina chiamante rimonta il componente cambiandogli `key`, invece di
 * riallineare lo stato dentro un effetto.
 */
export function QuorumCostitutivo({
  assembleaId,
  convocazione,
  riepilogoIniziale,
  aggiornaInAutomatico,
}: {
  assembleaId: string;
  convocazione: Convocazione;
  riepilogoIniziale: RiepilogoQuorum;
  /** Attivo solo con assemblea "in corso": a seduta conclusa il dato è fermo. */
  aggiornaInAutomatico: boolean;
}) {
  const [riepilogo, setRiepilogo] = useState(riepilogoIniziale);

  const ricarica = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .rpc("assemblea_riepilogo_quorum", { p_assemblea_id: assembleaId })
      .maybeSingle();
    if (data) setRiepilogo(data as RiepilogoQuorum);
  }, [assembleaId]);

  useEffect(() => {
    if (!aggiornaInAutomatico) return;
    const id = setInterval(ricarica, INTERVALLO_MS);
    return () => clearInterval(id);
  }, [aggiornaInAutomatico, ricarica]);

  const esito = calcolaQuorumCostitutivo({
    unitaTotali: riepilogo.unita_totali,
    millesimiTotali: riepilogo.millesimi_totali,
    unitaIntervenute: riepilogo.unita_intervenute,
    millesimiIntervenuti: riepilogo.millesimi_intervenuti,
    convocazione,
  });

  return (
    <Card>
      <CardHeader>
        <CardHeaderText>
          <CardTitle>Quorum costitutivo</CardTitle>
          <CardDescription>
            {convocazione === 1 ? "Prima convocazione" : "Seconda convocazione"} ·{" "}
            {riepilogo.unita_presenti}{" "}
            {riepilogo.unita_presenti === 1 ? "unità presente" : "unità presenti"}
            {riepilogo.unita_rappresentate > 0 &&
              ` e ${riepilogo.unita_rappresentate} per delega`}{" "}
            · {formatMillesimi(riepilogo.millesimi_intervenuti)} millesimi rappresentati
          </CardDescription>
        </CardHeaderText>
        <EsitoQuorumBadge
          esito={esito}
          etichettaRaggiunto="Assemblea costituita"
          etichettaMancante="Quorum non raggiunto"
        />
      </CardHeader>

      {riepilogo.unita_totali === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="size-4 shrink-0" aria-hidden="true" />
          Nessuna unità registrata in questo condominio: il quorum non è calcolabile.
        </p>
      ) : (
        <DettaglioQuorum
          esito={esito}
          riferimento={esito.riferimento}
          etichettaTeste="Unità intervenute"
        />
      )}

      <DisclaimerQuorum className="mt-4" />
    </Card>
  );
}
