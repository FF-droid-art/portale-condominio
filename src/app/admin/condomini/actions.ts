"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resend, MITTENTE_EMAIL } from "@/lib/resend";

export type StatoForm = { errore?: string } | undefined;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Invia un avviso via email a tutti i soggetti (anagrafiche con email) delle
// unità del condominio. Prima versione: BCC per non esporre gli indirizzi,
// invio a blocchi di 50 (limite Resend). Da rifinire (template, allegati…).
export async function inviaAvviso(input: {
  condominioId: string;
  oggetto: string;
  messaggio: string;
}): Promise<{ ok: true; destinatari: number; nota?: string } | { errore: string }> {
  const oggetto = input.oggetto.trim();
  const messaggio = input.messaggio.trim();
  if (!input.condominioId) return { errore: "Condominio non valido." };
  if (!oggetto) return { errore: "Inserisci un oggetto." };
  if (!messaggio) return { errore: "Inserisci un messaggio." };

  const supabase = await createClient();
  const { data: anagrafiche } = await supabase
    .from("anagrafiche")
    .select("email")
    .eq("condominio_id", input.condominioId);

  const email = Array.from(
    new Set(
      (anagrafiche ?? [])
        .map((a) => a.email as string | null)
        .filter((e): e is string => !!e)
    )
  );
  if (!email.length) {
    return { errore: "Nessun destinatario con email in questo condominio." };
  }

  const corpo = `<h2>${escapeHtml(oggetto)}</h2><p>${escapeHtml(messaggio).replace(/\n/g, "<br>")}</p>`;

  // Modalità test: se impostata AVVISI_EMAIL_TEST, l'avviso va solo a
  // quell'indirizzo (utile finché il dominio mittente non è verificato su
  // Resend, che altrimenti consegna solo alla casella del proprio account).
  const emailTest = process.env.AVVISI_EMAIL_TEST?.trim();

  try {
    if (emailTest) {
      await resend.emails.send({
        from: MITTENTE_EMAIL,
        to: emailTest,
        subject: `[TEST] ${oggetto}`,
        html: `<p style="color:#888"><i>Modalità test: nella versione reale sarebbe inviato a ${email.length} destinatari.</i></p>${corpo}`,
      });
      return {
        ok: true,
        destinatari: email.length,
        nota: `Modalità test: inviato solo a ${emailTest} (in produzione andrebbe a ${email.length} destinatari).`,
      };
    }

    for (let i = 0; i < email.length; i += 50) {
      const blocco = email.slice(i, i + 50);
      await resend.emails.send({
        from: MITTENTE_EMAIL,
        to: MITTENTE_EMAIL,
        bcc: blocco,
        subject: oggetto,
        html: corpo,
      });
    }
    return { ok: true, destinatari: email.length };
  } catch (e) {
    return {
      errore: `Invio non riuscito (${
        e instanceof Error ? e.message : "errore sconosciuto"
      }). Destinatari previsti: ${email.length}. Controlla RESEND_API_KEY.`,
    };
  }
}

