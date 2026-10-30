import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUtenteCorrente } from "@/lib/supabase/dal";
import { esportaCondominio } from "../esportazione-dati";

/**
 * Esportazione completa dei dati di UN condominio, in un archivio ZIP
 * (CONT-02 in `docs/audit/05-dipendenze-continuita-mercato.md`).
 *
 * È un Route Handler e non una Server Action per il motivo consueto nel
 * progetto: il file va scaricato, e serve un URL che il browser possa seguire.
 *
 * TRE CONTROLLI, NON UNO — e qui il terzo da solo NON basterebbe, a
 * differenza del rendiconto del condòmino. Questa è la route più ampia
 * dell'applicazione: una sola richiesta estrae ogni riga e ogni documento di
 * un condominio, dati catastali e codici fiscali compresi. Un errore di
 * autorizzazione qui non espone un documento, espone un archivio.
 *
 *  1. `getUtenteCorrente()` + ruolo `amministratore` — e si risponde 403, non
 *     si reindirizza: chi arriva qui lo fa da un pulsante che scarica un file,
 *     e una pagina di login servita come corpo di un download sarebbe peggio
 *     di un errore;
 *  2. **una query vera** su `condomini` filtrata insieme su `id` e
 *     `amministratore_id = utente.id`. È questo il controllo che decide, e
 *     avviene PRIMA di qualunque raccolta dati o lettura dello storage: non si
 *     comincia a leggere per poi scoprire che non si doveva. Il filtro è
 *     esplicito e non delegato a una funzione RLS esistente: la lezione di
 *     THREAT-01 (vedi `CLAUDE.md`) è che una policy scritta per uno scopo può
 *     avere un effetto collaterale più ampio, e qui non c'è margine per
 *     fidarsi dello scopo di qualcun altro. `admin_possiede_condominio()`
 *     direbbe la stessa cosa, ma leggerla scritta qui rende verificabile a
 *     occhio che il filtro è su DUE colonne, non su una;
 *  3. la RLS su ogni tabella letta e la policy `documenti_select` sullo
 *     storage, che per i prefissi `condomini/`, `spese/`, `assemblee/` e
 *     `segnalazioni/` risalgono tutte a `admin_possiede_condominio`.
 *
 * Il punto 2 è ridondante rispetto al 3 ed è voluto: il 3 resta la barriera,
 * il 2 garantisce che una tabella aggiunta in futuro con una policy sbagliata
 * non diventi un buco su questa route, perché la route si ferma prima.
 *
 * LIMITI DI PIATTAFORMA, DICHIARATI QUI PERCHÉ NON SONO IPOTETICI. L'archivio
 * si costruisce interamente in memoria (jszip) e i documenti si scaricano uno
 * per uno dallo storage: tempo e memoria crescono con la mole di allegati, non
 * con il numero di righe. Un condominio con poche centinaia di MB di documenti
 * resta nei limiti di una Vercel Function; oltre, la funzione può esaurire la
 * memoria o il tempo massimo. Volutamente NON si esporta `maxDuration`: il
 * valore giusto dipende dal piano Vercel in uso, e fissarne uno qui lo
 * abbasserebbe dove la piattaforma concede di più. Se un condominio reale
 * arrivasse a fallire, la strada è lo streaming dello zip (un `ReadableStream`
 * alimentato da `archiver`) o un'esportazione in due parti (dati e documenti),
 * non alzare un numero.
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/admin/condomini/[id]/esportazione">
) {
  const utente = await getUtenteCorrente();
  if (!utente || utente.ruolo !== "amministratore") {
    return NextResponse.json({ errore: "Non autorizzato" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const supabase = await createClient();

  // Il controllo che decide. Due colonne nello stesso filtro: l'id chiesto
  // nell'URL e l'amministratore in sessione.
  const { data: condominio, error: erroreVerifica } = await supabase
    .from("condomini")
    .select("id")
    .eq("id", id)
    .eq("amministratore_id", utente.id)
    .maybeSingle();

  if (erroreVerifica) {
    // Senza log, un rifiuto per guasto del database sarebbe indistinguibile da
    // un rifiuto per autorizzazione (COD-09).
    console.error("Esportazione: verifica proprietà del condominio fallita", {
      condominioId: id,
      amministratoreId: utente.id,
      error: erroreVerifica,
    });
    return NextResponse.json({ errore: "Verifica non riuscita" }, { status: 500 });
  }

  if (!condominio) {
    // 403 e non 404: chi non è l'amministratore di questo condominio non deve
    // nemmeno sapere se esiste.
    return NextResponse.json({ errore: "Non autorizzato" }, { status: 403 });
  }

  let archivio;
  try {
    archivio = await esportaCondominio(id, {
      nome: utente.nome,
      cognome: utente.cognome,
      email: utente.email,
    });
  } catch (errore) {
    // Flusso di conservazione: se fallisce a metà, l'amministratore deve
    // saperlo invece di ritrovarsi un archivio incompleto che crede completo.
    console.error("Esportazione del condominio fallita", { condominioId: id, errore });
    return NextResponse.json(
      { errore: "Esportazione non riuscita. Riprova; se l'errore si ripete, contattaci." },
      { status: 500 }
    );
  }

  if (!archivio) {
    return NextResponse.json({ errore: "Condominio non trovato" }, { status: 404 });
  }

  // "attachment": questo file si salva, non si apre in una scheda. Nessuna
  // cache: contiene dati personali e cambia a ogni modifica del condominio.
  return new NextResponse(archivio.contenuto as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${archivio.nomeFile}"`,
      "Content-Length": String(archivio.contenuto.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
