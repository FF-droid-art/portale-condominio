"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Label, Select } from "@/components/ui/input";
import { generaRipartizioni } from "./actions";

export function GeneraRipartizioniButton({
  spesaId,
  condominioId,
  importoTotale,
  tabelleMillesimali,
}: {
  spesaId: string;
  condominioId: string;
  importoTotale: number;
  tabelleMillesimali: { id: string; nome: string }[];
}) {
  const [errore, setErrore] = useState<string | null>(null);
  const [tabellaId, setTabellaId] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-center gap-3">
      {tabelleMillesimali.length > 0 && (
        <Field className="w-64">
          <Label htmlFor="tabella_millesimale">Ripartisci su</Label>
          <Select
            id="tabella_millesimale"
            value={tabellaId}
            onChange={(e) => setTabellaId(e.target.value)}
          >
            <option value="">Millesimi generali</option>
            {tabelleMillesimali.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Button
        pending={pending}
        onClick={() =>
          startTransition(async () => {
            const risultato = await generaRipartizioni(
              spesaId,
              condominioId,
              importoTotale,
              tabellaId || null
            );
            setErrore(risultato.errore ?? null);
          })
        }
      >
        Genera ripartizione per unità
      </Button>
      {errore && <p className="text-sm text-danger">{errore}</p>}
    </div>
  );
}
