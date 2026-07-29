"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Ruolo } from "@/lib/types";

export type StatoForm = { errore?: string } | undefined;

export async function cambiaRuolo(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const utenteId = String(formData.get("utente_id") ?? "");
  const ruolo = String(formData.get("ruolo") ?? "") as Ruolo;

  if (!utenteId || !["amministratore", "condomino"].includes(ruolo)) {
    return { errore: "Dati non validi." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("utenti")
    .update({ ruolo })
    .eq("id", utenteId);

  if (error) return { errore: error.message };

  revalidatePath("/admin/utenti");
}
