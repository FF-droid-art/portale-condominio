"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Scelta dell'anno e scaricamento del rendiconto.
 *
 * È un componente client per una sola ragione: l'indirizzo del PDF cambia con
 * l'anno scelto, e un collegamento deve poterlo seguire in una scheda nuova —
 * cosa che un modulo inviato al server non farebbe.
 */
export function ScaricaRendiconto({
  condominioId,
  anni,
}: {
  condominioId: string;
  /** Anni per cui esistono movimenti, dal più recente. */
  anni: number[];
}) {
  const [anno, setAnno] = useState(String(anni[0] ?? new Date().getFullYear()));

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Select
        aria-label="Anno del rendiconto"
        value={anno}
        onChange={(e) => setAnno(e.target.value)}
        dimensione="sm"
        contenitoreClassName="w-28"
      >
        {anni.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </Select>
      <Button
        href={`/admin/condomini/${condominioId}/rendiconto?anno=${anno}`}
        target="_blank"
        rel="noopener noreferrer"
        variant="secondary"
        size="sm"
      >
        <FileDown className="size-4" aria-hidden="true" />
        Scarica il rendiconto
      </Button>
    </div>
  );
}
