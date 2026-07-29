"use server";

import { createClient } from "@/lib/supabase/server";
import type { Ruolo } from "@/lib/types";

export type StatoForm = { errore?: string; successo?: boolean } | undefined;

export async function registrati(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const nome = String(formData.get("nome") ?? "").trim();
  const cognome = String(formData.get("cognome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const ruoloRichiesto = String(formData.get("ruolo") ?? "");
  const ruolo: Ruolo = ruoloRichiesto === "amministratore" ? "amministratore" : "condomino";

  if (!nome || !cognome || !email || !password) {
    return { errore: "Compila tutti i campi." };
  }
  if (password.length < 8) {
    return { errore: "La password deve avere almeno 8 caratteri." };
  }

  const supabase = await createClient();

  // Chi si registra come amministratore parte con un'area isolata e senza
  // alcun condominio assegnato (multi-tenancy via RLS su condomini.amministratore_id),
  // quindi è sicuro lasciar scegliere il ruolo direttamente in fase di
  // registrazione. Il trigger handle_new_user valida comunque il valore
  // ricevuto e accetta solo 'amministratore'/'condomino'.
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nome, cognome, ruolo },
    },
  });

  if (error) {
    return { errore: "Registrazione non riuscita: " + error.message };
  }

  return { successo: true };
}
