"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { richiedeAmministratore } from "@/lib/supabase/dal";
import { messaggioErrore } from "@/lib/errori";
import { haQuota } from "@/lib/ruoli";
import {
  codiceFiscaleValido,
  normalizzaCodiceFiscale,
  normalizzaDatiCatastali,
} from "@/lib/anagrafe";

const TIPI_SOGGETTO = [
  "proprietario",
  "nudo_proprietario",
  "usufruttuario",
  "conduttore",
  "comodatario",
  "assegnatario",
];

export type InputAggiungiSoggetto = {
  unitaId: string;
  condominioId: string;
  nominativo: string;
  email: string;
  telefono: string | null;
  tipoSoggetto: string;
  quota: number;
  dirittoVoto: boolean;
  // Dati del registro di anagrafe (art. 1130, n. 6, c.c.): facoltativi,
  // si raccolgono anche dopo aver collegato la persona all'unità.
  codiceFiscale?: string | null;
  residenzaDomicilio?: string | null;
  // Come risolvere l'anagrafica:
  //  - riusaId: riusa l'anagrafica esistente indicata (conferma "stessa persona")
  //  - forzaNuovo: crea comunque una nuova anagrafica (conferma "persona diversa")
  //  - nessuno dei due: cerca per email/nome e, se trova un omonimo, chiede conferma
  riusaId?: string;
  forzaNuovo?: boolean;
};

export type RisultatoAggiungiSoggetto =
  | { ok: true }
  | { errore: string }
  | {
      needsConfirm: true;
      esistente: { id: string; nominativo: string; email: string | null };
    };

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Riempie codice fiscale e residenza di un'anagrafica già esistente, ma
 * SOLO dove sono ancora vuoti.
 *
 * Succede quando l'amministratore collega all'unità una persona che in
 * quel condominio c'è già (stessa email, o "sì, è la stessa persona")
 * avendo però digitato nel modulo dati che in archivio mancavano: senza
 * questo, quei dati andrebbero persi senza dirlo. Non sovrascrive un
 * valore già presente — un dato del registro si corregge dalla scheda
 * della persona, non di sbieco mentre si aggiunge un legame.
 */
async function completaDatiAnagrafe(
  supabase: Supabase,
  anagraficaId: string,
  codiceFiscale: string | null,
  residenzaDomicilio: string | null
): Promise<void> {
  if (!codiceFiscale && !residenzaDomicilio) return;

  const { data: esistente } = await supabase
    .from("anagrafiche")
    .select("codice_fiscale, residenza_domicilio")
    .eq("id", anagraficaId)
    .maybeSingle();
  if (!esistente) return;

  const patch: { codice_fiscale?: string; residenza_domicilio?: string } = {};
  if (codiceFiscale && !esistente.codice_fiscale) patch.codice_fiscale = codiceFiscale;
  if (residenzaDomicilio && !esistente.residenza_domicilio) {
    patch.residenza_domicilio = residenzaDomicilio;
  }
  if (!Object.keys(patch).length) return;

  const { error } = await supabase.from("anagrafiche").update(patch).eq("id", anagraficaId);
  if (error) console.error("[anagrafiche] completamento dati di anagrafe non riuscito", error);
}

