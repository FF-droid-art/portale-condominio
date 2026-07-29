"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { Field, Label, Select } from "@/components/ui/input";
import { analizzaFile } from "@/lib/import/analizza-file";
import type { FoglioAnalizzato } from "@/lib/import/tipi";

export function PassoCaricaFile({
  condomini,
  condominioId,
  onCondominioChange,
  onFileAnalizzato,
}: {
  condomini?: { id: string; nome: string }[];
  condominioId?: string;
  onCondominioChange?: (id: string) => void;
  onFileAnalizzato: (foglio: FoglioAnalizzato, nomeFile: string) => void;
}) {
  const [analisiInCorso, setAnalisiInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  // Il selettore condominio è opzionale: alcuni flussi (es. importazione
  // combinata condomini+unità) ricavano il condominio dal file stesso,
  // riga per riga, invece di farlo scegliere prima dell'upload.
  const richiedeCondominio = condomini !== undefined;
  const puoCaricare = !richiedeCondominio || Boolean(condominioId);

  async function gestisciFile(evento: React.ChangeEvent<HTMLInputElement>) {
    const file = evento.target.files?.[0];
    evento.target.value = "";
    if (!file) return;

    setErrore(null);
    setAnalisiInCorso(true);
    try {
      const foglio = await analizzaFile(file);
      if (!foglio.intestazioni.length) {
        setErrore("Il file sembra vuoto: nessuna intestazione trovata.");
        return;
      }
      onFileAnalizzato(foglio, file.name);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Impossibile leggere il file.");
    } finally {
      setAnalisiInCorso(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {richiedeCondominio && (
        <Field>
          <Label htmlFor="condominio_id">Condominio</Label>
          <Select
            id="condominio_id"
            value={condominioId}
            onChange={(e) => onCondominioChange?.(e.target.value)}
          >
            <option value="" disabled>
              Seleziona condominio
            </option>
            {condomini?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field>
        <Label htmlFor="file">File (.xlsx o .csv)</Label>
        <label
          htmlFor="file"
          className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong px-4 py-8 text-sm text-muted-foreground hover:bg-surface-muted transition-colors aria-disabled:pointer-events-none aria-disabled:opacity-50"
          aria-disabled={!puoCaricare || analisiInCorso}
        >
          <Upload className="size-4" />
          {analisiInCorso ? "Lettura in corso…" : "Trascina o scegli un file"}
        </label>
        <input
          id="file"
          type="file"
          accept=".xlsx,.csv"
          className="sr-only"
          disabled={!puoCaricare || analisiInCorso}
          onChange={gestisciFile}
        />
      </Field>

      {richiedeCondominio && !condominioId && (
        <p className="text-sm text-muted-foreground">
          Seleziona prima un condominio.
        </p>
      )}
      {errore && <p className="text-sm text-danger">{errore}</p>}
    </div>
  );
}
