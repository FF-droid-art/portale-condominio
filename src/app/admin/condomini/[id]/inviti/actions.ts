"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { richiedeAmministratore } from "@/lib/supabase/dal";
import { formattaCodiceInvito } from "@/lib/inviti";

/**
 * Azioni sui codici di invito delle unità.
 *
 * Entrambe passano da una funzione `security definer` del database
 * (`rigenera_codice_invito`, `genera_codici_invito_mancanti`) e non da una
 * scrittura diretta sulla tabella, per due motivi:
 *
 *  - il codice lo genera il database (`genera_codice_invito`), così esiste
 *    un solo generatore e un solo alfabeto in tutto il progetto — un
 *    secondo generatore in TypeScript sarebbe l'occasione perfetta per far
 *    divergere i due;
 *  - il backfill di un intero condominio è un `insert ... select`, che
 *    PostgREST non sa esprimere: dall'applicazione servirebbe una
 *    chiamata di rete per unità.
 *
 * Il perimetro di autorizzazione resta quello di sempre: le due funzioni
 * verificano al loro interno `admin_gestisce_unita` /
 * `admin_possiede_condominio` (non possono appoggiarsi alla RLS, essendo
 * `security definer`), e `richiedeAmministratore()` qui davanti serve per
 * dare un errore sensato a chi non è autorizzato invece di un messaggio di
 * database — COD-04.
 */

export type EsitoRigenerazione = { ok: true; codice: string } | { errore: string };

export async function rigeneraCodiceInvito(input: {
  unitaId: string;
  condominioId: string;
}): Promise<EsitoRigenerazione> {
  if (!input.unitaId) return { errore: "Unità non valida." };

  await richiedeAmministratore();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("rigenera_codice_invito", {
    p_unita_id: input.unitaId,
  });

  if (error || typeof data !== "string") {
    // COD-02: il messaggio di Postgres non arriva all'utente; COD-09: il
    // dettaglio originale resta nei log, perché un codice che non si
    // rigenera va diagnosticato.
    console.error("[inviti] rigenerazione del codice non riuscita", {
      unitaId: input.unitaId,
      errore: error?.message,
    });
    return {
      errore:
        "Impossibile rigenerare il codice di invito di questa unità. Riprova, " +
        "e se il problema resta verifica di essere l'amministratore di questo condominio.",
    };
  }

  revalidatePath(`/admin/unita/${input.unitaId}`);
  if (input.condominioId) {
    revalidatePath(`/admin/condomini/${input.condominioId}/inviti`);
  }
  return { ok: true, codice: formattaCodiceInvito(data) };
}

export type EsitoBackfill = { ok: true; creati: number } | { errore: string };

/**
 * Crea i codici mancanti di un intero condominio: serve per le unità nate
 * prima di questa funzionalità, quando il trigger `trg_unita_crea_invito`
 * non esisteva ancora. Per tutte quelle create dopo non fa nulla (il
 * codice c'è già) e restituisce zero.
 */
export async function generaCodiciInvitoMancanti(
  condominioId: string
): Promise<EsitoBackfill> {
  if (!condominioId) return { errore: "Condominio non valido." };

  await richiedeAmministratore();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("genera_codici_invito_mancanti", {
    p_condominio_id: condominioId,
  });

  if (error || typeof data !== "number") {
    console.error("[inviti] generazione dei codici mancanti non riuscita", {
      condominioId,
      errore: error?.message,
    });
    return {
      errore:
        "Impossibile generare i codici mancanti. Riprova, e se il problema resta " +
        "verifica di essere l'amministratore di questo condominio.",
    };
  }

  revalidatePath(`/admin/condomini/${condominioId}/inviti`);
  revalidatePath(`/admin/condomini/${condominioId}`);
  return { ok: true, creati: data };
}