export async function aggiungiSoggetto(
  input: InputAggiungiSoggetto
): Promise<RisultatoAggiungiSoggetto> {
  const nominativo = input.nominativo.trim();
  const email = input.email.trim();
  const telefono = input.telefono?.trim() || null;

  if (!input.unitaId || !input.condominioId) return { errore: "Unità non valida." };
  if (!nominativo) return { errore: "Il nome è obbligatorio." };
  if (!RE_EMAIL.test(email)) return { errore: "Inserisci un'email valida." };
  if (!TIPI_SOGGETTO.includes(input.tipoSoggetto)) {
    return { errore: "Ruolo non valido." };
  }
  // La quota vale solo per i ruoli di proprietà; per conduttori/comodatari
  // non è richiesta (si registra 100 di default ma non viene mostrata).
  const conQuota = haQuota(input.tipoSoggetto);
  if (conQuota && (!Number.isFinite(input.quota) || input.quota <= 0 || input.quota > 100)) {
    return { errore: "Quota non valida (1-100)." };
  }
  const quotaPossesso = conQuota ? input.quota : 100;

  // Codice fiscale e residenza sono facoltativi, ma se il codice fiscale
  // c'è e ha una forma impossibile conviene dirlo subito: è un dato che
  // finisce nel registro di anagrafe e nei documenti.
  const codiceFiscale = normalizzaCodiceFiscale(input.codiceFiscale);
  if (codiceFiscale && !codiceFiscaleValido(codiceFiscale)) {
    return { errore: "Il codice fiscale non sembra valido (16 caratteri, o 11 cifre per una società)." };
  }
  const residenzaDomicilio = input.residenzaDomicilio?.trim() || null;

  await richiedeAmministratore();
  const supabase = await createClient();

  let anagraficaId: string | null = null;

  if (input.riusaId) {
    // L'admin ha confermato "è la stessa persona": riusa quell'anagrafica.
    anagraficaId = input.riusaId;
    await completaDatiAnagrafe(supabase, input.riusaId, codiceFiscale, residenzaDomicilio);
  } else {
    // Stessa email nello stesso condominio → è la stessa persona, riusa
    // senza disturbare l'admin.
    const { data: perEmail } = await supabase
      .from("anagrafiche")
      .select("id")
      .eq("condominio_id", input.condominioId)
      .ilike("email", email)
      .limit(1)
      .maybeSingle();

    if (perEmail) {
      anagraficaId = perEmail.id;
      await completaDatiAnagrafe(supabase, perEmail.id, codiceFiscale, residenzaDomicilio);
    } else if (!input.forzaNuovo) {
      // Stesso nome ma email diversa → ambiguo: chiedi conferma all'admin.
      const { data: perNome } = await supabase
        .from("anagrafiche")
        .select("id, nominativo, email")
        .eq("condominio_id", input.condominioId)
        .ilike("nominativo", nominativo)
        .limit(1);

      if (perNome && perNome.length) {
        return { needsConfirm: true, esistente: perNome[0] };
      }
    }

    if (!anagraficaId) {
      const { data: nuova, error: erroreAnag } = await supabase
        .from("anagrafiche")
        .insert({
          condominio_id: input.condominioId,
          nominativo,
          email,
          telefono,
          codice_fiscale: codiceFiscale,
          residenza_domicilio: residenzaDomicilio,
        })
        .select("id")
        .single();
      if (erroreAnag || !nuova) {
        console.error("[anagrafiche] creazione non riuscita", erroreAnag);
        return { errore: "Impossibile creare l'anagrafica. Riprova." };
      }
      anagraficaId = nuova.id;
    }
  }

  const { error } = await supabase.from("unita_proprietari").insert({
    unita_id: input.unitaId,
    anagrafica_id: anagraficaId,
    quota_possesso: quotaPossesso,
    tipo_soggetto: input.tipoSoggetto,
    diritto_voto: input.dirittoVoto,
    attivo: true,
  });

  if (error) {
    if (error.code === "23505") return { errore: "Questo soggetto è già collegato all'unità." };
    return { errore: messaggioErrore(error, "admin/unita/aggiungiSoggetto") };
  }

  revalidatePath(`/admin/unita/${input.unitaId}`);
  return { ok: true };
}

/**
 * Dati di anagrafe della persona: contatti più i dati che l'art. 1130,
 * n. 6, c.c. richiede per il registro (codice fiscale, residenza o
 * domicilio). Valgono per la persona in tutte le sue unità, quindi si
 * scrivono sull'anagrafica e non sul legame con l'unità.
 */
