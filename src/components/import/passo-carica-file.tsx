"use client";

import { useState } from "react";
import { FileUp, Table2 } from "lucide-react";
import { Field, Label, Select } from "@/components/ui/input";
import { FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
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
  const [trascinamento, setTrascinamento] = useState(false);

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

  async function processaFile(file: File) {
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

  async function gestisciFile(evento: React.ChangeEvent<HTMLInputElement>) {
    const file = evento.target.files?.[0];
    evento.target.value = "";
    if (!file) return;
    await processaFile(file);
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
    <div className="flex flex-col gap-5">
      {richiedeCondominio && (
        <Field
          id="condominio_id"
          label="Condominio di destinazione"
          required
          hint="Va scelto prima di caricare il file: le righe verranno importate qui."
        >
          <Select value={condominioId} onChange={(e) => onCondominioChange?.(e.target.value)}>
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="file">File da importare</Label>

        {/* L'etichetta è anche l'area di rilascio: il trascinamento è
            un'aggiunta, il clic continua a funzionare da solo. */}
        <label
          htmlFor="file"
          onDragOver={(e) => {
            if (!puoCaricare || analisiInCorso) return;
            e.preventDefault();
            setTrascinamento(true);
          }}
          onDragLeave={() => setTrascinamento(false)}
          onDrop={(e) => {
            if (!puoCaricare || analisiInCorso) return;
            e.preventDefault();
            setTrascinamento(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void processaFile(file);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center transition-colors",
            trascinamento
              ? "border-accent bg-accent-subtle"
              : "border-border-strong hover:border-muted-foreground/60 hover:bg-surface-muted/60",
            (!puoCaricare || analisiInCorso) && "pointer-events-none opacity-55"
          )}
          aria-disabled={!puoCaricare || analisiInCorso}
        >
          <span
            className="grid size-10 place-items-center rounded-xl bg-surface-muted text-muted-foreground"
            aria-hidden="true"
          >
            <FileUp className="size-5" />
          </span>
          <span className="text-sm font-medium">
            {analisiInCorso
              ? "Lettura del file in corso…"
              : nomeFile
                ? nomeFile
                : "Trascina qui il file o fai clic per sceglierlo"}
          </span>
          <span className="text-xs text-muted-foreground">Formati accettati: .xlsx e .csv</span>
        </label>

        <input
          id="file"
          type="file"
          accept=".xlsx,.csv"
          className="sr-only"
          disabled={!puoCaricare || analisiInCorso}
          onChange={gestisciFile}
        />

        {richiedeCondominio && !condominioId && (
          <p className="text-xs text-muted-foreground">
            Seleziona prima un condominio per poter caricare il file.
          </p>
        )}
      </div>

      {fileGrezzo && foglioScelto && (
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface-muted/40 p-4">
          <div className="flex items-start gap-2.5">
            <Table2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Abbiamo individuato l&apos;intestazione automaticamente. Controlla che foglio e riga
              siano quelli giusti prima di continuare.
            </p>
          </div>

          {fileGrezzo.fogli.length > 1 && (
            <Field id="foglio" label="Foglio">
              <Select
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

          <Field id="riga_intestazione" label="Riga con le intestazioni">
            <Select
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
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                Colonne rilevate ({intestazioniAnteprima.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {intestazioniAnteprima.map((intestazione, i) => (
                  <span
                    key={i}
                    className="rounded-md border border-border bg-surface px-2 py-0.5 text-xs"
                  >
                    {intestazione}
                  </span>
                ))}
              </div>
            </div>
          )}

          <Button
            className="w-fit"
            onClick={() => conferma(estraiFoglio(foglioScelto, rigaIntestazione), nomeFile)}
          >
            Usa questo foglio
          </Button>
        </div>
      )}

      <FormError>{errore}</FormError>
    </div>
  );
}
