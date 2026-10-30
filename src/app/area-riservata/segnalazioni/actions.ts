"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { richiedeUtente } from "@/lib/supabase/dal";
import {
  CATEGORIE_SEGNALAZIONE,
  FOTO_MAX_BYTES,
  PRIORITA_SEGNALAZIONE,
} from "@/lib/segnalazioni";
import { FAMIGLIE_IMMAGINE, testaDiFile, verificaTipoFile } from "@/lib/tipi-file";
import type { CategoriaSegnalazione, PrioritaSegnalazione } from "@/lib/types";

export type StatoForm = { errore?: string } | undefined;

function rivalida(segnalazioneId?: string) {
  revalidatePath("/area-riservata/segnalazioni");
  revalidatePath("/admin/segnalazioni");
  if (segnalazioneId) {
    revalidatePath(`/area-riservata/segnalazioni/${segnalazioneId}`);
    revalidatePath(`/admin/segnalazioni/${segnalazioneId}`);
  }
}

/**
 * Apertura di una segnalazione da parte di un condòmino.
 *
 * La foto viene caricata DOPO l'inserimento della riga, perché il percorso nello
 * storage contiene l'id della segnalazione ed è su quell'id che la policy del
 * bucket decide chi può scrivere. Se il caricamento fallisce la riga viene
 * rimossa: meglio far ripetere l'invio che lasciare una segnalazione monca di
 * quello che il condòmino voleva far vedere.
 */
export async function creaSegnalazione(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const titolo = String(formData.get("titolo") ?? "").trim();
  const descrizione = String(formData.get("descrizione") ?? "").trim();
  const condominioId = String(formData.get("condominio_id") ?? "");
  // "" = parti comuni
  const unitaId = String(formData.get("unita_id") ?? "").trim();
  const categoriaRichiesta = String(formData.get("categoria") ?? "");
  const prioritaRichiesta = String(formData.get("priorita") ?? "");
  const foto = formData.get("foto");

  if (!condominioId) return { errore: "Seleziona il condominio." };
  if (!titolo) return { errore: "Scrivi in poche parole di che cosa si tratta." };
  if (!descrizione) return { errore: "Descrivi il problema: aiuta a capire chi mandare." };

  const categoria: CategoriaSegnalazione = (CATEGORIE_SEGNALAZIONE as string[]).includes(
    categoriaRichiesta
  )
    ? (categoriaRichiesta as CategoriaSegnalazione)
    : "altro";
  const priorita: PrioritaSegnalazione = (PRIORITA_SEGNALAZIONE as string[]).includes(
    prioritaRichiesta
  )
    ? (prioritaRichiesta as PrioritaSegnalazione)
    : "normale";

  const haFoto = foto instanceof File && foto.size > 0;
  if (haFoto && foto.size > FOTO_MAX_BYTES) {
    return { errore: "La foto supera i 4 MB consentiti." };
  }

  // COD-06: qui carica un condòmino, non l'amministratore, ed è il punto di
  // upload con la platea più larga del portale. Il formato si verifica sui
  // primi byte (sono ammesse solo immagini) e il controllo viene prima di
  // creare la riga, per non dover disfare niente se il file non va bene.
  let tipoFoto: { mime: string; estensione: string } | null = null;
  if (haFoto) {
    const esito = verificaTipoFile(await testaDiFile(foto), foto.name, FAMIGLIE_IMMAGINE);
    if (!esito.ok) return { errore: esito.errore };
    tipoFoto = { mime: esito.mime, estensione: esito.estensione };
  }

  const utente = await richiedeUtente();
  const supabase = await createClient();

  const { data: segnalazione, error } = await supabase
    .from("segnalazioni")
    .insert({
      condominio_id: condominioId,
      unita_id: unitaId || null,
      titolo,
      descrizione,
      categoria,
      priorita,
      aperta_da: utente.id,
    })
    .select("id")
    .single();

  if (error || !segnalazione) {
    if (error) {
      console.error("[segnalazioni] apertura non riuscita", {
        condominioId,
        errore: error.message,
      });
    }
    return { errore: "Impossibile aprire la segnalazione: riprova." };
  }

  if (haFoto && tipoFoto) {
    const percorso = `segnalazioni/${segnalazione.id}/${Date.now()}.${tipoFoto.estensione}`;

    const { error: erroreUpload } = await supabase.storage
      .from("documenti-condominio")
      .upload(percorso, foto, { contentType: tipoFoto.mime });

    if (erroreUpload) {
      await supabase.from("segnalazioni").delete().eq("id", segnalazione.id);
      console.error("[segnalazioni] caricamento della foto non riuscito", {
        segnalazioneId: segnalazione.id,
        errore: erroreUpload.message,
      });
      return { errore: "La foto non è stata caricata: riprova." };
    }

    const { error: erroreAggiornamento } = await supabase
      .from("segnalazioni")
      .update({ foto_url: percorso })
      .eq("id", segnalazione.id);

    if (erroreAggiornamento) {
      await supabase.storage.from("documenti-condominio").remove([percorso]);
      await supabase.from("segnalazioni").delete().eq("id", segnalazione.id);
      console.error("[segnalazioni] collegamento della foto non riuscito", {
        segnalazioneId: segnalazione.id,
        errore: erroreAggiornamento.message,
      });
      return { errore: "La segnalazione non è stata salvata: riprova." };
    }
  }

  rivalida(segnalazione.id);
}

export async function aggiungiNotaCondomino(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const segnalazioneId = String(formData.get("segnalazione_id") ?? "");
  const testo = String(formData.get("testo") ?? "").trim();

  if (!segnalazioneId) return { errore: "Segnalazione non valida." };
  if (!testo) return { errore: "Scrivi il testo del messaggio." };

  const utente = await richiedeUtente();
  const supabase = await createClient();

  // "interna" resta esplicitamente false: la nota di servizio è una funzione
  // dell'amministratore, e la policy di insert non permetterebbe comunque a un
  // condòmino di scriverne una.
  const { error } = await supabase.from("segnalazione_note").insert({
    segnalazione_id: segnalazioneId,
    autore_id: utente.id,
    testo,
    interna: false,
  });

  if (error) return { errore: error.message };
  rivalida(segnalazioneId);
}

/**
 * Ritiro di una segnalazione da parte di chi l'ha aperta.
 *
 * Solo finché è ancora "aperta": una volta presa in carico la traccia serve
 * anche all'amministratore, e chiuderla è una sua decisione (la policy RLS
 * impone la stessa condizione, questo controllo serve solo a dare un messaggio
 * comprensibile invece di un errore del database).
 */
export async function ritiraSegnalazione(id: string): Promise<{ errore?: string } | void> {
  if (!id) return { errore: "Segnalazione non valida." };
  await richiedeUtente();

  const supabase = await createClient();
  const { data: segnalazione } = await supabase
    .from("segnalazioni")
    .select("id, stato")
    .eq("id", id)
    .single();

  if (!segnalazione) return { errore: "Segnalazione non trovata." };
  if (segnalazione.stato !== "aperta") {
    return {
      errore:
        "La segnalazione è già stata presa in carico: chiedi all'amministratore di chiuderla.",
    };
  }

  const { error } = await supabase.from("segnalazioni").delete().eq("id", id);
  if (error) return { errore: error.message };

  rivalida();
  redirect("/area-riservata/segnalazioni");
}
