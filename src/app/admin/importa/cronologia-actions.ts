"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function annullaImportazione(
  batchId: string
): Promise<{ errore?: string }> {
  const supabase = await createClient();

  const { data: batch, error: erroreLettura } = await supabase
    .from("import_batches")
    .select("tipo")
    .eq("id", batchId)
    .single();
  if (erroreLettura || !batch) return { errore: "Importazione non trovata." };

  if (batch.tipo === "condomini_unita") {
    // I condomìni CREATI da questo batch vengono cancellati (a cascata
    // portano via anche le loro unità); le unità aggiunte invece a
    // condomìni preesistenti (non creati da questo batch, quindi non
    // toccati dalla riga sopra) vanno cancellate a parte.
    const { error: erroreCondomini } = await supabase
      .from("condomini")
      .delete()
      .eq("import_batch_id", batchId);
    if (erroreCondomini) return { errore: erroreCondomini.message };

    const { error: erroreUnita } = await supabase
      .from("unita")
      .delete()
      .eq("import_batch_id", batchId);
    if (erroreUnita) return { errore: erroreUnita.message };
  } else {
    const tabella = batch.tipo === "unita" ? "unita" : "spese";
    const { error } = await supabase.from(tabella).delete().eq("import_batch_id", batchId);
    if (error) return { errore: error.message };
  }

  await supabase.from("import_batches").delete().eq("id", batchId);

  revalidatePath("/admin/condomini");
  revalidatePath("/admin/spese");
  revalidatePath("/admin/importa");
  return {};
}
