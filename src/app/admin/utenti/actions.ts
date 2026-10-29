"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { richiedeAmministratore } from "@/lib/supabase/dal";
import { COOKIE_IMPERSONAZIONE, type SessioneImpersonazione } from "@/lib/impersonazione";
import type { Ruolo } from "@/lib/types";

export type StatoForm = { errore?: string } | undefined;

export async function cambiaRuolo(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const utenteId = String(formData.get("utente_id") ?? "");
  const ruolo = String(formData.get("ruolo") ?? "") as Ruolo;

  if (!utenteId || !["amministratore", "condomino"].includes(ruolo)) {
    return { errore: "Dati non validi." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("utenti")
    .update({ ruolo })
    .eq("id", utenteId);

  if (error) return { errore: error.message };

  revalidatePath("/admin/utenti");
}

// "Visualizza come": genera per l'amministratore corrente una sessione
// reale come il condomino scelto (via magic link generato server-side),
// così può testare voto/delega/pagamento esattamente come li vivrebbe
// quel condomino (le policy RLS che richiedono utente_id = auth.uid()
// non sarebbero altrimenti soddisfacibili restando autenticati come
// amministratore). La sessione amministratore originale viene salvata
// in un cookie httpOnly per poterla ripristinare con "Torna amministratore".
export async function visualizzaComeCondomino(formData: FormData): Promise<void> {
  const admin = await richiedeAmministratore();
  const utenteId = String(formData.get("utente_id") ?? "");

  const supabase = await createClient();

  const {
    data: { session: sessioneAdmin },
  } = await supabase.auth.getSession();
  if (!sessioneAdmin) redirect("/login");

  // ATTENZIONE: "utenti_select_self_or_admin" NON basta a stabilire che si
  // possa impersonare questo utente. Quella policy rende visibile (solo per
  // poterlo assegnare a un'unità) anche qualunque condòmino non ancora
  // collegato a nessuna unità, a QUALSIASI amministratore — non solo al
  // proprio. Usarla da sola qui permetterebbe a un amministratore di
  // impersonare un condòmino di un altro gestore, purché non ancora
  // assegnato (vedi THREAT-01 in docs/audit/04-threat-model.md). Il
  // controllo vero è admin_gestisce_utente(), che richiede un collegamento
  // via unita_proprietari a un condominio di CUI SONO io l'amministratore.
  const { data: target } = await supabase
    .from("utenti")
    .select("id, nome, cognome, email, ruolo")
    .eq("id", utenteId)
    .eq("ruolo", "condomino")
    .single();

  if (!target) redirect("/admin/utenti");

  const { data: autorizzato } = await supabase.rpc("admin_gestisce_utente", {
    utente: target.id,
  });
  if (!autorizzato) redirect("/admin/utenti");

  const service = createServiceClient();
  const { data: link, error: erroreLink } = await service.auth.admin.generateLink({
    type: "magiclink",
    email: target.email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (erroreLink || !tokenHash) redirect("/admin/utenti");

  const { error: erroreVerifica } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });
  if (erroreVerifica) redirect("/admin/utenti");

  // Serve per poterla revocare lato server a fine impersonazione: non è
  // la sessione con cui si naviga ora (quella la gestiscono i cookie
  // sb-*-auth-token scritti da verifyOtp), è solo il suo access token.
  const {
    data: { session: sessioneTarget },
  } = await supabase.auth.getSession();

  const daSalvare: SessioneImpersonazione = {
    access_token: sessioneAdmin.access_token,
    refresh_token: sessioneAdmin.refresh_token,
    admin_nome: `${admin.nome} ${admin.cognome}`,
    target_nome: `${target.nome} ${target.cognome}`,
    target_access_token: sessioneTarget?.access_token ?? "",
  };

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_IMPERSONAZIONE, JSON.stringify(daSalvare), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });

  redirect("/area-riservata");
}

export async function terminaImpersonazione(): Promise<void> {
  const cookieStore = await cookies();
  const grezzo = cookieStore.get(COOKIE_IMPERSONAZIONE)?.value;
  cookieStore.delete(COOKIE_IMPERSONAZIONE);

  if (!grezzo) redirect("/login");

  const salvato = JSON.parse(grezzo) as SessioneImpersonazione;
  const supabase = await createClient();
  await supabase.auth.setSession({
    access_token: salvato.access_token,
    refresh_token: salvato.refresh_token,
  });

  // Senza questa revoca esplicita, il token del condòmino impersonato
  // restava valido (fino alla sua scadenza naturale) anche dopo il
  // ritorno all'amministratore — vedi THREAT-01 in
  // docs/audit/04-threat-model.md. Richiede la service role perché
  // revocare la sessione di un ALTRO utente non è un'operazione che la
  // chiave anonima può fare nemmeno con RLS. Se il token è già scaduto o
  // la chiamata fallisce non blocchiamo comunque il ritorno in dashboard.
  if (salvato.target_access_token) {
    const service = createServiceClient();
    await service.auth.admin
      .signOut(salvato.target_access_token, "global")
      .catch((errore) =>
        console.error("terminaImpersonazione: revoca sessione impersonata fallita", { errore })
      );
  }

  redirect("/admin/utenti");
}
