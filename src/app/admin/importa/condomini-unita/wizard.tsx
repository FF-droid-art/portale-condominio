"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IndicatoreFasi } from "@/components/import/indicatore-fasi";
import { PassoCaricaFile } from "@/components/import/passo-carica-file";
import { PassoMappatura } from "@/components/import/passo-mappatura";
import { TabellaAnteprima } from "@/components/import/tabella-anteprima";
import { CAMPI_CONDOMINI_UNITA } from "@/lib/import/campi";
import { suggerisciMappatura } from "@/lib/import/mappatura";
import { costruisciRighe, type RigaGrezzaCostruita } from "@/lib/import/costruisci-righe";
import { preparaRighePersone, collassaUnita } from "@/lib/import/collassa";
import { colonneMillesimi } from "@/lib/import/millesimi";
import { coercisciNumero } from "@/lib/import/coercizione";
import { validaRigaCondominioUnita } from "@/lib/import/validazione";
import type {
  FoglioAnalizzato,
  RigaImportCondominioUnita,
  RigaMillesimo,
} from "@/lib/import/tipi";
import { importaCondominiUnita, type EsitoImportCondominiUnita } from "./actions";

// Costruisce i valori di millesimi (una entry per unità × colonna-millesimi)
// leggendo le colonne grezze direttamente dal foglio.
function costruisciMillesimi(
  foglio: FoglioAnalizzato,
  mappatura: Record<string, number | null>
): RigaMillesimo[] {
  const cols = colonneMillesimi(foglio.intestazioni);
  const iId = mappatura.identificativo;
  const iInd = mappatura.indirizzoCondominio;
  const iNome = mappatura.nomeCondominio;
  const out: RigaMillesimo[] = [];
  for (const riga of foglio.righe) {
    const identificativo = iId != null ? String(riga[iId] ?? "").trim() : "";
    if (!identificativo) continue;
    const indirizzo = iInd != null ? String(riga[iInd] ?? "").trim() : "";
    const nome = (iNome != null ? String(riga[iNome] ?? "").trim() : "") || indirizzo;
    for (const col of cols) {
      const valore = coercisciNumero(riga[col.indice]);
      if (valore != null) {
        out.push({
          nomeCondominio: nome,
          indirizzoCondominio: indirizzo,
          identificativo,
          nomeTabella: col.nome,
          valore,
        });
      }
    }
  }
  return out;
}

type Fase = "carica" | "mappa" | "verifica" | "esito";
const INDICE_FASE: Record<Fase, 0 | 1 | 2 | 3> = { carica: 0, mappa: 1, verifica: 2, esito: 3 };

const CAMPI_OBBLIGATORI = CAMPI_CONDOMINI_UNITA.filter((c) => c.obbligatorio).map((c) => c.chiave);

function convertiRighe(dizionari: RigaGrezzaCostruita[]): RigaImportCondominioUnita[] {
  return dizionari.map((d) => ({
    nomeCondominio: typeof d.nomeCondominio === "string" ? d.nomeCondominio : "",
    indirizzoCondominio: typeof d.indirizzoCondominio === "string" ? d.indirizzoCondominio : "",
    codiceFiscaleCondominio: (d.codiceFiscaleCondominio as string | null) ?? null,
    identificativo: typeof d.identificativo === "string" ? d.identificativo : "",
    piano: (d.piano as string | null) ?? null,
    millesimiProprieta: typeof d.millesimiProprieta === "number" ? d.millesimiProprieta : NaN,
    nominativo: (d.nominativo as string | null) ?? null,
    email: (d.email as string | null) ?? null,
    qualifica: (d.qualifica as string | null) ?? null,
    quota: typeof d.quota === "number" ? d.quota : NaN,
  }));
}

