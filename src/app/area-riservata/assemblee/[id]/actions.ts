"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { richiedeUtente } from "@/lib/supabase/dal";
import { messaggioErrore } from "@/lib/errori";
import { verificaLimiteDelega } from "@/lib/deleghe";

export type StatoForm = { errore?: string } | undefined;

export async function esprimiVoto(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const puntoId = String(formData.get("punto_id") ?? "");
  const unitaId = String(formData.get("unita_id") ?? "");
  const assembleaId = String(formData.get("assemblea_id") ?? "");
  const scelta = String(formData.get("scelta") ?? "");

  if (!puntoId || !unitaId || !assembleaId || !scelta) {
    return { errore: "Seleziona una scelta di voto." };
  }

  const utente = await richiedeUtente();
  const supabase = await createClient();

  const { data: unita } = await supabase
    .from("unita")
    .select("id, millesimi_proprieta")
    .eq("id", unitaId)
    .single();

  if (!unita) return { errore: "Unità non trovata o non di tua proprietà." };

  const { error } = await supabase
    .from("voti")
    .upsert(
      {
        punto_id: puntoId,
        unita_id: unitaId,
        utente_id: utente.id,
        scelta,
        millesimi_rappresentati: unita.millesimi_proprieta,
      },
      { onConflict: "punto_id,unita_id" }
    );

  if (error) return { errore: messaggioErrore(error, "area-riservata/assemblee/esprimiVoto") };
  revalidatePath(`/area-riservata/assemblee/${assembleaId}`);
}

export async function creaDelega(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const assembleaId = String(formData.get("assemblea_id") ?? "");
  const unitaDeleganteId = String(formData.get("unita_delegante_id") ?? "");
  const candidato = String(formData.get("candidato") ?? ""); // "unitaDelegataria|utenteDelegato"

  const [unitaDelegatariaId, utenteDelegatoId] = candidato.split("|");

  if (!assembleaId || !unitaDeleganteId || !unitaDelegatariaId || !utenteDelegatoId) {
    return { errore: "Seleziona a chi vuoi delegare il voto." };
  }
  if (unitaDeleganteId === unitaDelegatariaId) {
    return { errore: "Non puoi delegare la tua stessa unità." };
  }

  await richiedeUtente();
  const supabase = await createClient();

  const { data: assemblea } = await supabase
    .from("assemblee")
    .select("condominio_id")
    .eq("id", assembleaId)
    .single();
  if (!assemblea) return { errore: "Assemblea non trovata." };

  const { data: unitaDelegante } = await supabase
    .from("unita")
    .select("millesimi_proprieta")
    .eq("id", unitaDeleganteId)
    .single();
  if (!unitaDelegante) return { errore: "Unità non trovata." };

  const { errore: erroreLimite } = await verificaLimiteDelega(supabase, {
    assembleaId,
    condominioId: assemblea.condominio_id,
    utenteDelegatoId,
    millesimiNuovaDelega: unitaDelegante.millesimi_proprieta,
  });
  if (erroreLimite) return { errore: erroreLimite };

  const { error } = await supabase.from("deleghe").insert({
    assemblea_id: assembleaId,
    unita_delegante_id: unitaDeleganteId,
    unita_delegataria_id: unitaDelegatariaId,
    utente_delegato_id: utenteDelegatoId,
  });

  if (error) {
    if (error.code === "23505") return { errore: "Hai già delegato questa unità per questa assemblea." };
    return { errore: messaggioErrore(error, "area-riservata/assemblee/creaDelega") };
  }

  revalidatePath(`/area-riservata/assemblee/${assembleaId}`);
}

export async function revocaDelega(
  delegaId: string,
  assembleaId: string
): Promise<{ errore?: string }> {
  await richiedeUtente();
  const supabase = await createClient();
  const { error } = await supabase.from("deleghe").delete().eq("id", delegaId);
  if (error) return { errore: messaggioErrore(error, "area-riservata/assemblee/revocaDelega") };

  revalidatePath(`/area-riservata/assemblee/${assembleaId}`);
  return {};
}
