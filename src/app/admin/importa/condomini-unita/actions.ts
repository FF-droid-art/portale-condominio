"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validaRigaCondominioUnita } from "@/lib/import/validazione";
import { preparaRigheCondominioUnita } from "@/lib/import/collassa";
import type { ErroreRiga, RigaImportCondominioUnita } from "@/lib/import/tipi";

export type EsitoImportCondominiUnita =
  | { ok: true; condominiCreati: number; condominiRiusati: number; unitaCreate: number }
  | { ok: false; erroreGenerale: string; erroriRiga?: undefined }
  | { ok: false; erroriRiga: ErroreRiga[]; erroreGenerale?: undefined };

const MAX_RIGHE_IMPORT = 5000;

export async function importaCondominiUnita(
  righeInput: RigaImportCondominioUnita[],
  nomeFile: string
): Promise<EsitoImportCondominiUnita> {
  if (!righeInput.length) return { ok: false, erroreGenerale: "Nessuna riga da importare." };

  // Rinormalizza lato server (nome del condominio derivato dall'indirizzo se
  // assente + fusione delle righe che descrivono la stessa unità, es. più
  // occupanti): non ci si fida della sola preparazione lato client. Dopo
  // questo passo ogni unità compare una sola volta, quindi non serve più il
  // vecchio controllo che bloccava gli identificativi ripetuti.
  const righe = preparaRigheCondominioUnita(righeInput);

  if (righe.length > MAX_RIGHE_IMPORT) {
    return { ok: false, erroreGenerale: `Troppe righe (massimo ${MAX_RIGHE_IMPORT}).` };
  }

  const erroriRiga = righe
    .map((r, indice) => ({ indice, messaggio: validaRigaCondominioUnita(r) }))
    .filter((e): e is ErroreRiga => e.messaggio !== null);
  if (erroriRiga.length) return { ok: false, erroriRiga };

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, erroreGenerale: "Sessione scaduta: effettua di nuovo l'accesso." };
  }

  const { data: batch, error: erroreBatch } = await supabase
    .from("import_batches")
    .insert({
      condominio_id: null,
      tipo: "condomini_unita",
      nome_file: nomeFile,
      creato_da: user.id,
    })
    .select("id")
    .single();
  if (erroreBatch || !batch) {
    return {
      ok: false,
      erroreGenerale: erroreBatch?.message ?? "Impossibile registrare l'importazione.",
    };
  }

  const { data, error } = await supabase.rpc("importa_condomini_unita", {
    p_batch_id: batch.id,
    p_righe: righe,
  });

  if (error) {
    await supabase.from("import_batches").delete().eq("id", batch.id);
    return { ok: false, erroreGenerale: error.message };
  }

  const risultato = data?.[0] as
    | { condomini_creati: number; condomini_riusati: number; unita_create: number }
    | undefined;

  await supabase
    .from("import_batches")
    .update({ righe_importate: righe.length })
    .eq("id", batch.id);

  revalidatePath("/admin/condomini");
  revalidatePath("/admin/condomini");
  revalidatePath("/admin/importa");

  return {
    ok: true,
    condominiCreati: risultato?.condomini_creati ?? 0,
    condominiRiusati: risultato?.condomini_riusati ?? 0,
    unitaCreate: risultato?.unita_create ?? 0,
  };
}
