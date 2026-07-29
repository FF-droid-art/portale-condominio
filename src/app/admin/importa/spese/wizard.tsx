"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IndicatoreFasi } from "@/components/import/indicatore-fasi";
import { PassoCaricaFile } from "@/components/import/passo-carica-file";
import { PassoMappatura } from "@/components/import/passo-mappatura";
import { TabellaAnteprima } from "@/components/import/tabella-anteprima";
import { CAMPI_SPESE } from "@/lib/import/campi";
import { suggerisciMappatura } from "@/lib/import/mappatura";
import { costruisciRighe, type RigaGrezzaCostruita } from "@/lib/import/costruisci-righe";
import { validaRigaSpesa } from "@/lib/import/validazione";
import type { FoglioAnalizzato, RigaImportSpesa } from "@/lib/import/tipi";
import { elencaIdentificativiUnita, importaSpeseStoriche, type EsitoImportSpese } from "./actions";

type Fase = "carica" | "mappa" | "verifica" | "esito";
const INDICE_FASE: Record<Fase, 0 | 1 | 2 | 3> = { carica: 0, mappa: 1, verifica: 2, esito: 3 };

const CAMPI_OBBLIGATORI = CAMPI_SPESE.filter((c) => c.obbligatorio).map((c) => c.chiave);

function normalizzaStatoPagamento(valore: unknown): "da_pagare" | "pagato" | "in_ritardo" {
  const testo = typeof valore === "string" ? valore.trim().toLowerCase() : "";
  if (testo === "pagato") return "pagato";
  if (testo === "in_ritardo" || testo === "in ritardo") return "in_ritardo";
  return "da_pagare";
}

function convertiRighe(dizionari: RigaGrezzaCostruita[]): RigaImportSpesa[] {
  return dizionari.map((d) => ({
    identificativoUnita: typeof d.identificativoUnita === "string" ? d.identificativoUnita : "",
    descrizione: typeof d.descrizione === "string" ? d.descrizione : "",
    categoria: typeof d.categoria === "string" ? d.categoria : "",
    dataSpesa: typeof d.dataSpesa === "string" ? d.dataSpesa : "",
    importoDovuto: typeof d.importoDovuto === "number" ? d.importoDovuto : NaN,
    fornitore: (d.fornitore as string | null) ?? null,
    statoPagamento: normalizzaStatoPagamento(d.statoPagamento),
    dataScadenza: (d.dataScadenza as string | null) ?? null,
    dataPagamento: (d.dataPagamento as string | null) ?? null,
  }));
}

export function ImportSpeseWizard({
  condomini,
}: {
  condomini: { id: string; nome: string }[];
}) {
  const [fase, setFase] = useState<Fase>("carica");
  const [condominioId, setCondominioId] = useState("");
  const [nomeFile, setNomeFile] = useState("");
  const [foglio, setFoglio] = useState<FoglioAnalizzato | null>(null);
  const [mappatura, setMappatura] = useState<Record<string, number | null>>({});
  const [identificativiEsistenti, setIdentificativiEsistenti] = useState<string[]>([]);
  const [esito, setEsito] = useState<EsitoImportSpese | null>(null);
  const [pending, startTransition] = useTransition();

  const righe = useMemo(() => {
    if (!foglio) return [];
    return convertiRighe(costruisciRighe(CAMPI_SPESE, mappatura, foglio.righe));
  }, [foglio, mappatura]);

  const insiemeIdentificativi = useMemo(
    () => new Set(identificativiEsistenti),
    [identificativiEsistenti]
  );

  const erroriPerRiga = useMemo(
    () =>
      righe.map((r) => {
        const erroreBase = validaRigaSpesa(r);
        if (erroreBase) return erroreBase;
        if (!insiemeIdentificativi.has(r.identificativoUnita)) {
          return `Unità "${r.identificativoUnita}" non trovata in questo condominio (importala prima).`;
        }
        return null;
      }),
    [righe, insiemeIdentificativi]
  );
  const haErrori = erroriPerRiga.some(Boolean);
  const mappaturaCompleta = CAMPI_OBBLIGATORI.every((chiave) => mappatura[chiave] !== null);

  function riparti() {
    setFase("carica");
    setFoglio(null);
    setMappatura({});
    setEsito(null);
  }

  function confermaImportazione() {
    startTransition(async () => {
      const risultato = await importaSpeseStoriche(condominioId, righe, nomeFile);
      setEsito(risultato);
      setFase("esito");
    });
  }

  return (
    <Card className="flex flex-col gap-6">
      <IndicatoreFasi fase={INDICE_FASE[fase]} />

      {fase === "carica" && (
        <PassoCaricaFile
          condomini={condomini}
          condominioId={condominioId}
          onCondominioChange={(id) => {
            setCondominioId(id);
            startTransition(async () => {
              setIdentificativiEsistenti(await elencaIdentificativiUnita(id));
            });
          }}
          onFileAnalizzato={(f, nome) => {
            setFoglio(f);
            setNomeFile(nome);
            setMappatura(suggerisciMappatura(f.intestazioni, CAMPI_SPESE));
            setFase("mappa");
          }}
        />
      )}

      {fase === "mappa" && foglio && (
        <div className="flex flex-col gap-4">
          <PassoMappatura
            campi={CAMPI_SPESE}
            intestazioni={foglio.intestazioni}
            righeGrezze={foglio.righe}
            mappatura={mappatura}
            onChange={setMappatura}
          />
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setFase("carica")}>
              Indietro
            </Button>
            <Button disabled={!mappaturaCompleta} onClick={() => setFase("verifica")}>
              Continua
            </Button>
          </div>
        </div>
      )}

      {fase === "verifica" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Ogni riga rappresenta la quota di una unità per una spesa: righe con
            stessa descrizione, categoria, data e fornitore vengono raggruppate
            in un&apos;unica spesa.
          </p>
          <TabellaAnteprima
            colonne={[
              { chiave: "identificativoUnita", etichetta: "Unità" },
              { chiave: "descrizione", etichetta: "Descrizione" },
              { chiave: "categoria", etichetta: "Categoria" },
              { chiave: "dataSpesa", etichetta: "Data" },
              { chiave: "importoDovuto", etichetta: "Importo dovuto" },
            ]}
            righe={righe}
            erroriPerRiga={erroriPerRiga}
          />
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setFase("mappa")}>
              Indietro
            </Button>
            <Button disabled={haErrori || pending} pending={pending} onClick={confermaImportazione}>
              Conferma importazione
            </Button>
          </div>
        </div>
      )}

      {fase === "esito" && esito && (
        <div className="flex flex-col gap-4">
          {esito.ok ? (
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="size-5" />
              <p>
                {esito.speseCreate} spese e {esito.ripartizioniCreate} ripartizioni importate.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 text-danger text-sm">
              {esito.erroreGenerale && <p>{esito.erroreGenerale}</p>}
              {esito.erroriRiga?.map((e) => (
                <p key={e.indice}>
                  Riga {e.indice + 1}: {e.messaggio}
                </p>
              ))}
            </div>
          )}
          <div className="flex gap-3">
            {esito.ok && <Button href="/admin/spese">Vai alle spese</Button>}
            <Button variant="secondary" onClick={riparti}>
              Importa un altro file
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
