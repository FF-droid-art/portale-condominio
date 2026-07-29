"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type StatoForm = { errore?: string; successo?: boolean } | undefined;

export async function richiediReset(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { errore: "Inserisci la tua email." };

  const supabase = await createClient();
  const headersList = await headers();
  const origine = headersList.get("origin") ?? `https://${headersList.get("host")}`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origine}/reimposta-password`,
  });

  if (error) return { errore: error.message };
  return { successo: true };
}