export async function aggiornaDatiAnagrafici(input: {
  anagraficaId: string;
  unitaId: string;
  email: string;
  telefono: string | null;
  codiceFiscale: string | null;
  residenzaDomicilio: string | null;
}): Promise<{ ok: true } | { errore: string }> {
  const email = input.email.trim();
  const telefono = input.telefono?.trim() || null;
  if (!input.anagraficaId) return { errore: "Anagrafica non valida." };
  if (!RE_EMAIL.test(email)) return { errore: "Inserisci un'email valida." };

  const codiceFiscale = normalizzaCodiceFiscale(input.codiceFiscale);
  if (codiceFiscale && !codiceFiscaleValido(codiceFiscale)) {
    return { errore: "Il codice fiscale non sembra valido (16 caratteri, o 11 cifre per una società)." };
  }

  await richiedeAmministratore();
  const supabase = await createClient();
  // La RLS consente la modifica solo all'amministratore del condominio.
  const { error } = await supabase
    .from("anagrafiche")
    .update({
      email,
      telefono,
      codice_fiscale: codiceFiscale,
      residenza_domicilio: input.residenzaDomicilio?.trim() || null,
    })
    .eq("id", input.anagraficaId);
  if (error) {
    console.error("[anagrafiche] aggiornamento dati di anagrafe non riuscito", error);
    return { errore: "Impossibile salvare i dati della persona. Riprova." };
  }

  revalidatePath(`/admin/unita/${input.unitaId}`);
  return { ok: true };
}

/**
 * Dati catastali dell'unità (art. 1130, n. 6, c.c.).
 *
 * Tutti facoltativi e salvati come testo: si copiano da una visura, dove
 * il subalterno può avere zeri iniziali e la categoria è un codice.
 */
export async function aggiornaDatiCatastali(input: {
  unitaId: string;
  condominioId: string;
  foglio: string | null;
  particella: string | null;
  subalterno: string | null;
  categoria: string | null;
}): Promise<{ ok: true } | { errore: string }> {
  if (!input.unitaId) return { errore: "Unità non valida." };

  const dati = normalizzaDatiCatastali(input);

  await richiedeAmministratore();
  const supabase = await createClient();
  const { error } = await supabase
    .from("unita")
    .update({
      catasto_foglio: dati.foglio,
      catasto_particella: dati.particella,
      catasto_subalterno: dati.subalterno,
      catasto_categoria: dati.categoria,
    })
    .eq("id", input.unitaId);
  if (error) {
    console.error("[unita] aggiornamento dati catastali non riuscito", error);
    return { errore: "Impossibile salvare i dati catastali. Riprova." };
  }

  revalidatePath(`/admin/unita/${input.unitaId}`);
  if (input.condominioId) revalidatePath(`/admin/condomini/${input.condominioId}`);
  return { ok: true };
}

export async function aggiornaMillesimi(input: {
  unitaId: string;
  condominioId: string;
  millesimi: number;
}): Promise<{ ok: true } | { errore: string }> {
  if (!input.unitaId) return { errore: "Unità non valida." };
  if (!Number.isFinite(input.millesimi) || input.millesimi < 0) {
    return { errore: "Millesimi non validi." };
  }

  await richiedeAmministratore();
  const supabase = await createClient();
  const { error } = await supabase
    .from("unita")
    .update({ millesimi_proprieta: input.millesimi })
    .eq("id", input.unitaId);
  if (error) return { errore: messaggioErrore(error, "admin/unita/aggiornaMillesimi") };

  revalidatePath(`/admin/unita/${input.unitaId}`);
  if (input.condominioId) revalidatePath(`/admin/condomini/${input.condominioId}`);
  return { ok: true };
}

export async function rimuoviProprietario(
  id: string,
  unitaId: string
): Promise<{ errore?: string }> {
  await richiedeAmministratore();
  const supabase = await createClient();
  const { error } = await supabase.from("unita_proprietari").delete().eq("id", id);
  if (error) return { errore: messaggioErrore(error, "admin/unita/rimuoviProprietario") };

  revalidatePath(`/admin/unita/${unitaId}`);
  return {};
}
