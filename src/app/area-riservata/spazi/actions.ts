"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { richiedeUtente } from "@/lib/supabase/dal";
import { messaggioErrore } from "@/lib/errori";
import { adessoLocale } from "@/lib/fuso";
import { normalizzaIstante, validaPrenotazione } from "@/lib/prenotazioni";

export type StatoForm = { errore?: string } | undefined;

function rivalida() {
  revalidatePath("/area-riservata/spazi");
  revalidatePath("/admin/spazi");
  revalidatePath("/area-riservata/calendario");
  revalidatePath("/admin/calendario");
}

/**
 * Prenotazione di uno spazio comune da parte di un condòmino.
 *
 * La verifica passa da `validaPrenotazione`, la stessa funzione pura che
 * conosce gli orari, la durata massima e le sovrapposizioni: qui serve a dare
 * un messaggio comprensibile. Il vincolo vero resta il trigger sul database,
 * che è anche l'unico a essere al riparo dalla corsa tra due condòmini che
 * prenotano la stessa fascia nello stesso istante — per questo l'errore di
 * conflitto viene riconosciuto e tradotto anche dopo l'insert.
 */
export async function prenotaSpazio(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const spazioId = String(formData.get("spazio_id") ?? "");
  const unitaId = String(formData.get("unita_id") ?? "");
  const giorno = String(formData.get("giorno") ?? "").trim();
  const oraInizio = String(formData.get("ora_inizio") ?? "").trim();
  const oraFine = String(formData.get("ora_fine") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!spazioId) return { errore: "Spazio non valido." };
  if (!unitaId) return { errore: "Indica per quale unità stai prenotando." };

  const utente = await richiedeUtente();
  const supabase = await createClient();

  const { data: spazio } = await supabase
    .from("spazi_comuni")
    .select("nome, posti, ora_apertura, ora_chiusura, durata_massima_ore, attivo")
    .eq("id", spazioId)
    .single();

  if (!spazio) return { errore: "Spazio non trovato." };

  // Bastano le prenotazioni del giorno richiesto: una fascia non può
  // scavalcare la mezzanotte, perché inizio e fine nascono dallo stesso giorno.
  const { data: esistenti } = await supabase
    .from("prenotazioni_spazi")
    .select("id, inizio, fine, stato")
    .eq("spazio_id", spazioId)
    .gte("inizio", `${giorno}T00:00:00`)
    .lte("inizio", `${giorno}T23:59:59`);

  const esito = validaPrenotazione({
    spazio,
    giorno,
    oraInizio,
    oraFine,
    esistenti: esistenti ?? [],
    adesso: adessoLocale(),
  });

  if ("errore" in esito) return { errore: esito.errore };

  const { error } = await supabase.from("prenotazioni_spazi").insert({
    spazio_id: spazioId,
    unita_id: unitaId,
    utente_id: utente.id,
    inizio: esito.inizio,
    fine: esito.fine,
    note: note || null,
  });

  if (error) {
    // 23505: il trigger di disponibilità segnala così una sovrapposizione
    // arrivata tra il controllo qui sopra e la scrittura.
    if (error.code === "23505") {
      return { errore: "Qualcuno ha appena prenotato questa fascia oraria: scegline un'altra." };
    }
    return { errore: messaggioErrore(error, "area-riservata/spazi/prenotaSpazio") };
  }

  rivalida();
}

/**
 * Annullamento della propria prenotazione. Non viene cancellata ma marcata
 * come annullata: lo storico dell'uso degli spazi comuni serve
 * all'amministratore, e una fascia liberata all'ultimo momento è
 * un'informazione, non un errore da nascondere.
 */
export async function annullaPrenotazione(id: string): Promise<{ errore?: string }> {
  if (!id) return { errore: "Prenotazione non valida." };
  const utente = await richiedeUtente();

  const supabase = await createClient();
  const { data: prenotazione } = await supabase
    .from("prenotazioni_spazi")
    .select("id, utente_id, fine, stato")
    .eq("id", id)
    .single();

  if (!prenotazione) return { errore: "Prenotazione non trovata." };
  if (prenotazione.utente_id !== utente.id) {
    return { errore: "Puoi annullare solo le prenotazioni che hai fatto tu." };
  }
  if (prenotazione.stato === "annullata") return {};
  if (normalizzaIstante(prenotazione.fine) < adessoLocale()) {
    return { errore: "La prenotazione è già passata: non c'è più niente da annullare." };
  }

  const { error } = await supabase
    .from("prenotazioni_spazi")
    .update({ stato: "annullata" })
    .eq("id", id);

  if (error) return { errore: messaggioErrore(error, "area-riservata/spazi/annullaPrenotazione") };

  rivalida();
  return {};
}
