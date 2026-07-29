"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type StatoForm = { errore?: string } | undefined;

export async function creaPuntoOdg(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const assembleaId = String(formData.get("assemblea_id") ?? "");
  const numeroPunto = Number(formData.get("numero_punto"));
  const descrizione = String(formData.get("descrizione") ?? "").trim();
  const tipoMaggioranza = String(formData.get("tipo_maggioranza") ?? "semplice").trim();

  if (!assembleaId || !descrizione || !Number.isFinite(numeroPunto)) {
    return { errore: "Compila numero punto e descrizione." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("punti_odg").insert({
    assemblea_id: assembleaId,
    numero_punto: numeroPunto,
    descrizione,
    tipo_maggioranza: tipoMaggioranza || "semplice",
  });

  if (error) return { errore: error.message };
  revalidatePath(`/admin/assemblee/${assembleaId}`);
}

export async function apriVotazione(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const puntoId = String(formData.get("punto_id") ?? "");
  const assembleaId = String(formData.get("assemblea_id") ?? "");
  if (!puntoId || !assembleaId) return { errore: "Punto non valido." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("punti_odg")
    .update({ stato_votazione: "aperta" })
    .eq("id", puntoId);

  if (error) return { errore: error.message };
  revalidatePath(`/admin/assemblee/${assembleaId}`);
}

export async function chiudiVotazione(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const puntoId = String(formData.get("punto_id") ?? "");
  const assembleaId = String(formData.get("assemblea_id") ?? "");
  const condominioId = String(formData.get("condominio_id") ?? "");
  if (!puntoId || !assembleaId || !condominioId) {
    return { errore: "Punto non valido." };
  }

  const supabase = await createClient();

  const [{ data: votiPunto }, { data: unitaCondominio }] = await Promise.all([
    supabase.from("voti").select("scelta, millesimi_rappresentati").eq("punto_id", puntoId),
    supabase.from("unita").select("millesimi_proprieta").eq("condominio_id", condominioId),
  ]);

  let favorevole = 0;
  let contrario = 0;
  let astenuto = 0;
  for (const v of votiPunto ?? []) {
    if (v.scelta === "favorevole") favorevole += v.millesimi_rappresentati;
    else if (v.scelta === "contrario") contrario += v.millesimi_rappresentati;
    else astenuto += v.millesimi_rappresentati;
  }
  const quorumTotale = (unitaCondominio ?? []).reduce(
    (somma, u) => somma + u.millesimi_proprieta,
    0
  );
  const esito = favorevole > contrario ? "approvato" : "respinto";

  const { error } = await supabase
    .from("punti_odg")
    .update({
      stato_votazione: "chiusa",
      esito,
      esito_favorevole: favorevole,
      esito_contrario: contrario,
      esito_astenuto: astenuto,
      esito_quorum_totale: quorumTotale,
    })
    .eq("id", puntoId);

  if (error) return { errore: error.message };
  revalidatePath(`/admin/assemblee/${assembleaId}`);
}

export async function aggiornaLinkVideoconferenza(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const assembleaId = String(formData.get("assemblea_id") ?? "");
  const link = String(formData.get("link_videoconferenza") ?? "").trim();
  if (!assembleaId) return { errore: "Assemblea non valida." };

  if (link && !/^https:\/\/.+/.test(link)) {
    return { errore: "Il link deve iniziare con https://." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("assemblee")
    .update({ link_videoconferenza: link || null })
    .eq("id", assembleaId);

  if (error) return { errore: error.message };
  revalidatePath(`/admin/assemblee/${assembleaId}`);
  revalidatePath(`/area-riservata/assemblee/${assembleaId}`);
}

const VERBALE_MAX_BYTES = 4 * 1024 * 1024;

export async function caricaVerbale(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const assembleaId = String(formData.get("assemblea_id") ?? "");
  const file = formData.get("verbale");

  if (!assembleaId || !(file instanceof File) || file.size === 0) {
    return { errore: "Seleziona un file da caricare." };
  }
  if (file.size > VERBALE_MAX_BYTES) {
    return { errore: "Il file supera i 4MB consentiti." };
  }

  const supabase = await createClient();
  const estensione = file.name.split(".").pop() ?? "pdf";
  const percorso = `assemblee/${assembleaId}/${Date.now()}.${estensione}`;

  const { error: erroreUpload } = await supabase.storage
    .from("documenti-condominio")
    .upload(percorso, file, { contentType: file.type || undefined });

  if (erroreUpload) return { errore: erroreUpload.message };

  const { error } = await supabase
    .from("assemblee")
    .update({ verbale_url: percorso })
    .eq("id", assembleaId);

  if (error) return { errore: error.message };
  revalidatePath(`/admin/assemblee/${assembleaId}`);
  revalidatePath(`/area-riservata/assemblee/${assembleaId}`);
}

export async function aggiornaStatoAssemblea(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const assembleaId = String(formData.get("assemblea_id") ?? "");
  const nuovoStato = String(formData.get("nuovo_stato") ?? "");
  if (!assembleaId || !nuovoStato) return { errore: "Stato non valido." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("assemblee")
    .update({ stato: nuovoStato })
    .eq("id", assembleaId);

  if (error) return { errore: error.message };
  revalidatePath(`/admin/assemblee/${assembleaId}`);
  revalidatePath("/admin/assemblee");
}
