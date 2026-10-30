"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { estraiIp, normalizzaEmail } from "@/lib/limite-tentativi";
import { registraTentativo } from "@/lib/limite-tentativi-registra";

export type StatoForm = { errore?: string; successo?: boolean } | undefined;

export async function richiediReset(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { errore: "Inserisci la tua email." };

  // Vedi src/components/turnstile-widget.tsx: il widget inietta questo
  // campo nel form quando la verifica va a buon fine. La protezione
  // captcha di Supabase, una volta attiva sul progetto, la richiede anche
  // qui, non solo in registrazione.
  const captchaToken = String(formData.get("cf-turnstile-response") ?? "");

  const headersList = await headers();

  // COD-05: ogni richiesta qui fa partire una email verso un indirizzo che
  // chi compila il modulo non deve necessariamente possedere. Il limite è
  // quindi più severo di quello del login, e conta le richieste prima di
  // sapere se l'indirizzo corrisponde a un account — altrimenti la
  // differenza di comportamento direbbe chi è registrato.
  const limite = await registraTentativo("recupero_password", [
    normalizzaEmail(email),
    estraiIp(headersList),
  ]);
  if (limite.bloccato) return { errore: limite.messaggio };

  const supabase = await createClient();
  const origine = headersList.get("origin") ?? `https://${headersList.get("host")}`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origine}/reimposta-password`,
    captchaToken: captchaToken || undefined,
  });

  // L'esito è sempre lo stesso, qualunque cosa risponda Supabase: un errore
  // mostrato qui (indirizzo inesistente, limite di invio raggiunto lato
  // piattaforma) direbbe a chi prova indirizzi altrui quali sono registrati.
  // Il dettaglio si logga (COD-02 e COD-09: mai `error.message` all'utente,
  // mai un fallimento silenzioso).
  if (error) {
    console.error("[recupero-password] invio dell'email di ripristino non riuscito", {
      errore: error.message,
    });
  }

  return { successo: true };
}
