"use client";

import { useState } from "react";
import { Archive } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Alert, FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Esportazione completa dei dati di un condominio (CONT-02).
 *
 * PERCHÉ UN DIALOGO E NON UN SEMPLICE COLLEGAMENTO. Gli altri scaricamenti del
 * portale (rendiconto, verbale, sollecito) sono `<Button href>` e basta,
 * perché producono un documento in un attimo. Questo no, per due motivi.
 *
 * Il primo è il tempo: l'archivio raccoglie una ventina di tabelle e scarica
 * tutti i documenti caricati per il condominio, quindi su uno stabile con anni
 * di storia può richiedere qualche secondo. Un collegamento che non dà segni
 * di vita si clicca due o tre volte, e ogni clic rifà tutto il lavoro.
 *
 * Il secondo è il contenuto: nell'archivio ci sono codici fiscali, residenze e
 * posizioni di morosità di tutti i condòmini. Prima di produrne una copia che
 * finirà in una cartella di download, vale la pena dirlo.
 *
 * PERCHÉ `fetch` E NON UN LINK. Serve lo stato di attesa, e per averlo bisogna
 * sapere quando la risposta è arrivata: un `<a download>` non lo dice. Il
 * nome del file arriva dall'intestazione `Content-Disposition` della risposta,
 * così resta deciso dal server (che conosce nome del condominio e data) e non
 * duplicato qui.
 */

function nomeDaIntestazione(intestazione: string | null): string {
  const corrispondenza = intestazione?.match(/filename="([^"]+)"/);
  return corrispondenza?.[1] ?? "esportazione-condominio.zip";
}

export function EsportaDatiButton({ id, nome }: { id: string; nome: string }) {
  const [aperto, setAperto] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  function apri() {
    setErrore(null);
    setAperto(true);
  }

  async function esporta() {
    setErrore(null);
    setInCorso(true);
    try {
      const risposta = await fetch(`/admin/condomini/${id}/esportazione`);
      if (!risposta.ok) {
        // La route risponde con un messaggio applicativo, non col dettaglio
        // del database: si può mostrare così com'è.
        const corpo = (await risposta.json().catch(() => null)) as { errore?: string } | null;
        setErrore(corpo?.errore ?? "Esportazione non riuscita. Riprova.");
        return;
      }

      const blob = await risposta.blob();
      const indirizzo = URL.createObjectURL(blob);
      const collegamento = document.createElement("a");
      collegamento.href = indirizzo;
      collegamento.download = nomeDaIntestazione(risposta.headers.get("content-disposition"));
      collegamento.click();
      URL.revokeObjectURL(indirizzo);
      setAperto(false);
    } catch {
      setErrore("Esportazione non riuscita: connessione interrotta. Riprova.");
    } finally {
      setInCorso(false);
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={apri}>
        <Archive className="size-4" aria-hidden="true" />
        Esporta dati completi
      </Button>

      <Dialog
        aperto={aperto}
        onChiudi={() => setAperto(false)}
        bloccato={inCorso}
        titolo="Esportare tutti i dati del condominio?"
        descrizione={`Scarichi un archivio .zip con tutto quanto il portale conserva su "${nome}".`}
        footer={
          <>
            <Button variant="ghost" disabled={inCorso} onClick={() => setAperto(false)}>
              Annulla
            </Button>
            <Button pending={inCorso} onClick={esporta}>
              {inCorso ? "Preparazione dell'archivio…" : "Prepara e scarica"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5 text-sm leading-relaxed text-muted-foreground">
            <p>L&apos;archivio contiene:</p>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>
                un file CSV per ogni tabella del condominio (unità e dati catastali, anagrafe con i
                codici fiscali, spese e riparti, assemblee con voti, presenze e deleghe, solleciti,
                movimenti bancari, millesimi, fornitori, segnalazioni, sondaggi);
              </li>
              <li>
                tutti i documenti caricati nel portale per questo condominio, divisi in cartelle
                leggibili;
              </li>
              <li>
                un file <strong className="font-medium text-foreground">LEGGIMI.txt</strong> che
                spiega com&apos;è fatto l&apos;archivio e che verifiche restano a tuo carico.
              </li>
            </ul>
          </div>

          <Alert tono="info" titolo="Può richiedere qualche secondo">
            I documenti vengono raccolti uno per uno: su un condominio con anni di archivio la
            preparazione non è immediata. Non chiudere questa finestra.
          </Alert>

          <Alert tono="warning" titolo="Contiene dati personali">
            Codici fiscali, residenze, recapiti e posizioni di pagamento dei condòmini. Conserva
            l&apos;archivio in un luogo protetto e non condividerlo con chi non ne ha titolo: le
            posizioni di morosità, in particolare, non vanno comunicate agli altri condòmini.
          </Alert>

          <FormError>{errore}</FormError>
        </div>
      </Dialog>
    </>
  );
}
