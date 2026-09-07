"use client";

import { useState, useTransition } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/input";
import { FormError } from "@/components/ui/alert";
import { generaRipartizioni } from "./actions";

/**
 * Genera la quota di ciascuna unità a partire dall'importo totale.
 *
 * Quando il condominio ha più tabelle millesimali la scelta di quale usare
 * viene prima del pulsante, non nascosta dietro di esso: è la decisione che
 * determina il risultato, e va presa consapevolmente.
 */
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
    <div className="flex w-full max-w-xs flex-col items-center gap-3">
      {tabelleMillesimali.length > 0 && (
        <Field
          id="tabella_millesimale"
          label="Ripartisci su"
          className="w-full text-left"
          hint="La tabella millesimale su cui calcolare le quote."
        >
          <Select value={tabellaId} onChange={(e) => setTabellaId(e.target.value)}>
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
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        {pending ? "Calcolo in corso…" : "Genera la ripartizione"}
      </Button>

      <FormError>{errore}</FormError>
    </div>
  );
}
