"use client";

import { useMemo, useState, useTransition } from "react";
import { GuscioWizard, AzioniPasso, PannelloEsito } from "@/components/import/guscio-wizard";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
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

const TITOLI: Record<Fase, { titolo: string; descrizione?: string }> = {
  carica: {
    titolo: "Scegli il condominio e carica il file",
    descrizione:
      "Un file .xlsx o .csv con una riga per ogni quota di unità su una spesa. Le unità devono già esistere nel condominio scelto.",
  },
  mappa: {
    titolo: "Abbina le colonne",
    descrizione: "Dì al portale quale colonna del tuo file corrisponde a quale campo.",
  },
  verifica: {
    titolo: "Controlla le righe",
    descrizione:
      "Niente è ancora stato scritto. Le righe che citano un'unità inesistente vanno corrette nel file.",
  },
  esito: { titolo: "Esito dell'importazione" },
};

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
    <GuscioWizard
      fase={INDICE_FASE[fase]}
      titoloPasso={TITOLI[fase].titolo}
      descrizionePasso={TITOLI[fase].descrizione}
    >
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
        <>
          <PassoMappatura
            campi={CAMPI_SPESE}
            intestazioni={foglio.intestazioni}
            righeGrezze={foglio.righe}
            mappatura={mappatura}
            onChange={setMappatura}
          />
          <AzioniPasso
            indietro={
              <Button variant="ghost" onClick={() => setFase("carica")}>
                Indietro
              </Button>
            }
            avanti={
              <Button disabled={!mappaturaCompleta} onClick={() => setFase("verifica")}>
                Continua
              </Button>
            }
          />
        </>
      )}

      {fase === "verifica" && (
        <>
          <Alert tono="info" titolo="Come vengono raggruppate le righe">
            Ogni riga è la quota di un&apos;unità su una spesa. Le righe con la stessa
            descrizione, categoria, data e fornitore vengono unite in un&apos;unica spesa, con le
            rispettive ripartizioni.
          </Alert>

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

          <AzioniPasso
            indietro={
              <Button variant="ghost" onClick={() => setFase("mappa")}>
                Indietro
              </Button>
            }
            avanti={
              <Button disabled={haErrori || pending} pending={pending} onClick={confermaImportazione}>
                Conferma importazione
              </Button>
            }
          />
        </>
      )}

      {fase === "esito" && esito && (
        <PannelloEsito
          ok={esito.ok}
          titolo={esito.ok ? "Importazione completata" : "Importazione non riuscita"}
          dettaglio={
            esito.ok ? (
              <>
                <strong>{esito.speseCreate}</strong>{" "}
                {esito.speseCreate === 1 ? "spesa creata" : "spese create"} e{" "}
                <strong>{esito.ripartizioniCreate}</strong>{" "}
                {esito.ripartizioniCreate === 1 ? "ripartizione" : "ripartizioni"} importate.
              </>
            ) : undefined
          }
          erroreGenerale={esito.ok ? undefined : esito.erroreGenerale}
          erroriRiga={esito.ok ? undefined : esito.erroriRiga}
          azioni={
            <>
              {esito.ok && <Button href="/admin/spese">Vai alle spese</Button>}
              <Button variant="secondary" onClick={riparti}>
                Importa un altro file
              </Button>
            </>
          }
        />
      )}
    </GuscioWizard>
  );
}
