"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { richiedeAmministratore } from "@/lib/supabase/dal";
import { messaggioErrore, registraErrore } from "@/lib/errori";
import { normalizzaDatiCatastali } from "@/lib/anagrafe";
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

  await richiedeAmministratore();
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
    // COD-02: il motivo tecnico del rifiuto di Resend (chiave mancante,
    // dominio non verificato, indirizzo rifiutato) va nel log, non nel
    // riquadro d'errore dell'amministratore. Quello che gli serve sapere è
    // che l'avviso non è partito e a quante persone sarebbe andato.
    registraErrore("admin/condomini/inviaAvviso", e);
    return {
      errore: `Invio non riuscito: nessuno dei ${email.length} destinatari previsti ha ricevuto l'avviso. Riprova; se il problema persiste, verifica la configurazione della posta.`,
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

  // COD-04: prima qui c'era solo `auth.getUser()`, che verifica la sessione
  // ma non il ruolo. `richiedeAmministratore()` fa entrambe le cose e
  // restituisce la riga `utenti`, da cui viene l'intestatario del condominio.
  const amministratore = await richiedeAmministratore();
  const supabase = await createClient();

  const { error } = await supabase.from("condomini").insert({
    nome,
    indirizzo,
    codice_fiscale: codiceFiscale || null,
    iban: iban || null,
    banca: banca || null,
    intestatario_conto: intestatarioConto || null,
    amministratore_id: amministratore.id,
  });

  if (error) return { errore: messaggioErrore(error, "admin/condomini/creaCondominio") };

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

  await richiedeAmministratore();
  const supabase = await createClient();
  const { error } = await supabase
    .from("condomini")
    .update({ nome, indirizzo, codice_fiscale: codiceFiscale })
    .eq("id", input.id);

  if (error) return { errore: messaggioErrore(error, "admin/condomini/aggiornaCondominio") };

  revalidatePath("/admin/condomini");
  revalidatePath(`/admin/condomini/${input.id}`);
  return { ok: true };
}

export async function aggiornaContoCorrente(input: {
  condominioId: string;
  iban: string;
  banca: string;
  intestatarioConto: string;
}): Promise<{ ok: true } | { errore: string }> {
  if (!input.condominioId) return { errore: "Condominio non valido." };

  await richiedeAmministratore();
  const supabase = await createClient();
  const { error } = await supabase
    .from("condomini")
    .update({
      iban: input.iban.trim() || null,
      banca: input.banca.trim() || null,
      intestatario_conto: input.intestatarioConto.trim() || null,
    })
    .eq("id", input.condominioId);

  if (error) return { errore: messaggioErrore(error, "admin/condomini/aggiornaContoCorrente") };

  revalidatePath("/admin/condomini");
  revalidatePath(`/admin/condomini/${input.condominioId}`);
  return { ok: true };
}

