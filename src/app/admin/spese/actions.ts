"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type StatoForm = { errore?: string } | undefined;

export async function creaSpesa(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const condominioId = String(formData.get("condominio_id") ?? "");
  const descrizione = String(formData.get("descrizione") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "").trim();
  const importoTotale = Number(formData.get("importo_totale"));
  const dataSpesa = String(formData.get("data_spesa") ?? "");
  const fornitore = String(formData.get("fornitore") ?? "").trim();

  if (
    !condominioId ||
    !descrizione ||
    !categoria ||
    !dataSpesa ||
    !Number.isFinite(importoTotale)
  ) {
    return {
      errore: "Compila condominio, descrizione, categoria, importo e data.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("spese").insert({
    condominio_id: condominioId,
    descrizione,
    categoria,
    importo_totale: importoTotale,
    data_spesa: dataSpesa,
    fornitore: fornitore || null,
  });

  if (error) return { errore: error.message };

  revalidatePath("/admin/spese");
}
