"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { estraiIp, normalizzaEmail } from "@/lib/limite-tentativi";
import { azzeraTentativi, registraTentativo } from "@/lib/limite-tentativi-registra";

export type StatoForm = { errore?: string } | undefined;

export async function login(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { errore: "Inserisci email e password." };
  }

  // Vedi src/components/turnstile-widget.tsx: il widget inietta questo
  // campo nel form quando la verifica va a buon fine. La protezione
  // captcha di Supabase, una volta attiva sul progetto, copre anche
  // l'accesso con password, non solo la registrazione (verificato: senza
  // questo l'API rifiuta con "captcha protection: ... no captcha_token").
  const captchaToken = String(formData.get("cf-turnstile-response") ?? "");

  // COD-05: il tentativo si conta PRIMA di interrogare Supabase, e si conta
  // sempre — anche quando l'email non corrisponde a nessun account. Contare
  // i soli fallimenti o i soli account esistenti renderebbe il
  // comportamento del portale un modo per sapere chi è registrato, che è
  // esattamente quello che il messaggio d'errore qui sotto evita di dire.
  const identificativo = [normalizzaEmail(email), estraiIp(await headers())];
  const limite = await registraTentativo("login", identificativo);
  if (limite.bloccato) return { errore: limite.messaggio };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken: captchaToken || undefined },
  });

  if (error) {
    // "Email o password non corrette" resta il messaggio per le credenziali
    // sbagliate (non deve confermare se l'account esiste), ma un errore di
    // tutt'altra natura (captcha, rete, servizio Supabase) mostrato con lo
    // stesso testo indurrebbe a continuare a riprovare la password convinti
    // che sia quella la causa. Si distingue solo per poter dare un messaggio
    // onesto in quel caso; il dettaglio va comunque sempre loggato (COD-09).
    console.error("[login] accesso non riuscito", {
      codice: error.code,
      messaggio: error.message,
    });
    if (error.code === "captcha_failed") {
      return { errore: "Verifica anti-bot non riuscita. Ricarica la pagina e riprova." };
    }
    if (error.code !== "invalid_credentials") {
      return { errore: "Accesso non riuscito per un problema temporaneo. Riprova in un momento." };
    }
    return { errore: "Email o password non corrette." };
  }

  // Accesso riuscito: il contatore si azzera, così chi ha sbagliato a
  // digitare due volte non resta a un tentativo dal blocco.
  await azzeraTentativi("login", identificativo);

  redirect("/");
}
