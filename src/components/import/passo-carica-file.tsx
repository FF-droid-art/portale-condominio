"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { Field, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  analizzaFile,
  estraiFoglio,
  rilevaRigaIntestazione,
} from "@/lib/import/analizza-file";
import type { FileAnalizzato, FoglioAnalizzato } from "@/lib/import/tipi";

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

  // Quando il file ha più fogli o l'intestazione non è sulla prima riga
  // (tipico degli export gestionali, con righe-titolo iniziali), non si può
  // procedere automaticamente: si tiene il file "grezzo" in stato e si
  // chiede all'utente foglio e riga d'intestazione prima di andare avanti.
  const [fileGrezzo, setFileGrezzo] = useState<FileAnalizzato | null>(null);
  const [nomeFile, setNomeFile] = useState("");
  const [indiceFoglio, setIndiceFoglio] = useState(0);
  const [rigaIntestazione, setRigaIntestazione] = useState(0);

  // Il selettore condominio è opzionale: alcuni flussi (es. importazione
  // combinata condomini+unità) ricavano il condominio dal file stesso,
  // riga per riga, invece di farlo scegliere prima dell'upload.
  const richiedeCondominio = condomini !== undefined;
  const puoCaricare = !richiedeCondominio || Boolean(condominioId);

  function conferma(foglio: FoglioAnalizzato, nome: string) {
    if (!foglio.intestazioni.some((i) => i.trim())) {
      setErrore("Nessuna intestazione trovata: controlla il foglio e la riga scelti.");
      return;
    }
    onFileAnalizzato(foglio, nome);
  }

  async function gestisciFile(evento: React.ChangeEvent<HTMLInputElement>) {
    const file = evento.target.files?.[0];
    evento.target.value = "";
    if (!file) return;

    setErrore(null);
    setFileGrezzo(null);
    setAnalisiInCorso(true);
    try {
      const analizzato = await analizzaFile(file);
      const fogli = analizzato.fogli;
      if (!fogli.length || fogli.every((f) => f.righe.length === 0)) {
        setErrore("Il file sembra vuoto.");
        return;
      }

      const rigaRilevata = rilevaRigaIntestazione(fogli[0].righe);

      // Percorso rapido: un solo foglio e intestazione già sulla prima riga
      // → nessuna domanda, si prosegue come prima.
      if (fogli.length === 1 && rigaRilevata === 0) {
        conferma(estraiFoglio(fogli[0], 0), file.name);
        return;
      }

      // Altrimenti mostriamo i selettori, precompilati col rilevamento.
      setFileGrezzo(analizzato);
      setNomeFile(file.name);
      setIndiceFoglio(0);
      setRigaIntestazione(rigaRilevata);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Impossibile leggere il file.");
    } finally {
      setAnalisiInCorso(false);
    }
  }

  const foglioScelto = fileGrezzo?.fogli[indiceFoglio];

  function anteprimaRiga(righe: unknown[][], indice: number): string {
    return (righe[indice] ?? [])
      .map((v) => String(v ?? "").trim())
      .filter(Boolean)
      .slice(0, 6)
      .join(" · ");
  }

  const intestazioniAnteprima = foglioScelto
    ? estraiFoglio(foglioScelto, rigaIntestazione).intestazioni.filter((i) => i.trim())
    : [];

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
          {analisiInCorso
            ? "Lettura in corso…"
            : nomeFile
              ? nomeFile
              : "Trascina o scegli un file"}
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

      {fileGrezzo && foglioScelto && (
        <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">
            Abbiamo rilevato l&apos;intestazione automaticamente. Controlla che
            foglio e riga siano corretti prima di continuare.
          </p>

          {fileGrezzo.fogli.length > 1 && (
            <Field>
              <Label htmlFor="foglio">Foglio</Label>
              <Select
                id="foglio"
                value={indiceFoglio}
                onChange={(e) => {
                  const i = Number(e.target.value);
                  setIndiceFoglio(i);
                  setRigaIntestazione(rilevaRigaIntestazione(fileGrezzo.fogli[i].righe));
                }}
              >
                {fileGrezzo.fogli.map((f, i) => (
                  <option key={i} value={i}>
                    {f.nome} ({f.righe.length} righe)
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field>
            <Label htmlFor="riga_intestazione">Riga con le intestazioni</Label>
            <Select
              id="riga_intestazione"
              value={rigaIntestazione}
              onChange={(e) => setRigaIntestazione(Number(e.target.value))}
            >
              {foglioScelto.righe.slice(0, 12).map((_, i) => (
                <option key={i} value={i}>
                  Riga {i + 1}: {anteprimaRiga(foglioScelto.righe, i) || "(vuota)"}
                </option>
              ))}
            </Select>
          </Field>

          {intestazioniAnteprima.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Colonne rilevate ({intestazioniAnteprima.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {intestazioniAnteprima.map((intestazione, i) => (
                  <span
                    key={i}
                    className="rounded-md bg-surface-muted px-2 py-0.5 text-xs"
                  >
                    {intestazione}
                  </span>
                ))}
              </div>
            </div>
          )}

          <Button onClick={() => conferma(estraiFoglio(foglioScelto, rigaIntestazione), nomeFile)}>
            Usa questo foglio
          </Button>
        </div>
      )}

      {errore && <p className="text-sm text-danger">{errore}</p>}
    </div>
  );
}
