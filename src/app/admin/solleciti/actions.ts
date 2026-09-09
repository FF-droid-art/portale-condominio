"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { richiedeAmministratore } from "@/lib/supabase/dal";
import { inviaNotificaEmailMultipla } from "@/lib/notifiche-invio";
import { ETICHETTE_LIVELLO, isLivelloSollecito } from "@/lib/solleciti";
import { formatValuta } from "@/lib/format";
import { oggiLocale } from "@/lib/fuso";
import { leggiPosizioneUnita } from "./sollecito-dati";

export type StatoForm = { errore?: string } | undefined;

export type EsitoSollecito =
  | { ok: true; emailInviate: number; emailSaltate: number; senzaAccount: number }
  | { errore: string };

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Registra un sollecito e, se richiesto, ne manda avviso via email.
 *
 * La riga nella tabella `solleciti` viene scritta SEMPRE, anche quando l'email
 * non parte: è lo storico di che cosa è stato mandato e quando, e serve
 * all'amministratore per sapere a che punto è con quella unità (e, nei casi
 * spiacevoli, per dimostrare di aver sollecitato). Il PDF resta comunque
 * scaricabile e recapitabile a mano o per posta.
 *
 * L'email è un avviso di cortesia, non la lettera: chi la riceve trova nel
 * portale la propria posizione. Passa dal cancello delle preferenze
 * (`sollecito_pagamento`), quindi chi ha disattivato quella voce non la riceve
 * — la registrazione del sollecito però resta, ed è quella che conta.
 */
export async function registraSollecito(input: {
  unitaId: string;
  livello: number;
  note: string;
  inviaEmail: boolean;
}): Promise<EsitoSollecito> {
  if (!input.unitaId) return { errore: "Unità non valida." };
  if (!isLivelloSollecito(input.livello)) return { errore: "Livello di sollecito non valido." };

  const amministratore = await richiedeAmministratore();
  const supabase = await createClient();

  const posizione = await leggiPosizioneUnita(input.unitaId);
  if (!posizione) return { errore: "Unità non trovata." };
  if (!posizione.rate.length) {
    return { errore: "Questa unità non ha quote scadute: non c'è nulla da sollecitare." };
  }

  const { error } = await supabase.from("solleciti").insert({
    condominio_id: posizione.unita.condominioId,
    unita_id: posizione.unita.id,
    livello: input.livello,
    importo_totale: posizione.totale,
    data_invio: oggiLocale(),
    inviato_da: amministratore.id,
    note: input.note.trim() || null,
  });

  if (error) return { errore: error.message };

  let emailInviate = 0;
  let emailSaltate = 0;

  if (input.inviaEmail && posizione.utentiCollegati.length) {
    const esito = await inviaNotificaEmailMultipla({
      tipoEvento: "sollecito_pagamento",
      destinatari: posizione.utentiCollegati,
      // Messaggi separati: il destinatario non deve vedere gli altri
      // intestatari, e soprattutto non deve arrivare a chi non c'entra.
      separati: true,
      subject: `${ETICHETTE_LIVELLO[input.livello]} — ${posizione.condominio.nome}`,
      html:
        `<p>Dalla contabilità del condominio ${escapeHtml(posizione.condominio.nome)} ` +
        `risultano quote scadute a carico dell'unità ${escapeHtml(
          posizione.unita.identificativo
        )}.</p>` +
        `<p><strong>Totale: ${formatValuta(posizione.totale)}</strong> su ${
          posizione.rate.length
        } ${posizione.rate.length === 1 ? "quota" : "quote"}.</p>` +
        "<p>Accedi al portale per vedere il dettaglio delle quote e le coordinate per il " +
        "versamento. Se hai già pagato, trasmetti la contabile all'amministrazione.</p>",
    });
    emailInviate = esito.inviate;
    emailSaltate = esito.saltate;
  }

  revalidatePath("/admin/solleciti");
  revalidatePath(`/admin/unita/${posizione.unita.id}`);

  return {
    ok: true,
    emailInviate,
    emailSaltate,
    senzaAccount: Math.max(posizione.destinatari.length - posizione.utentiCollegati.length, 0),
  };
}
