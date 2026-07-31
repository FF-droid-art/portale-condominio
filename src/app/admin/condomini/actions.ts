"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type StatoForm = { errore?: string } | undefined;

export async function creaCondominio(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const nome = String(formData.get("nome") ?? "").trim();
  const indirizzo = String(formData.get("indirizzo") ?? "").trim();
  const codiceFiscale = String(formData.get("codice_fiscale") ?? "").trim();
  const iban = String(formData.get("iban") ?? "").trim();
  const banca = String(formData.get("banca") ?? "").trim();
  const intestatarioConto = String(formData.get("intestatario_conto") ?? "").trim();

  if (!nome || !indirizzo) {
    return { errore: "Nome e indirizzo sono obbligatori." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { errore: "Sessione scaduta, effettua di nuovo l'accesso." };

  const { error } = await supabase.from("condomini").insert({
    nome,
    indirizzo,
    codice_fiscale: codiceFiscale || null,
    iban: iban || null,
    banca: banca || null,
    intestatario_conto: intestatarioConto || null,
    amministratore_id: user.id,
  });

  if (error) return { errore: error.message };

  revalidatePath("/admin/condomini");
}

export async function aggiornaContoCorrente(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const condominioId = String(formData.get("condominio_id") ?? "");
  const iban = String(formData.get("iban") ?? "").trim();
  const banca = String(formData.get("banca") ?? "").trim();
  const intestatarioConto = String(formData.get("intestatario_conto") ?? "").trim();

  if (!condominioId) {
    return { errore: "Condominio non valido." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("condomini")
    .update({
      iban: iban || null,
      banca: banca || null,
      intestatario_conto: intestatarioConto || null,
    })
    .eq("id", condominioId);

  if (error) return { errore: error.message };

  revalidatePath("/admin/condomini");
  revalidatePath(`/admin/condomini/${condominioId}`);
}

export async function creaUnita(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const condominioId = String(formData.get("condominio_id") ?? "");
  const identificativo = String(formData.get("identificativo") ?? "").trim();
  const piano = String(formData.get("piano") ?? "").trim();
  const millesimi = Number(formData.get("millesimi_proprieta"));

  if (!condominioId || !identificativo || !Number.isFinite(millesimi)) {
    return { errore: "Compila condominio, identificativo e millesimi." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("unita").insert({
    condominio_id: condominioId,
    identificativo,
    piano: piano || null,
    millesimi_proprieta: millesimi,
  });

  if (error) return { errore: error.message };

  revalidatePath("/admin/condomini");
}
