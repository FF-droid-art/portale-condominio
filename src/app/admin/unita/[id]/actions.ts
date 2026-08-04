"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { haQuota } from "@/lib/ruoli";

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

  const supabase = await createClient();

  let anagraficaId: string | null = null;

  if (input.riusaId) {
    // L'admin ha confermato "è la stessa persona": riusa quell'anagrafica.
    anagraficaId = input.riusaId;
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
        .insert({ condominio_id: input.condominioId, nominativo, email, telefono })
        .select("id")
        .single();
      if (erroreAnag || !nuova) {
        return { errore: erroreAnag?.message ?? "Impossibile creare l'anagrafica." };
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
    return { errore: error.message };
  }

  revalidatePath(`/admin/unita/${input.unitaId}`);
  return { ok: true };
}

export async function aggiornaContatti(input: {
  anagraficaId: string;
  unitaId: string;
  email: string;
  telefono: string | null;
}): Promise<{ ok: true } | { errore: string }> {
  const email = input.email.trim();
  const telefono = input.telefono?.trim() || null;
  if (!input.anagraficaId) return { errore: "Anagrafica non valida." };
  if (!RE_EMAIL.test(email)) return { errore: "Inserisci un'email valida." };

  const supabase = await createClient();
  // Aggiorna l'anagrafica: email/telefono valgono per la persona in tutte le
  // sue unità. La RLS consente la modifica solo all'admin del condominio.
  const { error } = await supabase
    .from("anagrafiche")
    .update({ email, telefono })
    .eq("id", input.anagraficaId);
  if (error) return { errore: error.message };

  revalidatePath(`/admin/unita/${input.unitaId}`);
  return { ok: true };
}

export async function rimuoviProprietario(
  id: string,
  unitaId: string
): Promise<{ errore?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("unita_proprietari").delete().eq("id", id);
  if (error) return { errore: error.message };

  revalidatePath(`/admin/unita/${unitaId}`);
  return {};
}