export async function creaCondominio(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const nome = String(formData.get("nome") ?? "").trim();
  const indirizzo = String(formData.get("indirizzo") ?? "").trim();
  const codiceFiscale = String(formData.get("codice_fiscale") ?? "").trim();
  const iban = String(formData.get("iban") ?? "").trim();
  const banca = String(formData.get("banca") ?? "").trim();
  const intestatarioConto = String(formData.get("intestatario_conto") ?? "").trim();

  if (!nome || !indirizzo) {
    return { errore: "Nome e indirizzo sono obbligatori." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { errore: "Sessione scaduta, effettua di nuovo l'accesso." };

  const { error } = await supabase.from("condomini").insert({
    nome,
    indirizzo,
    codice_fiscale: codiceFiscale || null,
    iban: iban || null,
    banca: banca || null,
    intestatario_conto: intestatarioConto || null,
    amministratore_id: user.id,
  });

  if (error) return { errore: error.message };

  revalidatePath("/admin/condomini");
}

export async function aggiornaCondominio(input: {
  id: string;
  nome: string;
  indirizzo: string;
  codiceFiscale: string | null;
}): Promise<{ ok: true } | { errore: string }> {
  const nome = input.nome.trim();
  const indirizzo = input.indirizzo.trim();
  const codiceFiscale = input.codiceFiscale?.trim() || null;

  if (!input.id) return { errore: "Condominio non valido." };
  if (!nome) return { errore: "Il nome è obbligatorio." };
  if (!indirizzo) return { errore: "L'indirizzo è obbligatorio." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("condomini")
    .update({ nome, indirizzo, codice_fiscale: codiceFiscale })
    .eq("id", input.id);

  if (error) return { errore: error.message };

  revalidatePath("/admin/condomini");
  revalidatePath(`/admin/condomini/${input.id}`);
  return { ok: true };
}

export async function aggiornaContoCorrente(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const condominioId = String(formData.get("condominio_id") ?? "");
  const iban = String(formData.get("iban") ?? "").trim();
  const banca = String(formData.get("banca") ?? "").trim();
  const intestatarioConto = String(formData.get("intestatario_conto") ?? "").trim();

  if (!condominioId) {
    return { errore: "Condominio non valido." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("condomini")
    .update({
      iban: iban || null,
      banca: banca || null,
      intestatario_conto: intestatarioConto || null,
    })
    .eq("id", condominioId);

  if (error) return { errore: error.message };

  revalidatePath("/admin/condomini");
  revalidatePath(`/admin/condomini/${condominioId}`);
}

// Legge un valore di millesimi dal form: vuoto -> null, altrimenti numero.
function leggiMillesimo(formData: FormData, campo: string): number | null {
  const raw = formData.get(campo);
  if (raw == null || String(raw).trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function creaUnita(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const condominioId = String(formData.get("condominio_id") ?? "");
  const identificativo = String(formData.get("identificativo") ?? "").trim();

  if (!condominioId || !identificativo) {
    return { errore: "Compila condominio e identificativo." };
  }

  const supabase = await createClient();

  // Le tabelle millesimali del condominio determinano i campi millesimi del
  // form (name = "mill_<id>"). "Generali" alimenta anche unita.millesimi_proprieta.
  const { data: tabelle } = await supabase
    .from("tabelle_millesimali")
    .select("id, nome")
    .eq("condominio_id", condominioId);
  const listaTabelle = tabelle ?? [];

  const tabGenerale = listaTabelle.find((t) => t.nome === "Generali");
  const millesimiGenerale = tabGenerale
    ? leggiMillesimo(formData, `mill_${tabGenerale.id}`)
    : leggiMillesimo(formData, "mill_generale");

  const { data: unita, error } = await supabase
    .from("unita")
    .insert({
      condominio_id: condominioId,
      identificativo,
      piano: null,
      millesimi_proprieta: millesimiGenerale ?? 0,
    })
    .select("id")
    .single();

  if (error || !unita) {
    if (error?.code === "23505") {
      return { errore: `Esiste già un'unità "${identificativo}" in questo condominio.` };
    }
    return { errore: error?.message ?? "Impossibile creare l'unità." };
  }

  // Valori millesimali per ogni tabella compilata.
  const valori = listaTabelle
    .map((t) => ({ tabella_id: t.id, valore: leggiMillesimo(formData, `mill_${t.id}`) }))
    .filter((v): v is { tabella_id: string; valore: number } => v.valore !== null)
    .map((v) => ({ ...v, unita_id: unita.id }));

  if (valori.length) {
    const { error: erroreValori } = await supabase.from("valori_millesimali").insert(valori);
    if (erroreValori) return { errore: erroreValori.message };
  }

  revalidatePath("/admin/condomini");
  revalidatePath(`/admin/condomini/${condominioId}`);
}
