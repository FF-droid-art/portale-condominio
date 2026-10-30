"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { richiedeAmministratore } from "@/lib/supabase/dal";
import { messaggioErrore } from "@/lib/errori";
import { validaRigaUnita } from "@/lib/import/validazione";
import type { ErroreRiga, RigaImportUnita } from "@/lib/import/tipi";

export type EsitoImportUnita =
  | { ok: true; righeScritte: number }
  | { ok: false; erroreGenerale: string; erroriRiga?: undefined }
  | { ok: false; erroriRiga: ErroreRiga[]; erroreGenerale?: undefined };

const MAX_RIGHE_IMPORT = 5000;

export async function importaUnita(
  condominioId: string,
  righe: RigaImportUnita[],
  nomeFile: string
): Promise<EsitoImportUnita> {
  if (!condominioId) return { ok: false, erroreGenerale: "Seleziona un condominio." };
  if (!righe.length) return { ok: false, erroreGenerale: "Nessuna riga da importare." };
  if (righe.length > MAX_RIGHE_IMPORT) {
    return { ok: false, erroreGenerale: `Troppe righe (massimo ${MAX_RIGHE_IMPORT}).` };
  }

  const erroriRiga = righe
    .map((r, indice) => ({ indice, messaggio: validaRigaUnita(r) }))
    .filter((e): e is ErroreRiga => e.messaggio !== null);
  if (erroriRiga.length) return { ok: false, erroriRiga };

  const visti = new Set<string>();
  for (const r of righe) {
    if (visti.has(r.identificativo)) {
      return {
        ok: false,
        erroreGenerale: `Identificativo duplicato nel file: "${r.identificativo}".`,
      };
    }
    visti.add(r.identificativo);
  }

  // COD-04: `auth.getUser()` controllava la sessione ma non il ruolo, e un
  // non-amministratore si fermava solo alla RLS (o al `raise exception` della
  // funzione di import) con un errore di database per messaggio. Qui il
  // controllo è esplicito e, se non passa, porta al login o alla propria area.
  const amministratore = await richiedeAmministratore();
  const supabase = await createClient();

  const { data: batch, error: erroreBatch } = await supabase
    .from("import_batches")
    .insert({
      condominio_id: condominioId,
      tipo: "unita",
      nome_file: nomeFile,
      creato_da: amministratore.id,
    })
    .select("id")
    .single();
  if (erroreBatch || !batch) {
    return {
      ok: false,
      erroreGenerale: erroreBatch
        ? messaggioErrore(erroreBatch, "admin/importa/importaUnita")
        : "Impossibile registrare l'importazione: riprova.",
    };
  }

  const { data, error } = await supabase
    .from("unita")
    .upsert(
      righe.map((r) => ({ condominio_id: condominioId, ...r, import_batch_id: batch.id })),
      { onConflict: "condominio_id,identificativo" }
    )
    .select("id");

  if (error) {
    await supabase.from("import_batches").delete().eq("id", batch.id);
    return { ok: false, erroreGenerale: messaggioErrore(error, "admin/importa/importaUnita") };
  }

  await supabase
    .from("import_batches")
    .update({ righe_importate: data.length })
    .eq("id", batch.id);

  revalidatePath("/admin/condomini");
  revalidatePath("/admin/importa");

  return { ok: true, righeScritte: data.length };
}
