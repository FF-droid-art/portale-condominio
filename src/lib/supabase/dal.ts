import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Utente } from "@/lib/types";

export async function getUtenteCorrente(): Promise<Utente | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: utente } = await supabase
    .from("utenti")
    .select("*")
    .eq("id", user.id)
    .single();

  return utente as Utente | null;
}

export async function richiedeUtente(): Promise<Utente> {
  const utente = await getUtenteCorrente();
  if (!utente) redirect("/login");
  return utente;
}

export async function richiedeAmministratore(): Promise<Utente> {
  const utente = await richiedeUtente();
  if (utente.ruolo !== "amministratore") redirect("/area-riservata");
  return utente;
}
