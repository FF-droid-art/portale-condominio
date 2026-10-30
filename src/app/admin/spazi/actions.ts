"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { richiedeAmministratore } from "@/lib/supabase/dal";
import { messaggioErrore } from "@/lib/errori";
import { minutiDaOra } from "@/lib/prenotazioni";

export type StatoForm = { errore?: string } | undefined;

function rivalida() {
  revalidatePath("/admin/spazi");
  revalidatePath("/area-riservata/spazi");
  revalidatePath("/admin/calendario");
  revalidatePath("/area-riservata/calendario");
}

/** Legge un intero positivo da un campo di modulo, con valore di riserva. */
function leggiIntero(valore: FormDataEntryValue | null, riserva: number | null): number | null {
  const testo = String(valore ?? "").trim();
  if (!testo) return riserva;
  const n = Number(testo);
  return Number.isInteger(n) && n > 0 ? n : riserva;
}

function validaOrari(apertura: string, chiusura: string): string | null {
  const da = minutiDaOra(apertura);
  const a = minutiDaOra(chiusura);
  if (da === null || a === null) return "Indica un orario di apertura e uno di chiusura validi.";
  if (a <= da) return "L'orario di chiusura deve essere successivo a quello di apertura.";
  return null;
}

export async function creaSpazio(_stato: StatoForm, formData: FormData): Promise<StatoForm> {
  const condominioId = String(formData.get("condominio_id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const oraApertura = String(formData.get("ora_apertura") ?? "08:00");
  const oraChiusura = String(formData.get("ora_chiusura") ?? "22:00");

  if (!condominioId) return { errore: "Seleziona il condominio." };
  if (!nome) return { errore: "Dai un nome allo spazio (es. «Sala condominiale»)." };

  const erroreOrari = validaOrari(oraApertura, oraChiusura);
  if (erroreOrari) return { errore: erroreOrari };

  await richiedeAmministratore();
  const supabase = await createClient();

  const { error } = await supabase.from("spazi_comuni").insert({
    condominio_id: condominioId,
    nome,
    descrizione: String(formData.get("descrizione") ?? "").trim() || null,
    posti: leggiIntero(formData.get("posti"), 1) ?? 1,
    ora_apertura: oraApertura,
    ora_chiusura: oraChiusura,
    durata_massima_ore: leggiIntero(formData.get("durata_massima_ore"), null),
  });

  if (error) return { errore: messaggioErrore(error, "admin/spazi/creaSpazio") };
  rivalida();
}

export async function aggiornaSpazio(input: {
  id: string;
  nome: string;
  descrizione: string;
  posti: number;
  oraApertura: string;
  oraChiusura: string;
  durataMassimaOre: number | null;
  attivo: boolean;
}): Promise<{ ok: true } | { errore: string }> {
  if (!input.id) return { errore: "Spazio non valido." };
  if (!input.nome.trim()) return { errore: "Il nome è obbligatorio." };
  if (!Number.isInteger(input.posti) || input.posti < 1) {
    return { errore: "I posti prenotabili devono essere almeno uno." };
  }

  const erroreOrari = validaOrari(input.oraApertura, input.oraChiusura);
  if (erroreOrari) return { errore: erroreOrari };

  await richiedeAmministratore();
  const supabase = await createClient();

  const { error } = await supabase
    .from("spazi_comuni")
    .update({
      nome: input.nome.trim(),
      descrizione: input.descrizione.trim() || null,
      posti: input.posti,
      ora_apertura: input.oraApertura,
      ora_chiusura: input.oraChiusura,
      durata_massima_ore: input.durataMassimaOre,
      attivo: input.attivo,
    })
    .eq("id", input.id);

  if (error) return { errore: messaggioErrore(error, "admin/spazi/aggiornaSpazio") };
  rivalida();
  return { ok: true };
}

export async function eliminaSpazio(id: string): Promise<{ errore?: string }> {
  if (!id) return { errore: "Spazio non valido." };
  await richiedeAmministratore();

  const supabase = await createClient();
  const { error } = await supabase.from("spazi_comuni").delete().eq("id", id);
  if (error) return { errore: messaggioErrore(error, "admin/spazi/eliminaSpazio") };

  rivalida();
  return {};
}

/**
 * Annullamento di una prenotazione da parte dell'amministratore (lavori in
 * corso, sala occupata dall'assemblea…). La riga resta, con stato "annullata":
 * chi l'aveva fatta deve poter vedere che cos'è successo alla sua prenotazione,
 * invece di trovarla sparita.
 */
export async function annullaPrenotazioneAdmin(id: string): Promise<{ errore?: string }> {
  if (!id) return { errore: "Prenotazione non valida." };
  await richiedeAmministratore();

  const supabase = await createClient();
  const { error } = await supabase
    .from("prenotazioni_spazi")
    .update({ stato: "annullata" })
    .eq("id", id);

  if (error) return { errore: messaggioErrore(error, "admin/spazi/annullaPrenotazioneAdmin") };
  rivalida();
  return {};
}
