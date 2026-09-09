import { NextResponse } from "next/server";
import { getUtenteCorrente } from "@/lib/supabase/dal";
import { generaPdf } from "@/lib/documenti/pdf";
import { costruisciDocumentoStatoPatrimoniale } from "../stato-patrimoniale-dati";

/**
 * Scaricamento dello "stato patrimoniale" di una unità.
 *
 * È un Route Handler e non una Server Action per lo stesso motivo delle bozze
 * di assemblea: il PDF va aperto in una scheda o salvato, e serve un URL che il
 * browser possa seguire da un collegamento.
 *
 * Oltre al ruolo non c'è alcun controllo di proprietà esplicito: le query di
 * costruisciDocumentoStatoPatrimoniale passano dal client con la sessione
 * dell'utente, quindi la RLS restituisce l'unità solo all'amministratore che la
 * gestisce. Per tutti gli altri il documento non esiste (404).
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/admin/unita/[id]/stato-patrimoniale">
) {
  const utente = await getUtenteCorrente();
  if (!utente || utente.ruolo !== "amministratore") {
    return NextResponse.json({ errore: "Non autorizzato" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const documento = await costruisciDocumentoStatoPatrimoniale(id);
  if (!documento) {
    return NextResponse.json({ errore: "Unità non trovata" }, { status: 404 });
  }

  const pdf = await generaPdf(documento);

  // "inline": si apre nel visualizzatore del browser, da cui si può salvare.
  // Il documento è una fotografia che cambia a ogni pagamento registrato,
  // quindi non va messo in cache.
  return new NextResponse(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${documento.nomeFile}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
