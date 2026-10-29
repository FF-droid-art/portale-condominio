import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { richiedeUtente } from "@/lib/supabase/dal";
import { generaPdf } from "@/lib/documenti/pdf";
import { annoRendiconto } from "@/lib/documenti/rendiconto";
import { costruisciDocumentoRendiconto } from "@/lib/documenti/rendiconto-dati";
import { oggiLocale } from "@/lib/fuso";

/**
 * Scaricamento del rendiconto annuale da parte del CONDÒMINO.
 *
 * L'art. 1130-bis, comma 1, c.c. riconosce a ogni condòmino il diritto di
 * prendere visione ed estrarre copia del rendiconto: è lo stesso documento che
 * scarica l'amministratore da `/admin/condomini/[id]/rendiconto`, costruito
 * dalla stessa `costruisciDocumentoRendiconto` — non una versione ridotta.
 * Cambia solo chi può chiederlo e per quale condominio.
 *
 * TRE CONTROLLI, NON UNO. L'id del condominio sta nell'URL, quindi la domanda
 * da farsi è: che succede se un condòmino ci mette l'id dello stabile accanto?
 *
 *  1. `richiedeUtente()` — dev'esserci una sessione (nessun ruolo richiesto:
 *     qui si entra da condòmini, e un amministratore che possiede un'unità in
 *     questo stabile è un condòmino a tutti gli effetti);
 *  2. `appartiene_condominio()` — verifica esplicita lato server, con una
 *     query vera, che l'utente abbia almeno un'unità in QUESTO condominio. È
 *     la funzione scritta esattamente per questo scopo (legame utente →
 *     unità → condominio), non una policy presa in prestito da un altro uso;
 *  3. la RLS su `condomini` e il controllo interno delle funzioni
 *     `security definer` chiamate dalla raccolta dati, che rifiutano comunque
 *     chi non appartiene.
 *
 * Il punto 2 è ridondante rispetto al 3, ed è voluto: il 3 è la barriera, il 2
 * rende l'intenzione leggibile qui e restituisce 403 invece di un errore
 * generico. Su un documento che espone la posizione contabile di tutte le
 * unità, un controllo in più vale più di un commento.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/area-riservata/condominio/[id]/rendiconto">
) {
  // Nessuna sessione -> si finisce sulla pagina di accesso, non su un JSON
  // di errore: questo indirizzo si apre da un collegamento, e chi ci arriva
  // con la sessione scaduta deve poter rientrare.
  await richiedeUtente();

  const { id } = await ctx.params;
  const supabase = await createClient();

  const { data: appartiene, error } = await supabase.rpc("appartiene_condominio", {
    condominio: id,
  });
  if (error) {
    // Flusso di sola lettura, ma senza log un rifiuto dovuto a un guasto del
    // database sarebbe indistinguibile da un rifiuto dovuto all'autorizzazione.
    console.error("Verifica appartenenza al condominio fallita", { condominioId: id, error });
    return NextResponse.json({ errore: "Verifica non riuscita" }, { status: 500 });
  }
  if (appartiene !== true) {
    return NextResponse.json({ errore: "Non autorizzato" }, { status: 403 });
  }

  // L'anno corrente è quello dell'orologio del condominio (`@/lib/fuso`), non
  // quello del server, che il 1° gennaio direbbe l'anno sbagliato.
  const anno = annoRendiconto(
    request.nextUrl.searchParams.get("anno"),
    Number(oggiLocale().slice(0, 4))
  );

  const documento = await costruisciDocumentoRendiconto(id, anno);
  if (!documento) {
    return NextResponse.json({ errore: "Condominio non trovato" }, { status: 404 });
  }

  const pdf = await generaPdf(documento);

  // "inline": si apre nel visualizzatore del browser, da cui si può salvare.
  // Il prospetto cambia a ogni pagamento registrato: non va messo in cache.
  return new NextResponse(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${documento.nomeFile}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
