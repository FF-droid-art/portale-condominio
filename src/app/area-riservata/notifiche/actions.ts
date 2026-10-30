"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { richiedeUtente } from "@/lib/supabase/dal";
import { messaggioErrore } from "@/lib/errori";
import { TIPI_EVENTO } from "@/lib/notifiche";

export type StatoForm = { errore?: string; ok?: true } | undefined;

/**
 * Salva l'intero pannello in un colpo solo.
 *
 * Una casella non spuntata non compare nei dati del modulo, quindi il modo
 * sicuro di leggere il pannello è scorrere il catalogo e chiedersi per ognuno
 * se il campo c'è: leggere le sole chiavi presenti farebbe sparire le voci
 * disattivate invece di registrarle.
 *
 * Si scrive una riga per OGNI tipo di evento, anche per quelli lasciati
 * attivi: il modello resta a opt-out (nessuna riga = attivo), ma avere la riga
 * rende esplicito che l'utente ha visto e confermato quella voce, e permette di
 * riattivare qualcosa senza dover cancellare righe.
 */
export async function salvaPreferenzeNotifiche(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const utente = await richiedeUtente();
  const supabase = await createClient();

  const righe = TIPI_EVENTO.map((tipo) => ({
    utente_id: utente.id,
    tipo_evento: tipo,
    email_attiva: formData.get(`evento_${tipo}`) !== null,
  }));

  const { error } = await supabase
    .from("preferenze_notifiche")
    .upsert(righe, { onConflict: "utente_id,tipo_evento" });

  if (error) {
    return { errore: messaggioErrore(error, "area-riservata/notifiche/salvaPreferenzeNotifiche") };
  }

  revalidatePath("/area-riservata/notifiche");
  return { ok: true };
}
