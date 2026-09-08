import { NextResponse, type NextRequest } from "next/server";
import { getUtenteCorrente } from "@/lib/supabase/dal";
import { generaPdf } from "@/lib/documenti/pdf";
import { costruisciDocumentoAssemblea, isTipoDocumento } from "../documenti-dati";

/**
 * Scaricamento/anteprima delle bozze di convocazione e verbale.
 *
 * È un Route Handler e non una Server Action perché il PDF va aperto in una
 * scheda o salvato: serve un URL che il browser possa seguire da un link,
 * cosa che una action (che risponde a un POST di form) non offre.
 *
 * Non c'è alcun controllo di proprietà esplicito oltre al ruolo: le query di
 * costruisciDocumentoAssemblea passano dal client con la sessione dell'utente,
 * quindi la RLS restituisce l'assemblea solo al suo amministratore. Per tutti
 * gli altri il documento non esiste (404).
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/admin/assemblee/[id]/documenti">) {
  const utente = await getUtenteCorrente();
  if (!utente || utente.ruolo !== "amministratore") {
    return NextResponse.json({ errore: "Non autorizzato" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const tipo = request.nextUrl.searchParams.get("tipo") ?? "";
  if (!isTipoDocumento(tipo)) {
    return NextResponse.json({ errore: "Tipo di documento non valido" }, { status: 400 });
  }

  const documento = await costruisciDocumentoAssemblea(id, tipo);
  if (!documento) {
    return NextResponse.json({ errore: "Assemblea non trovata" }, { status: 404 });
  }

  const pdf = await generaPdf(documento);

  // "inline": l'anteprima si apre nel visualizzatore del browser, da cui si
  // può comunque salvare. Il documento è una bozza che cambia a ogni modifica
  // dei dati, quindi non va messo in cache.
  return new NextResponse(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${documento.nomeFile}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
