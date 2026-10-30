"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { richiedeAmministratore } from "@/lib/supabase/dal";
import { messaggioErrore } from "@/lib/errori";

export async function annullaImportazione(
  batchId: string
): Promise<{ errore?: string }> {
  await richiedeAmministratore();
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
    if (erroreCondomini) {
      return { errore: messaggioErrore(erroreCondomini, "admin/importa/annullaImportazione") };
    }

    const { error: erroreUnita } = await supabase
      .from("unita")
      .delete()
      .eq("import_batch_id", batchId);
    if (erroreUnita) {
      return { errore: messaggioErrore(erroreUnita, "admin/importa/annullaImportazione") };
    }
  } else {
    const tabella = batch.tipo === "unita" ? "unita" : "spese";
    const { error } = await supabase.from(tabella).delete().eq("import_batch_id", batchId);
    if (error) return { errore: messaggioErrore(error, "admin/importa/annullaImportazione") };
  }

  await supabase.from("import_batches").delete().eq("id", batchId);

  revalidatePath("/admin/condomini");
  revalidatePath("/admin/spese");
  revalidatePath("/admin/importa");
  return {};
}
