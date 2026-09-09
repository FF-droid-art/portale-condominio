"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { richiedeAmministratore } from "@/lib/supabase/dal";
import { PRIORITA_SEGNALAZIONE, STATI_SEGNALAZIONE } from "@/lib/segnalazioni";
import type { PrioritaSegnalazione, StatoSegnalazione } from "@/lib/types";

export type StatoForm = { errore?: string } | undefined;

function rivalida(segnalazioneId: string) {
  revalidatePath("/admin/segnalazioni");
  revalidatePath(`/admin/segnalazioni/${segnalazioneId}`);
  revalidatePath("/area-riservata/segnalazioni");
  revalidatePath(`/area-riservata/segnalazioni/${segnalazioneId}`);
}

/**
 * Presa in carico: stato, priorità e assegnazione al fornitore.
 *
 * Le tre cose si salvano insieme perché si decidono insieme ("la prendo in
 * carico, è urgente, la mando all'ascensorista"): tre azioni separate
 * costringerebbero a tre salvataggi per un solo pensiero. La data di chiusura
 * non è passata da qui: la scrive un trigger sul database quando lo stato
 * diventa "chiusa", così vale anche per gli aggiornamenti che non passano da
 * questa azione.
 */
export async function aggiornaSegnalazione(input: {
  id: string;
  stato: string;
  priorita: string;
  fornitoreId: string | null;
}): Promise<{ ok: true } | { errore: string }> {
  if (!input.id) return { errore: "Segnalazione non valida." };
  if (!(STATI_SEGNALAZIONE as string[]).includes(input.stato)) {
    return { errore: "Stato non valido." };
  }
  if (!(PRIORITA_SEGNALAZIONE as string[]).includes(input.priorita)) {
    return { errore: "Priorità non valida." };
  }

  await richiedeAmministratore();
  const supabase = await createClient();

  const { error } = await supabase
    .from("segnalazioni")
    .update({
      stato: input.stato as StatoSegnalazione,
      priorita: input.priorita as PrioritaSegnalazione,
      fornitore_id: input.fornitoreId || null,
    })
    .eq("id", input.id);

  if (error) return { errore: error.message };

  rivalida(input.id);
  return { ok: true };
}

export async function aggiungiNotaAmministratore(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const segnalazioneId = String(formData.get("segnalazione_id") ?? "");
  const testo = String(formData.get("testo") ?? "").trim();
  const interna = formData.get("interna") === "on";

  if (!segnalazioneId) return { errore: "Segnalazione non valida." };
  if (!testo) return { errore: "Scrivi il testo dell'aggiornamento." };

  const amministratore = await richiedeAmministratore();
  const supabase = await createClient();

  const { error } = await supabase.from("segnalazione_note").insert({
    segnalazione_id: segnalazioneId,
    autore_id: amministratore.id,
    testo,
    interna,
  });

  if (error) return { errore: error.message };
  rivalida(segnalazioneId);
}

export async function eliminaSegnalazione(id: string): Promise<{ errore?: string } | void> {
  if (!id) return { errore: "Segnalazione non valida." };
  await richiedeAmministratore();

  const supabase = await createClient();
  const { error } = await supabase.from("segnalazioni").delete().eq("id", id);
  if (error) return { errore: error.message };

  revalidatePath("/admin/segnalazioni");
  revalidatePath("/area-riservata/segnalazioni");
  redirect("/admin/segnalazioni");
}
