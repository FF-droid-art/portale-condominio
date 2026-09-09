import { NextResponse, type NextRequest } from "next/server";
import { getUtenteCorrente } from "@/lib/supabase/dal";
import { generaPdf } from "@/lib/documenti/pdf";
import { isLivelloSollecito } from "@/lib/solleciti";
import { costruisciDocumentoSollecito } from "../sollecito-dati";

/**
 * Lettera di sollecito di una unità, nel livello richiesto.
 *
 * Route Handler e non Server Action perché il PDF va aperto in una scheda: il
 * livello arriva come parametro di ricerca, così lo stesso indirizzo serve i
 * tre toni senza moltiplicare le rotte.
 *
 * Nessun controllo di proprietà oltre al ruolo: le query passano dal client con
 * la sessione dell'utente, quindi per un amministratore che non gestisce
 * l'unità il documento non esiste (404).
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/admin/solleciti/[unitaId]">
) {
  const utente = await getUtenteCorrente();
  if (!utente || utente.ruolo !== "amministratore") {
    return NextResponse.json({ errore: "Non autorizzato" }, { status: 403 });
  }

  const { unitaId } = await ctx.params;

  const livello = Number(request.nextUrl.searchParams.get("livello") ?? "1");
  if (!isLivelloSollecito(livello)) {
    return NextResponse.json({ errore: "Livello di sollecito non valido" }, { status: 400 });
  }

  const documento = await costruisciDocumentoSollecito(unitaId, livello);
  if (!documento) {
    return NextResponse.json({ errore: "Unità non trovata" }, { status: 404 });
  }

  const pdf = await generaPdf(documento);

  // "inline": si apre nel visualizzatore del browser, da cui si può stampare o
  // salvare. La posizione cambia a ogni pagamento: niente cache.
  return new NextResponse(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${documento.nomeFile}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
