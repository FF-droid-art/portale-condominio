"use server";

import { headers } from "next/headers";
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
import { estraiIp } from "@/lib/limite-tentativi";
import { registraTentativo } from "@/lib/limite-tentativi-registra";

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

  // COD-05, primo livello: tetto per indirizzo IP, a prescindere dal token.
  // Il throttle di 60s qui sotto vale per singola riga `firme_verbale`,
  // quindi non limita chi gira fra token diversi: il costo degli invii
  // (Resend) resterebbe senza tetto. La soglia è alta di proposito — vedi
  // `LIMITI.richiesta_otp_firma_ip` — perché una connessione condivisa non
  // la deve incontrare mai. Senza IP noto (sviluppo locale) il controllo si
  // salta: una chiave unica per tutti gli IP ignoti bloccherebbe la firma
  // per chiunque.
  const ip = estraiIp(await headers());
  if (ip) {
    const limiteIp = await registraTentativo("richiesta_otp_firma_ip", [ip]);
    if (limiteIp.bloccato) return { errore: limiteIp.messaggio };
  }

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

  // COD-05, secondo livello: quanti codici in tutto si possono far partire
  // su questo link. Il contatore è qui e non in testa alla funzione di
  // proposito: conta gli invii effettivi, non i clic — chi preme due volte
  // e incontra il throttle di 60s non si consuma un invio. La chiave è
  // token+IP: il token è già alta entropia, l'IP evita che un link
  // legittimo esaurisca il proprio credito per colpa di terzi che lo
  // provano.
  const limiteInvii = await registraTentativo("richiesta_otp_firma", [token, ip]);
  if (limiteInvii.bloccato) return { errore: limiteInvii.messaggio };

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
    // COD-02/COD-09: il dettaglio del provider di posta si logga, non si
    // mostra a chi deve solo firmare un verbale.
    console.error("[firma-verbale] invio del codice non riuscito", {
      firmaId: firma.id,
      errore: e instanceof Error ? e.message : e,
    });
    return { errore: "Invio del codice non riuscito: riprova tra qualche minuto." };
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

  if (error) {
    console.error("[firma-verbale] salvataggio del codice non riuscito", {
      firmaId: firma.id,
      errore: error.message,
    });
    return { errore: "Non è stato possibile registrare il codice: riprova." };
  }

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

  if (error) {
    // Flusso critico (CLAUDE.md, punto 7): una conferma che non si scrive
    // deve lasciare traccia, altrimenti nessuno saprà perché quel verbale
    // risulta non firmato.
    console.error("[firma-verbale] registrazione della conferma non riuscita", {
      firmaId: firma.id,
      errore: error.message,
    });
    return { errore: "Non è stato possibile registrare la conferma: riprova." };
  }

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
