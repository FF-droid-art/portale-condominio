"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { messaggioErroreAuth } from "@/lib/errori";
import { codiceInvitoValido, normalizzaCodiceInvito } from "@/lib/inviti";
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
  // Codice di invito dell'unità (facoltativo, e presente nel modulo solo
  // per chi si registra come condòmino). Si normalizza qui — maiuscolo,
  // senza trattini — perché è la forma con cui il trigger
  // `handle_new_user` lo confronta con `inviti_unita.codice`.
  const codiceInvito = normalizzaCodiceInvito(String(formData.get("codice_invito") ?? ""));

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
  //
  // Il codice di invito viaggia nei metadati della registrazione, non in
  // una chiamata separata dopo il `signUp`: con la conferma email
  // obbligatoria qui non esiste ancora una sessione con cui scrivere su
  // `unita_proprietari`. Il collegamento lo fa il trigger
  // `handle_new_user` lato database (vedi supabase/schema.sql), che ignora
  // in silenzio un codice inesistente — la registrazione non deve fallire
  // perché un codice è stato ricopiato male.
  //
  // Un codice di forma impossibile non viene nemmeno passato: non
  // corrisponderebbe a nulla, e tenerlo fuori dai metadati evita di
  // conservare nell'account la traccia di un valore senza senso.
  const codiceDaPassare =
    ruolo === "condomino" && codiceInvitoValido(codiceInvito) ? codiceInvito : undefined;

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nome, cognome, ruolo, codice_invito: codiceDaPassare },
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

/**
 * Verifica un codice di invito prima che l'account esista.
 *
 * Serve al riscontro sotto al campo ("Ti colleghi a: Condominio Rossi,
 * Interno 3"): un codice ricopiato male si scopre mentre si digita e non
 * dopo essersi registrati.
 *
 * Passa dalla funzione `valida_codice_invito`, `security definer` e
 * concessa anche ad `anon` perché chi si registra non ha ancora una
 * sessione. La funzione restituisce soltanto il nome del condominio e
 * l'identificativo dell'unità: nessun dato su chi ci abita, nessun id
 * interno. La tabella `inviti_unita` resta invece inaccessibile a chiunque
 * non sia l'amministratore del condominio.
 *
 * Qualunque errore si traduce in "non valido": l'unica conseguenza è che
 * il riscontro non compare, e la registrazione resta possibile comunque.
 */
export type EsitoCodiceInvito =
  | { valido: true; unita: string; condominio: string }
  | { valido: false };

export async function verificaCodiceInvito(codice: string): Promise<EsitoCodiceInvito> {
  const normalizzato = normalizzaCodiceInvito(codice);
  // La forma si controlla prima: un codice impossibile non vale una query.
  if (!codiceInvitoValido(normalizzato)) return { valido: false };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("valida_codice_invito", {
    p_codice: normalizzato,
  });

  if (error) {
    console.error("[inviti] verifica del codice non riuscita", { errore: error.message });
    return { valido: false };
  }

  const riga = (data as { valido: boolean; unita_identificativo: string | null; condominio_nome: string | null }[] | null)?.[0];
  if (!riga?.valido || !riga.unita_identificativo || !riga.condominio_nome) {
    return { valido: false };
  }

  return {
    valido: true,
    unita: riga.unita_identificativo,
    condominio: riga.condominio_nome,
  };
}
