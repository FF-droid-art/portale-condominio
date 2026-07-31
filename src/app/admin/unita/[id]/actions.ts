"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type StatoForm = { errore?: string } | undefined;

const TIPI_SOGGETTO = ["proprietario", "nudo_proprietario", "usufruttuario", "conduttore", "comodatario"];

export async function aggiungiProprietario(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const unitaId = String(formData.get("unita_id") ?? "");
  const utenteId = String(formData.get("utente_id") ?? "");
  const quota = Number(formData.get("quota_possesso"));
  const tipoSoggetto = String(formData.get("tipo_soggetto") ?? "proprietario");
  const dirittoVoto = formData.get("diritto_voto") === "on";

  if (!unitaId || !utenteId || !Number.isFinite(quota) || quota <= 0 || quota > 100) {
    return { errore: "Seleziona un condomino e una quota valida (1-100)." };
  }
  if (!TIPI_SOGGETTO.includes(tipoSoggetto)) {
    return { errore: "Ruolo non valido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("unita_proprietari").insert({
    unita_id: unitaId,
    utente_id: utenteId,
    quota_possesso: quota,
    tipo_soggetto: tipoSoggetto,
    diritto_voto: dirittoVoto,
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
