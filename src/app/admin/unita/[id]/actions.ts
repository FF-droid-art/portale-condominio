"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type StatoForm = { errore?: string } | undefined;

export async function aggiungiProprietario(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const unitaId = String(formData.get("unita_id") ?? "");
  const utenteId = String(formData.get("utente_id") ?? "");
  const quota = Number(formData.get("quota_possesso"));

  if (!unitaId || !utenteId || !Number.isFinite(quota) || quota <= 0 || quota > 100) {
    return { errore: "Seleziona un condomino e una quota valida (1-100)." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("unita_proprietari").insert({
    unita_id: unitaId,
    utente_id: utenteId,
    quota_possesso: quota,
  });

  if (error) {
    if (error.code === "23505") return { errore: "È già proprietario di questa unità." };
    return { errore: error.message };
  }

  revalidatePath(`/admin/unita/${unitaId}`);
}

export async function rimuoviProprietario(
  id: string,
  unitaId: string
): Promise<{ errore?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("unita_proprietari").delete().eq("id", id);
  if (error) return { errore: error.message };

  revalidatePath(`/admin/unita/${unitaId}`);
  return {};
}
