import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { richiedeUtente } from "@/lib/supabase/dal";
import { generaPdf } from "@/lib/documenti/pdf";
import { costruisciDocumentoStatoPatrimoniale } from "@/lib/documenti/stato-patrimoniale-dati";

/**
 * Scaricamento dello "stato patrimoniale" della PROPRIA unità.
 *
 * È l'estratto conto di una singola unità: millesimi, soggetti collegati,
 * partite addebitate e saldo. Lato amministratore esiste già
 * (`/admin/unita/[id]/stato-patrimoniale`); qui lo scarica chi quell'unità la
 * possiede — tipicamente per una compravendita, dove l'acquirente risponde in
 * solido delle quote dell'anno in corso e del precedente (art. 63, comma 4,
 * disp. att. c.c.) e quel saldo va documentato.
 *
 * Il perimetro è la SINGOLA unità posseduta, non il condominio: `possiede_unita()`
 * e non `appartiene_condominio()`. Un condòmino non deve poter estrarre la
 * posizione del vicino cambiando l'id nell'URL — nel rendiconto le posizioni
 * per unità ci sono perché l'art. 1130-bis lo prevede, ma lì sono righe di un
 * prospetto, non un documento intestato alla singola unità con i nominativi
 * di chi ci abita.
 *
 * Come per il rendiconto, il controllo esplicito qui si somma — e non
 * sostituisce — alla RLS su `unita` e al controllo interno di `unita_soggetti`.
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/area-riservata/unita/[id]/stato-patrimoniale">
) {
  // Nessuna sessione -> si finisce sulla pagina di accesso, non su un JSON
  // di errore: questo indirizzo si apre da un collegamento, e chi ci arriva
  // con la sessione scaduta deve poter rientrare.
  await richiedeUtente();

  const { id } = await ctx.params;
  const supabase = await createClient();

  const { data: possiede, error } = await supabase.rpc("possiede_unita", { unita: id });
  if (error) {
    console.error("Verifica possesso dell'unità fallita", { unitaId: id, error });
    return NextResponse.json({ errore: "Verifica non riuscita" }, { status: 500 });
  }
  if (possiede !== true) {
    return NextResponse.json({ errore: "Non autorizzato" }, { status: 403 });
  }

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
