"use client";

import { useMemo, useState, useTransition } from "react";
import { Building2, Home, Users } from "lucide-react";
import { GuscioWizard, AzioniPasso, PannelloEsito } from "@/components/import/guscio-wizard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
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
  // Esclude la colonna già mappata su millesimiProprieta: altrimenti
  // finirebbe due volte, come unita.millesimi_proprieta E come tabella
  // millesimale "Generali", duplicando lo stesso dato (vedi commento nello
  // schema: "Generale" è implicito in unita.millesimi_proprieta).
  const cols = colonneMillesimi(foglio.intestazioni).filter(
    (c) => c.indice !== mappatura.millesimiProprieta
  );
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

const TITOLI: Record<Fase, { titolo: string; descrizione?: string }> = {
  carica: {
    titolo: "Carica il file",
    descrizione:
      "Un file .xlsx o .csv con una riga per ogni unità e le colonne del condominio (nome, indirizzo) ripetute su ogni riga.",
  },
  mappa: {
    titolo: "Abbina le colonne",
    descrizione: "Dì al portale quale colonna del tuo file corrisponde a quale campo.",
  },
  verifica: {
    titolo: "Controlla che cosa verrà creato",
    descrizione:
      "Niente è ancora stato scritto. Se qualche riga ha un errore, correggi il file e ricaricalo.",
  },
  esito: { titolo: "Esito dell'importazione" },
};

const CAMPI_OBBLIGATORI = CAMPI_CONDOMINI_UNITA.filter((c) => c.obbligatorio).map((c) => c.chiave);

// Alcuni gestionali esportano la quota di comproprietà come frazione
// (0-1, es. 1/3 = 0.333...) invece che come percentuale (0-100), che è
// invece ciò che il DB si aspetta (quota_possesso, 0-100). Se il valore è
// nell'intervallo (0, 1] lo trattiamo come frazione e lo convertiamo.
function normalizzaQuotaPercentuale(valore: number): number {
  return valore > 0 && valore <= 1 ? valore * 100 : valore;
}

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
    quota: typeof d.quota === "number" ? normalizzaQuotaPercentuale(d.quota) : NaN,
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
    <GuscioWizard
      fase={INDICE_FASE[fase]}
      titoloPasso={TITOLI[fase].titolo}
      descrizionePasso={TITOLI[fase].descrizione}
    >
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
        <>
          <PassoMappatura
            campi={CAMPI_CONDOMINI_UNITA}
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
          {/* Il riepilogo dei conteggi viene prima della tabella: è la
              risposta alla domanda "che cosa sto per creare?", che si pone
              prima di mettersi a controllare riga per riga. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <RiepilogoConteggio
              icon={Building2}
              valore={condominiDistinti}
              etichetta={condominiDistinti === 1 ? "condominio" : "condomìni"}
            />
            <RiepilogoConteggio
              icon={Home}
              valore={unitaDistinte}
              etichetta={unitaDistinte === 1 ? "unità" : "unità"}
            />
            <RiepilogoConteggio
              icon={Users}
              valore={personeDistinte}
              etichetta={personeDistinte === 1 ? "persona" : "persone"}
            />
          </div>

          <Alert tono="info" titolo="Come vengono raggruppate le righe">
            Le righe con lo stesso nome e indirizzo finiscono nello stesso condominio, che viene
            riutilizzato se esiste già e creato altrimenti. Le righe della stessa unità con più
            occupanti vengono unite in un&apos;unica unità, e ogni persona viene collegata alla sua.
          </Alert>

          {tabelleMillesimi.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Tabelle millesimali rilevate:</span>
              {tabelleMillesimi.map((nome) => (
                <Badge key={nome} variant="accent">
                  {nome}
                </Badge>
              ))}
            </div>
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
                <strong>{esito.condominiCreati}</strong>{" "}
                {esito.condominiCreati === 1 ? "condominio creato" : "condomìni creati"},{" "}
                <strong>{esito.condominiRiusati}</strong> già esistenti riutilizzati,{" "}
                <strong>{esito.unitaCreate}</strong>{" "}
                {esito.unitaCreate === 1 ? "unità importata" : "unità importate"},{" "}
                <strong>{esito.personeCreate}</strong>{" "}
                {esito.personeCreate === 1 ? "persona" : "persone"} in anagrafica.
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

function RiepilogoConteggio({
  icon: Icona,
  valore,
  etichetta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  valore: number;
  etichetta: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-muted/40 px-4 py-3">
      <span
        className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface text-muted-foreground"
        aria-hidden="true"
      >
        <Icona className="size-4" />
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="cifre text-lg font-semibold tracking-tight">{valore}</span>
        <span className="text-xs text-muted-foreground">{etichetta}</span>
      </span>
    </div>
  );
}
