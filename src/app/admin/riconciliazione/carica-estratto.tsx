"use client";

import { useState, useTransition } from "react";
import { Upload } from "lucide-react";
import { Field, Input } from "@/components/ui/input";
import { Alert, FormError, FormSuccess } from "@/components/ui/alert";
import { importaEstrattoConto, type EsitoImportEstratto } from "./actions";

const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Caricamento dell'estratto conto.
 *
 * Il file viene letto qui e spedito al server come testo: l'analisi la fa il
 * server, così le regole di lettura del CSV sono le stesse per tutti e non
 * dipendono dal browser di chi carica. Al client resta solo il compito di
 * aprire il file, che è l'unica cosa che il server non può fare da solo.
 */
export function CaricaEstratto({ condominioId }: { condominioId: string }) {
  // Il campo file si svuota rimontandolo: assegnare `value` a un input di tipo
  // file non è consentito, e un ref qui servirebbe solo a questo.
  const [azzeramenti, setAzzeramenti] = useState(0);
  const [errore, setErrore] = useState<string | null>(null);
  const [esito, setEsito] = useState<EsitoImportEstratto | null>(null);
  const [pending, startTransition] = useTransition();

  function onFile(file: File | undefined) {
    setErrore(null);
    setEsito(null);
    if (!file) return;

    if (file.size > MAX_BYTES) {
      setErrore("Il file supera i 2MB: esporta un periodo più breve.");
      return;
    }

    startTransition(async () => {
      const testo = await file.text();
      const risultato = await importaEstrattoConto(condominioId, testo);
      if ("errore" in risultato) {
        setErrore(risultato.errore);
        return;
      }
      setEsito(risultato);
      setAzzeramenti((n) => n + 1);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Field
        id="estratto_file"
        label="File CSV dell'estratto conto"
        hint="Scaricalo dall'home banking. Servono almeno una colonna con la data e una con l'importo (o la coppia dare/avere); la causale serve per riconoscere chi ha pagato."
      >
        <Input
          key={azzeramenti}
          type="file"
          accept=".csv,text/csv"
          disabled={pending || !condominioId}
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </Field>

      {pending && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Upload className="size-4 animate-pulse" aria-hidden="true" />
          Lettura del file in corso…
        </p>
      )}

      <FormError>{errore}</FormError>

      {esito && "ok" in esito && (
        <div className="flex flex-col gap-2">
          <FormSuccess>
            {esito.importati > 0
              ? `${esito.importati} ${
                  esito.importati === 1 ? "movimento importato" : "movimenti importati"
                }${
                  esito.duplicati > 0
                    ? `, ${esito.duplicati} già presenti e saltati.`
                    : "."
                }`
              : `Nessun movimento nuovo: tutte le ${esito.letti} righe erano già state importate.`}
          </FormSuccess>

          <p className="text-xs text-muted-foreground">
            Colonne riconosciute — data: <strong>{esito.colonne.data ?? "—"}</strong>, importo:{" "}
            <strong>{esito.colonne.importo ?? "—"}</strong>, causale:{" "}
            <strong>{esito.colonne.descrizione ?? "nessuna"}</strong>. Se non sono quelle giuste,
            rinomina le intestazioni nel file e ricaricalo.
          </p>

          {esito.errori.length > 0 && (
            <Alert tono="warning" titolo={`${esito.errori.length} righe non lette`}>
              <ul className="mt-1 flex flex-col gap-0.5 text-xs">
                {esito.errori.slice(0, 5).map((e) => (
                  <li key={e.riga}>
                    Riga {e.riga}: {e.messaggio}
                  </li>
                ))}
                {esito.errori.length > 5 && <li>e altre {esito.errori.length - 5}.</li>}
              </ul>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}
