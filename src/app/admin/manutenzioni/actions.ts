"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { richiedeAmministratore } from "@/lib/supabase/dal";
import {
  CATEGORIE_FORNITORE,
  PERIODICITA,
  prossimaScadenza,
} from "@/lib/manutenzioni";
import type { CategoriaFornitore, Periodicita } from "@/lib/types";

export type StatoForm = { errore?: string } | undefined;

function rivalida() {
  revalidatePath("/admin/manutenzioni");
  revalidatePath("/admin/calendario");
}

/* -------------------------------------------------------------------------
   Fornitori
   ------------------------------------------------------------------------- */

function leggiCategoria(valore: unknown): CategoriaFornitore {
  const v = String(valore ?? "");
  return (CATEGORIE_FORNITORE as string[]).includes(v) ? (v as CategoriaFornitore) : "altro";
}

export async function creaFornitore(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const condominioId = String(formData.get("condominio_id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();

  if (!condominioId) return { errore: "Seleziona il condominio." };
  if (!nome) return { errore: "Il nome del fornitore è obbligatorio." };

  await richiedeAmministratore();
  const supabase = await createClient();

  const { error } = await supabase.from("fornitori").insert({
    condominio_id: condominioId,
    nome,
    categoria: leggiCategoria(formData.get("categoria")),
    referente: String(formData.get("referente") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim().toLowerCase() || null,
    telefono: String(formData.get("telefono") ?? "").trim() || null,
    partita_iva: String(formData.get("partita_iva") ?? "").trim() || null,
    note: String(formData.get("note") ?? "").trim() || null,
  });

  if (error) return { errore: error.message };
  rivalida();
}

export async function aggiornaFornitore(input: {
  id: string;
  nome: string;
  categoria: string;
  referente: string;
  email: string;
  telefono: string;
  partitaIva: string;
  note: string;
  attivo: boolean;
}): Promise<{ ok: true } | { errore: string }> {
  if (!input.id) return { errore: "Fornitore non valido." };
  if (!input.nome.trim()) return { errore: "Il nome del fornitore è obbligatorio." };

  await richiedeAmministratore();
  const supabase = await createClient();

  const { error } = await supabase
    .from("fornitori")
    .update({
      nome: input.nome.trim(),
      categoria: leggiCategoria(input.categoria),
      referente: input.referente.trim() || null,
      email: input.email.trim().toLowerCase() || null,
      telefono: input.telefono.trim() || null,
      partita_iva: input.partitaIva.trim() || null,
      note: input.note.trim() || null,
      attivo: input.attivo,
    })
    .eq("id", input.id);

  if (error) return { errore: error.message };
  rivalida();
  return { ok: true };
}

export async function eliminaFornitore(id: string): Promise<{ errore?: string }> {
  if (!id) return { errore: "Fornitore non valido." };
  await richiedeAmministratore();

  const supabase = await createClient();
  const { error } = await supabase.from("fornitori").delete().eq("id", id);
  if (error) return { errore: error.message };

  rivalida();
  return {};
}

/* -------------------------------------------------------------------------
   Manutenzioni programmate
   ------------------------------------------------------------------------- */

function leggiPeriodicita(valore: unknown): Periodicita {
  const v = String(valore ?? "");
  return (PERIODICITA as string[]).includes(v) ? (v as Periodicita) : "nessuna";
}

export async function creaManutenzione(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const condominioId = String(formData.get("condominio_id") ?? "");
  const titolo = String(formData.get("titolo") ?? "").trim();
  const dataProssima = String(formData.get("data_prossima") ?? "").trim();
  const fornitoreId = String(formData.get("fornitore_id") ?? "").trim();
  const spesaId = String(formData.get("spesa_id") ?? "").trim();
  const costo = String(formData.get("costo_previsto") ?? "").trim();

  if (!condominioId) return { errore: "Seleziona il condominio." };
  if (!titolo) return { errore: "Scrivi che intervento è (es. «Verifica biennale ascensore»)." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataProssima)) {
    return { errore: "Indica la data del prossimo intervento." };
  }

  await richiedeAmministratore();
  const supabase = await createClient();

  const { error } = await supabase.from("manutenzioni_programmate").insert({
    condominio_id: condominioId,
    titolo,
    descrizione: String(formData.get("descrizione") ?? "").trim() || null,
    data_prossima: dataProssima,
    periodicita: leggiPeriodicita(formData.get("periodicita")),
    fornitore_id: fornitoreId || null,
    spesa_id: spesaId || null,
    costo_previsto: costo ? Number(costo.replace(",", ".")) : null,
  });

  if (error) return { errore: error.message };
  rivalida();
}

/**
 * Segna come eseguita una manutenzione e, se è periodica, ne programma
 * automaticamente la successiva: è il motivo per cui esiste uno scadenzario —
 * la prossima scadenza non deve dipendere dal fatto che qualcuno si ricordi di
 * reinserirla.
 */
export async function completaManutenzione(
  id: string,
  dataEsecuzione?: string
): Promise<{ errore?: string; creataProssima?: string }> {
  if (!id) return { errore: "Manutenzione non valida." };
  await richiedeAmministratore();

  const supabase = await createClient();
  const { data: manutenzione, error: erroreLettura } = await supabase
    .from("manutenzioni_programmate")
    .select("*")
    .eq("id", id)
    .single();

  if (erroreLettura || !manutenzione) {
    return { errore: erroreLettura?.message ?? "Manutenzione non trovata." };
  }

  const eseguitaIl =
    dataEsecuzione && /^\d{4}-\d{2}-\d{2}$/.test(dataEsecuzione)
      ? dataEsecuzione
      : new Date().toISOString().slice(0, 10);

  const { error } = await supabase
    .from("manutenzioni_programmate")
    .update({ stato: "completata", data_completamento: eseguitaIl })
    .eq("id", id);

  if (error) return { errore: error.message };

  // La successiva si conta dalla scadenza prevista, non dal giorno in cui è
  // stata spuntata: un intervento fatto in ritardo non deve spostare in avanti
  // tutte le scadenze future del contratto.
  const prossima = prossimaScadenza(manutenzione.data_prossima, manutenzione.periodicita);
  if (prossima) {
    const { error: erroreNuova } = await supabase.from("manutenzioni_programmate").insert({
      condominio_id: manutenzione.condominio_id,
      fornitore_id: manutenzione.fornitore_id,
      titolo: manutenzione.titolo,
      descrizione: manutenzione.descrizione,
      data_prossima: prossima,
      periodicita: manutenzione.periodicita,
      costo_previsto: manutenzione.costo_previsto,
    });
    if (erroreNuova) return { errore: erroreNuova.message };
  }

  rivalida();
  return { creataProssima: prossima ?? undefined };
}

export async function annullaManutenzione(id: string): Promise<{ errore?: string }> {
  if (!id) return { errore: "Manutenzione non valida." };
  await richiedeAmministratore();

  const supabase = await createClient();
  const { error } = await supabase
    .from("manutenzioni_programmate")
    .update({ stato: "annullata" })
    .eq("id", id);

  if (error) return { errore: error.message };
  rivalida();
  return {};
}

export async function eliminaManutenzione(id: string): Promise<{ errore?: string }> {
  if (!id) return { errore: "Manutenzione non valida." };
  await richiedeAmministratore();

  const supabase = await createClient();
  const { error } = await supabase.from("manutenzioni_programmate").delete().eq("id", id);
  if (error) return { errore: error.message };

  rivalida();
  return {};
}
