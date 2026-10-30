"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { richiedeAmministratore } from "@/lib/supabase/dal";
import { messaggioErrore } from "@/lib/errori";
import { MAX_OPZIONI_SONDAGGIO } from "@/lib/sondaggi";

// Un file "use server" può esportare solo funzioni asincrone: costanti e tipi
// condivisi con i componenti client stanno in @/lib/sondaggi.
export type StatoForm = { errore?: string } | undefined;

/**
 * Crea un sondaggio con le sue opzioni.
 *
 * Le opzioni arrivano dal form come campi ripetuti "opzione": si tengono solo
 * quelle compilate e non duplicate, così una riga lasciata vuota nel modulo non
 * diventa una scelta vuota nella scheda di voto.
 */
export async function creaSondaggio(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const condominioId = String(formData.get("condominio_id") ?? "");
  const domanda = String(formData.get("domanda") ?? "").trim();
  const descrizione = String(formData.get("descrizione") ?? "").trim();
  const scadenza = String(formData.get("scadenza") ?? "").trim();
  const ponderato = formData.get("ponderato") === "on";

  const opzioni = Array.from(
    new Set(
      formData
        .getAll("opzione")
        .map((o) => String(o).trim())
        .filter(Boolean)
    )
  ).slice(0, MAX_OPZIONI_SONDAGGIO);

  if (!condominioId) return { errore: "Seleziona il condominio." };
  if (!domanda) return { errore: "Scrivi la domanda del sondaggio." };
  if (opzioni.length < 2) {
    return { errore: "Servono almeno due opzioni di risposta diverse tra loro." };
  }
  if (scadenza && new Date(scadenza).getTime() <= Date.now()) {
    return { errore: "La scadenza deve essere nel futuro." };
  }

  const amministratore = await richiedeAmministratore();
  const supabase = await createClient();

  const { data: sondaggio, error } = await supabase
    .from("sondaggi")
    .insert({
      condominio_id: condominioId,
      domanda,
      descrizione: descrizione || null,
      scadenza: scadenza ? new Date(scadenza).toISOString() : null,
      ponderato,
      creato_da: amministratore.id,
    })
    .select("id")
    .single();

  if (error || !sondaggio) {
    return {
      errore: error
        ? messaggioErrore(error, "admin/sondaggi/creaSondaggio")
        : "Impossibile creare il sondaggio: riprova.",
    };
  }

  const { error: erroreOpzioni } = await supabase.from("sondaggio_opzioni").insert(
    opzioni.map((testo, i) => ({ sondaggio_id: sondaggio.id, testo, ordine: i + 1 }))
  );

  if (erroreOpzioni) {
    // Un sondaggio senza opzioni non è rispondibile: meglio non lasciarlo lì.
    await supabase.from("sondaggi").delete().eq("id", sondaggio.id);
    return { errore: messaggioErrore(erroreOpzioni, "admin/sondaggi/creaSondaggio") };
  }

  revalidatePath("/admin/sondaggi");
}

export async function cambiaStatoSondaggio(
  sondaggioId: string,
  stato: "aperto" | "chiuso"
): Promise<{ errore?: string }> {
  if (!sondaggioId) return { errore: "Sondaggio non valido." };
  await richiedeAmministratore();

  const supabase = await createClient();
  const { error } = await supabase.from("sondaggi").update({ stato }).eq("id", sondaggioId);
  if (error) return { errore: messaggioErrore(error, "admin/sondaggi/cambiaStatoSondaggio") };

  revalidatePath("/admin/sondaggi");
  revalidatePath(`/admin/sondaggi/${sondaggioId}`);
  revalidatePath("/area-riservata/sondaggi");
  return {};
}

export async function eliminaSondaggio(sondaggioId: string): Promise<{ errore?: string } | void> {
  if (!sondaggioId) return { errore: "Sondaggio non valido." };
  await richiedeAmministratore();

  const supabase = await createClient();
  const { error } = await supabase.from("sondaggi").delete().eq("id", sondaggioId);
  if (error) return { errore: messaggioErrore(error, "admin/sondaggi/eliminaSondaggio") };

  revalidatePath("/admin/sondaggi");
  revalidatePath("/area-riservata/sondaggi");
  redirect("/admin/sondaggi");
}