export function ImportCondominiUnitaWizard() {
  const [fase, setFase] = useState<Fase>("carica");
  const [nomeFile, setNomeFile] = useState("");
  const [foglio, setFoglio] = useState<FoglioAnalizzato | null>(null);
  const [mappatura, setMappatura] = useState<Record<string, number | null>>({});
  const [esito, setEsito] = useState<EsitoImportCondominiUnita | null>(null);
  const [pending, startTransition] = useTransition();

  const righe = useMemo(() => {
    if (!foglio) return [];
    const grezze = convertiRighe(costruisciRighe(CAMPI_CONDOMINI_UNITA, mappatura, foglio.righe));
    // Righe "per persona" (una per occupante): il nome è derivato
    // dall'indirizzo se assente, le righe di coda sono scartate. Il
    // raggruppamento in unità avviene lato database durante l'import.
    return preparaRighePersone(grezze);
  }, [foglio, mappatura]);

  const erroriPerRiga = useMemo(() => righe.map((r) => validaRigaCondominioUnita(r)), [righe]);
  const haErrori = erroriPerRiga.some(Boolean);
  const mappaturaCompleta = CAMPI_OBBLIGATORI.every((chiave) => mappatura[chiave] !== null);

  const condominiDistinti = useMemo(
    () => new Set(righe.map((r) => `${r.nomeCondominio}|${r.indirizzoCondominio}`)).size,
    [righe]
  );
  // Unità distinte (raggruppando le righe con più occupanti) e persone
  // distinte (per email o nominativo nello stesso condominio): solo per
  // mostrare i conteggi in anteprima.
  const unitaDistinte = useMemo(() => collassaUnita(righe).length, [righe]);
  const personeDistinte = useMemo(
    () =>
      new Set(
        righe
          .filter((r) => r.nominativo?.trim())
          .map((r) => `${r.nomeCondominio}|${(r.email ?? r.nominativo ?? "").toLowerCase()}`)
      ).size,
    [righe]
  );
  const millesimi = useMemo(
    () => (foglio ? costruisciMillesimi(foglio, mappatura) : []),
    [foglio, mappatura]
  );
  const tabelleMillesimi = useMemo(
    () => [...new Set(millesimi.map((m) => m.nomeTabella))],
    [millesimi]
  );

  function riparti() {
    setFase("carica");
    setFoglio(null);
    setMappatura({});
    setEsito(null);
  }

  function confermaImportazione() {
    startTransition(async () => {
      const risultato = await importaCondominiUnita(righe, millesimi, nomeFile);
      setEsito(risultato);
      setFase("esito");
    });
  }

  return (
    <Card className="flex flex-col gap-6">
      <IndicatoreFasi fase={INDICE_FASE[fase]} />

      {fase === "carica" && (
        <PassoCaricaFile
          onFileAnalizzato={(f, nome) => {
            setFoglio(f);
            setNomeFile(nome);
            setMappatura(suggerisciMappatura(f.intestazioni, CAMPI_CONDOMINI_UNITA));
            setFase("mappa");
          }}
        />
      )}

      {fase === "mappa" && foglio && (
        <div className="flex flex-col gap-4">
          <PassoMappatura
            campi={CAMPI_CONDOMINI_UNITA}
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
            {condominiDistinti} condomìni, {unitaDistinte} unità e {personeDistinte} persone
            individuati nel file. Le righe con stesso nome e indirizzo finiscono nello
            stesso condominio (riutilizzato se già esistente, altrimenti creato); le righe
            della stessa unità (più occupanti) vengono unite in un&apos;unica unità, e ogni
            persona viene collegata alla sua unità.
          </p>
          {tabelleMillesimi.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Tabelle millesimali rilevate: <b>{tabelleMillesimi.join(", ")}</b>.
            </p>
          )}
          <TabellaAnteprima
            colonne={[
              { chiave: "identificativo", etichetta: "Unità" },
              { chiave: "nominativo", etichetta: "Nominativo" },
              { chiave: "qualifica", etichetta: "Qualifica" },
              { chiave: "quota", etichetta: "Quota" },
              { chiave: "millesimiProprieta", etichetta: "Millesimi" },
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
                {esito.condominiCreati} condomìni creati, {esito.condominiRiusati} già
                esistenti riutilizzati, {esito.unitaCreate} unità importate,{" "}
                {esito.personeCreate} persone in anagrafica.
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
            {esito.ok && <Button href="/admin/condomini">Vai ai condomìni</Button>}
            <Button variant="secondary" onClick={riparti}>
              Importa un altro file
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
