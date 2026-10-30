"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { richiedeUtente } from "@/lib/supabase/dal";
import { messaggioErrore } from "@/lib/errori";

/**
 * Registra (o corregge) la risposta di una unità a un sondaggio.
 *
 * I millesimi vengono salvati come snapshot al momento della risposta, come
 * per i voti assembleari: il risultato resta leggibile anche se la tabella
 * millesimale cambia in seguito. Che il sondaggio sia ancora aperto è
 * verificato dalla policy RLS (sondaggio_risposta_ammessa), non solo qui: una
 * chiamata diretta all'API non può aggirare la scadenza.
 */
export async function rispondiSondaggio(input: {
  sondaggioId: string;
  opzioneId: string;
  unitaId: string;
}): Promise<{ errore?: string } | void> {
  const { sondaggioId, opzioneId, unitaId } = input;
  if (!sondaggioId || !opzioneId || !unitaId) {
    return { errore: "Seleziona una risposta." };
  }

  const utente = await richiedeUtente();
  const supabase = await createClient();

  const { data: unita } = await supabase
    .from("unita")
    .select("millesimi_proprieta")
    .eq("id", unitaId)
    .single();
  if (!unita) return { errore: "Unità non trovata o non collegata al tuo account." };

  const { error } = await supabase.from("sondaggio_risposte").upsert(
    {
      sondaggio_id: sondaggioId,
      opzione_id: opzioneId,
      unita_id: unitaId,
      utente_id: utente.id,
      millesimi_rappresentati: unita.millesimi_proprieta,
    },
    { onConflict: "sondaggio_id,unita_id" }
  );

  if (error) {
    // La policy nega l'operazione su un sondaggio chiuso o scaduto: senza
    // questo messaggio l'utente leggerebbe un errore di permessi incomprensibile.
    if (error.code === "42501") {
      return { errore: "Il sondaggio è chiuso: non è più possibile rispondere." };
    }
    return { errore: messaggioErrore(error, "area-riservata/sondaggi/rispondiSondaggio") };
  }

  revalidatePath("/area-riservata/sondaggi");
  revalidatePath(`/area-riservata/sondaggi/${sondaggioId}`);
}
