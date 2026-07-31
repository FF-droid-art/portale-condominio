"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type StatoForm = { errore?: string } | undefined;

export async function creaTabellaMillesimale(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const condominioId = String(formData.get("condominio_id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const copiaDa = String(formData.get("copia_da") ?? "");

  if (!condominioId || !nome) {
    return { errore: "Indica un nome per la tabella." };
  }

  const supabase = await createClient();

  const { data: unita, error: erroreUnita } = await supabase
    .from("unita")
    .select("id, millesimi_proprieta")
    .eq("condominio_id", condominioId);

  if (erroreUnita) return { errore: erroreUnita.message };

  const { data: tabella, error: erroreTabella } = await supabase
    .from("tabelle_millesimali")
    .insert({ condominio_id: condominioId, nome })
    .select("id")
    .single();

  if (erroreTabella) {
    if (erroreTabella.code === "23505") {
      return { errore: "Esiste già una tabella millesimale con questo nome." };
    }
    return { errore: erroreTabella.message };
  }

  // Precompila i valori per ogni unità così l'amministratore non deve
  // inserirli uno per uno: copia dai millesimi generali, da un'altra
  // tabella già esistente, oppure parte da zero.
  let valoriPerUnita = new Map((unita ?? []).map((u) => [u.id, 0]));
  if (copiaDa === "generale") {
    valoriPerUnita = new Map((unita ?? []).map((u) => [u.id, u.millesimi_proprieta]));
  } else if (copiaDa) {
    const { data: valoriOrigine } = await supabase
      .from("valori_millesimali")
      .select("unita_id, valore")
      .eq("tabella_id", copiaDa);
    for (const v of valoriOrigine ?? []) {
      valoriPerUnita.set(v.unita_id, v.valore);
    }
  }

  const righe = (unita ?? []).map((u) => ({
    tabella_id: tabella.id,
    unita_id: u.id,
    valore: valoriPerUnita.get(u.id) ?? 0,
  }));

  if (righe.length) {
    const { error: erroreValori } = await supabase.from("valori_millesimali").insert(righe);
    if (erroreValori) return { errore: erroreValori.message };
  }

  revalidatePath(`/admin/condomini/${condominioId}/millesimi`);
}

export async function eliminaTabellaMillesimale(
  tabellaId: string,
  condominioId: string
): Promise<{ errore?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("tabelle_millesimali").delete().eq("id", tabellaId);
  if (error) return { errore: error.message };

  revalidatePath(`/admin/condomini/${condominioId}/millesimi`);
  return {};
}

export async function aggiornaValoriMillesimali(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const tabellaId = String(formData.get("tabella_id") ?? "");
  const condominioId = String(formData.get("condominio_id") ?? "");
  const unitaIds = formData.getAll("unita_id").map(String);

  if (!tabellaId || !condominioId || !unitaIds.length) {
    return { errore: "Dati non validi." };
  }

  const righe = unitaIds.map((unitaId) => {
    const valore = Number(formData.get(`valore_${unitaId}`));
    return {
      tabella_id: tabellaId,
      unita_id: unitaId,
      valore: Number.isFinite(valore) && valore >= 0 ? valore : 0,
    };
  });

  const supabase = await createClient();
  const { error } = await supabase
    .from("valori_millesimali")
    .upsert(righe, { onConflict: "tabella_id,unita_id" });

  if (error) return { errore: error.message };

  revalidatePath(`/admin/condomini/${condominioId}/millesimi/${tabellaId}`);
  return { errore: undefined };
}
