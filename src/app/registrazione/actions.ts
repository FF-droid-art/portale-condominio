"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { messaggioErroreAuth } from "@/lib/errori";
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
  // Il widget Cloudflare Turnstile (src/components/turnstile-widget.tsx)
  // inietta questo campo nascosto dentro al form quando la verifica va a
  // buon fine. Se la chiave pubblica non è configurata (es. in sviluppo
  // locale) il widget non compare e il campo resta vuoto: lo passiamo a
  // Supabase comunque, che lo ignora se la protezione captcha non è attiva
  // sul progetto, e lo richiede invece quando lo è.
  const captchaToken = String(formData.get("cf-turnstile-response") ?? "");

  if (!nome || !cognome || !email || !password) {
    return { errore: "Compila tutti i campi." };
  }
  if (password.length < 8) {
    return { errore: "La password deve avere almeno 8 caratteri." };
  }

  const supabase = await createClient();

  // Senza emailRedirectTo, il link di conferma nell'email usa il "Site URL"
  // configurato su Supabase — oggi il dominio di produzione — qualunque sia
  // il branch/preview da cui ci si è registrati. Su un progetto con un solo
  // Supabase ma più deploy Vercel (produzione + branch di anteprima come
  // questo), questo mandava chi si registrava dalla preview a finire sulla
  // build di main dopo aver confermato l'email. Calcolare l'origine dalla
  // richiesta vera, come già fa recupera-password/actions.ts, lo risolve.
  const headersList = await headers();
  const origine = headersList.get("origin") ?? `https://${headersList.get("host")}`;

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
      captchaToken: captchaToken || undefined,
      emailRedirectTo: `${origine}/login`,
    },
  });

  // COD-02: il messaggio di Supabase Auth non arriva mai così com'è a un
  // visitatore non autenticato. `messaggioErroreAuth` traduce i casi noti
  // (captcha, password debole, troppe richieste) e — per l'indirizzo già
  // registrato — restituisce un testo che indica la via d'uscita senza
  // confermare che quell'account esista, nella stessa logica con cui COD-05
  // ha reso prudenti login e recupero password.
  if (error) {
    return { errore: messaggioErroreAuth(error, "registrazione/registrati") };
  }

  return { successo: true };
}
