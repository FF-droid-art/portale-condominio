"use client";

import { useMemo, useState, useTransition } from "react";
import { GuscioWizard, AzioniPasso, PannelloEsito } from "@/components/import/guscio-wizard";
import { Button } from "@/components/ui/button";
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

const TITOLI: Record<Fase, { titolo: string; descrizione?: string }> = {
  carica: {
    titolo: "Scegli il condominio e carica il file",
    descrizione:
      "Un file .xlsx o .csv con l'elenco delle unità: una riga per unità, con identificativo, piano e millesimi.",
  },
  mappa: {
    titolo: "Abbina le colonne",
    descrizione: "Dì al portale quale colonna del tuo file corrisponde a quale campo.",
  },
  verifica: {
    titolo: "Controlla le righe",
    descrizione:
      "Niente è ancora stato scritto. Se qualche riga ha un errore, correggi il file e ricaricalo.",
  },
  esito: { titolo: "Esito dell'importazione" },
};

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
    <GuscioWizard
      fase={INDICE_FASE[fase]}
      titoloPasso={TITOLI[fase].titolo}
      descrizionePasso={TITOLI[fase].descrizione}
    >
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
        <>
          <PassoMappatura
            campi={CAMPI_UNITA}
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
          <TabellaAnteprima
            colonne={[
              { chiave: "identificativo", etichetta: "Identificativo" },
              { chiave: "piano", etichetta: "Piano" },
              { chiave: "millesimi_proprieta", etichetta: "Millesimi" },
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
                <strong>{esito.righeScritte}</strong>{" "}
                {esito.righeScritte === 1 ? "unità importata" : "unità importate"}.
              </>
            ) : undefined
          }
          erroreGenerale={esito.ok ? undefined : esito.erroreGenerale}
          erroriRiga={esito.ok ? undefined : esito.erroriRiga}
          azioni={
            <>
              {esito.ok && <Button href="/admin/condomini">Vai ai condomìni</Button>}
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
