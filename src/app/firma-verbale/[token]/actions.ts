"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { resend, MITTENTE_EMAIL } from "@/lib/resend";
import { formatDataOra } from "@/lib/format";
import {
  generaCodiceOtp,
  hashOtp,
  scadenzaOtp,
  verificaOtp,
  OTP_VALIDITA_MINUTI,
  type StatoFirma,
} from "@/lib/firma-otp";

/**
 * Azioni della pagina pubblica di conferma del verbale.
 *
 * Chi deve confermare (tipicamente presidente e segretario) può non avere un
 * account sul portale: la pagina è raggiungibile senza login tramite un token
 * opaco, quindi qui non c'è una sessione utente e le query passano dal client
 * service-role, come già avviene per il webhook Stripe. È l'unico modo per
 * leggere la riga: la policy RLS su "firme_verbale" la riserva
 * all'amministratore dell'assemblea.
 *
 * Il token da solo non basta a confermare: serve anche il codice usa-e-getta
 * inviato per email all'indirizzo registrato dall'amministratore, che non
 * viaggia mai insieme al link.
 */

/** Intervallo minimo tra due invii di codice, per non usare la pagina come mittente di spam. */
const ATTESA_TRA_INVII_MS = 60_000;

type Esito = { ok?: true; messaggio?: string; errore?: string };

type FirmaConAssemblea = StatoFirma & {
  id: string;
  nominativo: string;
  email: string;
  otp_inviato_il: string | null;
  assemblea: {
    tipo: string;
    data_assemblea: string;
    verbale_url: string | null;
    condominio: { nome: string } | null;
  } | null;
};

async function leggiFirma(token: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("firme_verbale")
    .select(
      "id, nominativo, email, otp_hash, otp_scadenza, otp_tentativi, otp_inviato_il, confermato_il, assemblea:assemblea_id(tipo, data_assemblea, verbale_url, condominio:condominio_id(nome))"
    )
    .eq("token", token)
    .maybeSingle();

  return { supabase, firma: data as unknown as FirmaConAssemblea | null };
}

export async function richiediCodice(token: string): Promise<Esito> {
  if (!token) return { errore: "Collegamento non valido." };

  const { supabase, firma } = await leggiFirma(token);
  if (!firma) return { errore: "Collegamento non valido o non più attivo." };
  if (firma.confermato_il) return { errore: "Hai già confermato questo verbale." };
  if (!firma.assemblea?.verbale_url) {
    return { errore: "Il verbale non è ancora disponibile: riprova più tardi." };
  }

  if (
    firma.otp_inviato_il &&
    Date.now() - new Date(firma.otp_inviato_il).getTime() < ATTESA_TRA_INVII_MS
  ) {
    return { errore: "Un codice è appena stato inviato: controlla la posta e riprova tra un minuto." };
  }

  const codice = generaCodiceOtp();
  const nomeCondominio = firma.assemblea.condominio?.nome ?? "condominio";

  try {
    await resend.emails.send({
      from: MITTENTE_EMAIL,
      to: firma.email,
      subject: `Codice di conferma del verbale — ${nomeCondominio}`,
      html:
        `<p>Il codice per confermare il verbale dell'assemblea ${escapeHtml(
          firma.assemblea.tipo
        )} del ${formatDataOra(firma.assemblea.data_assemblea)} è:</p>` +
        `<p style="font-size:28px;font-weight:700;letter-spacing:4px">${codice}</p>` +
        `<p>È valido ${OTP_VALIDITA_MINUTI} minuti. Se non hai richiesto tu questo codice, ignora questo messaggio.</p>`,
    });
  } catch (e) {
    return {
      errore: `Invio del codice non riuscito (${
        e instanceof Error ? e.message : "errore sconosciuto"
      }).`,
    };
  }

  const { error } = await supabase
    .from("firme_verbale")
    .update({
      otp_hash: hashOtp(token, codice),
      otp_scadenza: scadenzaOtp().toISOString(),
      otp_tentativi: 0,
      otp_inviato_il: new Date().toISOString(),
    })
    .eq("id", firma.id);

  if (error) return { errore: error.message };

  revalidatePath(`/firma-verbale/${token}`);
  return { ok: true, messaggio: `Codice inviato a ${mascheraEmail(firma.email)}.` };
}

export async function confermaFirma(token: string, codiceDigitato: string): Promise<Esito> {
  if (!token) return { errore: "Collegamento non valido." };

  const { supabase, firma } = await leggiFirma(token);
  if (!firma) return { errore: "Collegamento non valido o non più attivo." };

  const esito = verificaOtp(firma, codiceDigitato, token);

  if (!esito.ok) {
    if (esito.incrementaTentativi) {
      await supabase
        .from("firme_verbale")
        .update({ otp_tentativi: firma.otp_tentativi + 1 })
        .eq("id", firma.id);
    }
    return { errore: esito.errore };
  }

  const { error } = await supabase
    .from("firme_verbale")
    .update({
      confermato_il: new Date().toISOString(),
      // Il codice si consuma: una conferma non è ripetibile.
      otp_hash: null,
      otp_scadenza: null,
      // Si registra QUALE file è stato confermato: se il verbale viene
      // sostituito in seguito, la conferma non lo copre.
      verbale_url_confermato: firma.assemblea?.verbale_url ?? null,
    })
    .eq("id", firma.id);

  if (error) return { errore: error.message };

  revalidatePath(`/firma-verbale/${token}`);
  return { ok: true };
}

/** m****o@example.com: conferma l'indirizzo senza scriverlo per esteso. */
function mascheraEmail(email: string): string {
  const [locale, dominio] = email.split("@");
  if (!dominio || locale.length < 3) return email;
  return `${locale[0]}${"*".repeat(Math.max(locale.length - 2, 1))}${locale.at(-1)}@${dominio}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
