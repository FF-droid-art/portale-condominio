import "server-only";
import { createClient } from "@/lib/supabase/server";
import { MITTENTE_EMAIL, resend } from "@/lib/resend";
import { utentiDaNotificare, type RigaPreferenza, type TipoEvento } from "@/lib/notifiche";

/**
 * Il cancello attraverso cui passano le email transazionali dirette a un
 * condòmino: legge le sue preferenze (`@/lib/notifiche`) e solo dopo consegna a
 * Resend.
 *
 * Sta in un modulo a parte perché tocca database e servizio esterno, mentre la
 * decisione vera — "questa email va spedita?" — resta una funzione pura e
 * verificabile in `@/lib/notifiche`. Qui dentro c'è solo il contorno.
 *
 * Tutti gli invii sono best-effort, come già gli altri del portale: un errore
 * di Resend non deve mai far fallire l'operazione che ha generato l'avviso (la
 * spesa è ripartita, l'assemblea è convocata). Il valore restituito dice quanti
 * destinatari hanno ricevuto davvero il messaggio.
 */

/** Legge in un colpo solo le preferenze di un gruppo di utenti. */
async function leggiPreferenze(utentiIds: string[]): Promise<RigaPreferenza[]> {
  if (!utentiIds.length) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("preferenze_notifiche")
    .select("utente_id, tipo_evento, email_attiva")
    .in("utente_id", utentiIds);
  return (data ?? []) as RigaPreferenza[];
}

export type EsitoNotifica = {
  /** Destinatari a cui il messaggio è stato effettivamente consegnato. */
  inviate: number;
  /** Destinatari che avevano disattivato questo tipo di avviso. */
  saltate: number;
};

/**
 * Invia a un singolo condòmino, se non ha disattivato quel tipo di avviso.
 */
export async function inviaNotificaEmail(input: {
  utenteId: string;
  tipoEvento: TipoEvento;
  to: string;
  subject: string;
  html: string;
}): Promise<EsitoNotifica> {
  return inviaNotificaEmailMultipla({
    destinatari: [{ utenteId: input.utenteId, email: input.to }],
    tipoEvento: input.tipoEvento,
    subject: input.subject,
    html: input.html,
  });
}

/**
 * Invia lo stesso messaggio a più condòmini raggruppandoli in poche chiamate.
 *
 * Il piano gratuito di Resend consente 100 email al giorno: un solo messaggio
 * con più destinatari costa una email invece di una per persona, che per una
 * convocazione di condominio è la differenza tra restare nel piano e uscirne.
 * Resend accetta al massimo 50 destinatari per messaggio, quindi gli elenchi
 * più lunghi vengono spezzati.
 */
const MAX_DESTINATARI_PER_MESSAGGIO = 50;
export async function inviaNotificaEmailMultipla(input: {
  destinatari: { utenteId: string; email: string }[];
  tipoEvento: TipoEvento;
  subject: string;
  html: string;
  /** Vero per mandare messaggi separati (quando il testo è personale). */
  separati?: boolean;
}): Promise<EsitoNotifica> {
  // Un utente può comparire due volte (due unità nello stesso condominio):
  // l'email va comunque spedita una volta sola.
  const perUtente = new Map<string, string>();
  for (const d of input.destinatari) {
    if (d.utenteId && d.email && !perUtente.has(d.utenteId)) perUtente.set(d.utenteId, d.email);
  }
  const utentiIds = [...perUtente.keys()];
  if (!utentiIds.length) return { inviate: 0, saltate: 0 };

  const preferenze = await leggiPreferenze(utentiIds);
  const ammessi = utentiDaNotificare(preferenze, input.tipoEvento, utentiIds);
  const saltate = utentiIds.length - ammessi.length;
  if (!ammessi.length) return { inviate: 0, saltate };

  const email = ammessi.map((id) => perUtente.get(id)!);

  try {
    if (input.separati) {
      await Promise.all(
        email.map((to) =>
          resend.emails.send({
            from: MITTENTE_EMAIL,
            to,
            subject: input.subject,
            html: input.html,
          })
        )
      );
    } else {
      for (let i = 0; i < email.length; i += MAX_DESTINATARI_PER_MESSAGGIO) {
        await resend.emails.send({
          from: MITTENTE_EMAIL,
          to: email.slice(i, i + MAX_DESTINATARI_PER_MESSAGGIO),
          subject: input.subject,
          html: input.html,
        });
      }
    }
  } catch (errore) {
    // Best-effort: vedi il commento in testa al file. L'operazione che ha
    // generato l'avviso resta comunque andata a buon fine; logghiamo solo
    // perché altrimenti un invio fallito non lascia nessuna traccia (COD-09
    // in docs/audit/01-codice.md).
    console.error("inviaNotificaEmailMultipla: invio Resend fallito", {
      tipoEvento: input.tipoEvento,
      destinatari: email.length,
      errore,
    });
    return { inviate: 0, saltate };
  }

  return { inviate: email.length, saltate };
}

/**
 * Invia messaggi diversi a destinatari diversi (il classico "ti è stata
 * addebitata una quota di…", dove l'importo cambia da unità a unità) leggendo
 * le preferenze una volta sola per tutti.
 */
export async function inviaNotifichePersonalizzate(input: {
  messaggi: { utenteId: string; email: string; subject: string; html: string }[];
  tipoEvento: TipoEvento;
}): Promise<EsitoNotifica> {
  const messaggi = input.messaggi.filter((m) => m.utenteId && m.email);
  if (!messaggi.length) return { inviate: 0, saltate: 0 };

  const utentiIds = [...new Set(messaggi.map((m) => m.utenteId))];
  const preferenze = await leggiPreferenze(utentiIds);
  const ammessi = new Set(utentiDaNotificare(preferenze, input.tipoEvento, utentiIds));

  const daInviare = messaggi.filter((m) => ammessi.has(m.utenteId));
  if (!daInviare.length) return { inviate: 0, saltate: messaggi.length };

  try {
    await Promise.all(
      daInviare.map((m) =>
        resend.emails.send({
          from: MITTENTE_EMAIL,
          to: m.email,
          subject: m.subject,
          html: m.html,
        })
      )
    );
  } catch (errore) {
    // Best-effort: vedi il commento in testa al file e la nota su COD-09
    // in inviaNotificaEmailMultipla sopra.
    console.error("inviaNotifichePersonalizzate: invio Resend fallito", {
      tipoEvento: input.tipoEvento,
      destinatari: daInviare.length,
      errore,
    });
    return { inviate: 0, saltate: messaggi.length - daInviare.length };
  }

  return { inviate: daInviare.length, saltate: messaggi.length - daInviare.length };
}
