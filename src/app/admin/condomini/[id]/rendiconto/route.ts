import { NextResponse, type NextRequest } from "next/server";
import { getUtenteCorrente } from "@/lib/supabase/dal";
import { generaPdf } from "@/lib/documenti/pdf";
import { oggiLocale } from "@/lib/fuso";
import { costruisciDocumentoRendiconto } from "../rendiconto-dati";

/**
 * Scaricamento del rendiconto annuale di un condominio.
 *
 * È un Route Handler e non una Server Action per il solito motivo: il PDF va
 * aperto in una scheda o salvato, e serve un URL che il browser possa seguire.
 *
 * L'anno arriva come parametro di ricerca; se manca o non è leggibile si usa
 * quello corrente secondo l'orologio del condominio (`@/lib/fuso`), non quello
 * del server, che il 1° gennaio direbbe l'anno sbagliato.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/admin/condomini/[id]/rendiconto">
) {
  const utente = await getUtenteCorrente();
  if (!utente || utente.ruolo !== "amministratore") {
    return NextResponse.json({ errore: "Non autorizzato" }, { status: 403 });
  }

  const { id } = await ctx.params;

  const richiesto = Number(request.nextUrl.searchParams.get("anno"));
  const anno =
    Number.isInteger(richiesto) && richiesto >= 1900 && richiesto <= 2200
      ? richiesto
      : Number(oggiLocale().slice(0, 4));

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
