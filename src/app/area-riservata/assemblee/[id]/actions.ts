"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { richiedeUtente } from "@/lib/supabase/dal";

export type StatoForm = { errore?: string } | undefined;

export async function esprimiVoto(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const puntoId = String(formData.get("punto_id") ?? "");
  const unitaId = String(formData.get("unita_id") ?? "");
  const assembleaId = String(formData.get("assemblea_id") ?? "");
  const scelta = String(formData.get("scelta") ?? "");

  if (!puntoId || !unitaId || !assembleaId || !scelta) {
    return { errore: "Seleziona una scelta di voto." };
  }

  const utente = await richiedeUtente();
  const supabase = await createClient();

  const { data: unita } = await supabase
    .from("unita")
    .select("id, millesimi_proprieta")
    .eq("id", unitaId)
    .single();

  if (!unita) return { errore: "Unità non trovata o non di tua proprietà." };

  const { error } = await supabase
    .from("voti")
    .upsert(
      {
        punto_id: puntoId,
        unita_id: unitaId,
        utente_id: utente.id,
        scelta,
        millesimi_rappresentati: unita.millesimi_proprieta,
      },
      { onConflict: "punto_id,unita_id" }
    );

  if (error) return { errore: error.message };
  revalidatePath(`/area-riservata/assemblee/${assembleaId}`);
}
