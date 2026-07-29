"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IndicatoreFasi } from "@/components/import/indicatore-fasi";
import { PassoCaricaFile } from "@/components/import/passo-carica-file";
import { PassoMappatura } from "@/components/import/passo-mappatura";
import { TabellaAnteprima } from "@/components/import/tabella-anteprima";
import { CAMPI_UNITA } from "@/lib/import/campi";
import { suggerisciMappatura } from "@/lib/import/mappatura";
import { costruisciRighe, type RigaGrezzaCostruita } from "@/lib/import/costruisci-righe";
import { validaRigaUnita } from "@/lib/import/validazione";
import type { FoglioAnalizzato, RigaImportUnita } from "@/lib/import/tipi";
import { importaUnita, type EsitoImportUnita } from "./actions";

type Fase = "carica" | "mappa" | "verifica" | "esito";
const INDICE_FASE: Record<Fase, 0 | 1 | 2 | 3> = { carica: 0, mappa: 1, verifica: 2, esito: 3 };

const CAMPI_OBBLIGATORI = CAMPI_UNITA.filter((c) => c.obbligatorio).map((c) => c.chiave);

function convertiRighe(dizionari: RigaGrezzaCostruita[]): RigaImportUnita[] {
  return dizionari.map((d) => ({
    identificativo: typeof d.identificativo === "string" ? d.identificativo : "",
    piano: (d.piano as string | null) ?? null,
    millesimi_proprieta:
      typeof d.millesimi_proprieta === "number" ? d.millesimi_proprieta : NaN,
  }));
}

export function ImportUnitaWizard({
  condomini,
}: {
  condomini: { id: string; nome: string }[];
}) {
  const [fase, setFase] = useState<Fase>("carica");
  const [condominioId, setCondominioId] = useState("");
  const [nomeFile, setNomeFile] = useState("");
  const [foglio, setFoglio] = useState<FoglioAnalizzato | null>(null);
  const [mappatura, setMappatura] = useState<Record<string, number | null>>({});
  const [esito, setEsito] = useState<EsitoImportUnita | null>(null);
  const [pending, startTransition] = useTransition();

  const righe = useMemo(() => {
    if (!foglio) return [];
    return convertiRighe(costruisciRighe(CAMPI_UNITA, mappatura, foglio.righe));
  }, [foglio, mappatura]);

  const erroriPerRiga = useMemo(() => righe.map((r) => validaRigaUnita(r)), [righe]);
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
      const risultato = await importaUnita(condominioId, righe, nomeFile);
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
          onCondominioChange={setCondominioId}
          onFileAnalizzato={(f, nome) => {
            setFoglio(f);
            setNomeFile(nome);
            setMappatura(suggerisciMappatura(f.intestazioni, CAMPI_UNITA));
            setFase("mappa");
          }}
        />
      )}

      {fase === "mappa" && foglio && (
        <div className="flex flex-col gap-4">
          <PassoMappatura
            campi={CAMPI_UNITA}
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
          <TabellaAnteprima
            colonne={[
              { chiave: "identificativo", etichetta: "Identificativo" },
              { chiave: "piano", etichetta: "Piano" },
              { chiave: "millesimi_proprieta", etichetta: "Millesimi" },
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
              <p>{esito.righeScritte} unità importate con successo.</p>
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
            {esito.ok && <Button href="/admin/condomini">Vai alle unità</Button>}
            <Button variant="secondary" onClick={riparti}>
              Importa un altro file
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