// Elimina il condominio (a cascata: unità, anagrafiche, millesimi, legami…) e
// riporta alla lista. La RLS consente l'operazione solo all'admin proprietario.
export async function eliminaCondominio(id: string): Promise<{ errore: string } | void> {
  if (!id) return { errore: "Condominio non valido." };
  await richiedeAmministratore();
  const supabase = await createClient();
  const { error } = await supabase.from("condomini").delete().eq("id", id);
  if (error) return { errore: messaggioErrore(error, "admin/condomini/eliminaCondominio") };
  revalidatePath("/admin/condomini");
  redirect("/admin/condomini");
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

  await richiedeAmministratore();
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

  // Dati catastali (art. 1130, n. 6, c.c.): facoltativi anche qui, si
  // compilano quando si ha la visura sotto gli occhi.
  const catasto = normalizzaDatiCatastali({
    foglio: String(formData.get("catasto_foglio") ?? ""),
    particella: String(formData.get("catasto_particella") ?? ""),
    subalterno: String(formData.get("catasto_subalterno") ?? ""),
    categoria: String(formData.get("catasto_categoria") ?? ""),
  });

  const { data: unita, error } = await supabase
    .from("unita")
    .insert({
      condominio_id: condominioId,
      identificativo,
      piano: String(formData.get("piano") ?? "").trim() || null,
      millesimi_proprieta: millesimiGenerale ?? 0,
      catasto_foglio: catasto.foglio,
      catasto_particella: catasto.particella,
      catasto_subalterno: catasto.subalterno,
      catasto_categoria: catasto.categoria,
    })
    .select("id")
    .single();

  if (error || !unita) {
    if (error?.code === "23505") {
      return { errore: `Esiste già un'unità "${identificativo}" in questo condominio.` };
    }
    return {
      errore: error
        ? messaggioErrore(error, "admin/condomini/creaUnita")
        : "Impossibile creare l'unità: riprova.",
    };
  }

  // Valori millesimali per ogni tabella compilata.
  const valori = listaTabelle
    .map((t) => ({ tabella_id: t.id, valore: leggiMillesimo(formData, `mill_${t.id}`) }))
    .filter((v): v is { tabella_id: string; valore: number } => v.valore !== null)
    .map((v) => ({ ...v, unita_id: unita.id }));

  if (valori.length) {
    const { error: erroreValori } = await supabase.from("valori_millesimali").insert(valori);
    if (erroreValori) return { errore: messaggioErrore(erroreValori, "admin/condomini/creaUnita") };
  }

  revalidatePath("/admin/condomini");
  revalidatePath(`/admin/condomini/${condominioId}`);
}

/* -------------------------------------------------------------------------
   Condizioni di sicurezza delle parti comuni (art. 1130, n. 6, c.c.)

   Il registro di anagrafe deve contenere "ogni dato relativo alle
   condizioni di sicurezza delle parti comuni": una voce per parte comune
   o impianto, con la data dell'ultima verifica e il riferimento al
   certificato. È il quadro dello stato di fatto, non il piano delle
   manutenzioni future (che resta in manutenzioni_programmate).
   ------------------------------------------------------------------------- */

export async function registraCondizioneSicurezza(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const condominioId = String(formData.get("condominio_id") ?? "");
  const parte = String(formData.get("parte") ?? "").trim();
  const descrizione = String(formData.get("descrizione") ?? "").trim();
  const dataUltimaVerifica = String(formData.get("data_ultima_verifica") ?? "").trim();
  const documentoUrl = String(formData.get("documento_url") ?? "").trim();

  if (!condominioId) return { errore: "Condominio non valido." };
  if (!parte) {
    return { errore: "Indica a quale parte comune o impianto si riferisce la voce." };
  }
  if (documentoUrl && !/^https?:\/\//i.test(documentoUrl)) {
    return { errore: "Il riferimento al documento deve essere un indirizzo http:// o https://." };
  }

  await richiedeAmministratore();
  const supabase = await createClient();

  const { error } = await supabase.from("condizioni_sicurezza_parti_comuni").insert({
    condominio_id: condominioId,
    parte,
    descrizione: descrizione || null,
    data_ultima_verifica: dataUltimaVerifica || null,
    documento_url: documentoUrl || null,
  });

  if (error) {
    console.error("[condizioni-sicurezza] inserimento non riuscito", error);
    return { errore: "Impossibile registrare la voce. Riprova." };
  }

  revalidatePath(`/admin/condomini/${condominioId}`);
  revalidatePath("/area-riservata/documenti");
}

export async function eliminaCondizioneSicurezza(
  id: string,
  condominioId: string
): Promise<{ errore?: string }> {
  if (!id) return { errore: "Voce non valida." };

  await richiedeAmministratore();
  const supabase = await createClient();
  const { error } = await supabase
    .from("condizioni_sicurezza_parti_comuni")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[condizioni-sicurezza] eliminazione non riuscita", error);
    return { errore: "Impossibile eliminare la voce. Riprova." };
  }

  revalidatePath(`/admin/condomini/${condominioId}`);
  revalidatePath("/area-riservata/documenti");
  return {};
}
