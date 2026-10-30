"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { richiedeAmministratore } from "@/lib/supabase/dal";
import { messaggioErrore, registraErrore } from "@/lib/errori";
import { resend, MITTENTE_EMAIL } from "@/lib/resend";
import { generaPdf } from "@/lib/documenti/pdf";
import { generaToken } from "@/lib/firma-otp";
import { formatDataOra } from "@/lib/format";
import { FAMIGLIE_PDF_E_IMMAGINI, testaDiFile, verificaTipoFile } from "@/lib/tipi-file";
import type { ModalitaPresenza, RuoloFirmatario } from "@/lib/types";
import { costruisciDocumentoAssemblea } from "./documenti-dati";

export type StatoForm = { errore?: string } | undefined;

/** Ricarica sia la pagina dell'amministratore sia quella dei condòmini. */
function rivalidaAssemblea(assembleaId: string) {
  revalidatePath(`/admin/assemblee/${assembleaId}`);
  revalidatePath(`/area-riservata/assemblee/${assembleaId}`);
}

export async function creaPuntoOdg(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const assembleaId = String(formData.get("assemblea_id") ?? "");
  const numeroPunto = Number(formData.get("numero_punto"));
  const descrizione = String(formData.get("descrizione") ?? "").trim();
  const tipoMaggioranza = String(formData.get("tipo_maggioranza") ?? "semplice").trim();

  if (!assembleaId || !descrizione || !Number.isFinite(numeroPunto)) {
    return { errore: "Compila numero punto e descrizione." };
  }

  await richiedeAmministratore();
  const supabase = await createClient();
  const { error } = await supabase.from("punti_odg").insert({
    assemblea_id: assembleaId,
    numero_punto: numeroPunto,
    descrizione,
    tipo_maggioranza: tipoMaggioranza || "semplice",
  });

  if (error) return { errore: messaggioErrore(error, "admin/assemblee/creaPuntoOdg") };
  revalidatePath(`/admin/assemblee/${assembleaId}`);
}

export async function apriVotazione(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const puntoId = String(formData.get("punto_id") ?? "");
  const assembleaId = String(formData.get("assemblea_id") ?? "");
  if (!puntoId || !assembleaId) return { errore: "Punto non valido." };

  await richiedeAmministratore();
  const supabase = await createClient();
  const { error } = await supabase
    .from("punti_odg")
    .update({ stato_votazione: "aperta" })
    .eq("id", puntoId);

  if (error) return { errore: messaggioErrore(error, "admin/assemblee/apriVotazione") };
  revalidatePath(`/admin/assemblee/${assembleaId}`);
}

export async function chiudiVotazione(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const puntoId = String(formData.get("punto_id") ?? "");
  const assembleaId = String(formData.get("assemblea_id") ?? "");
  const condominioId = String(formData.get("condominio_id") ?? "");
  if (!puntoId || !assembleaId || !condominioId) {
    return { errore: "Punto non valido." };
  }

  await richiedeAmministratore();
  const supabase = await createClient();

  const [{ data: votiPunto }, { data: unitaCondominio }] = await Promise.all([
    supabase.from("voti").select("scelta, millesimi_rappresentati").eq("punto_id", puntoId),
    supabase.from("unita").select("millesimi_proprieta").eq("condominio_id", condominioId),
  ]);

  let favorevole = 0;
  let contrario = 0;
  let astenuto = 0;
  for (const v of votiPunto ?? []) {
    if (v.scelta === "favorevole") favorevole += v.millesimi_rappresentati;
    else if (v.scelta === "contrario") contrario += v.millesimi_rappresentati;
    else astenuto += v.millesimi_rappresentati;
  }
  const quorumTotale = (unitaCondominio ?? []).reduce(
    (somma, u) => somma + u.millesimi_proprieta,
    0
  );
  const esito = favorevole > contrario ? "approvato" : "respinto";

  const { error } = await supabase
    .from("punti_odg")
    .update({
      stato_votazione: "chiusa",
      esito,
      esito_favorevole: favorevole,
      esito_contrario: contrario,
      esito_astenuto: astenuto,
      esito_quorum_totale: quorumTotale,
    })
    .eq("id", puntoId);

  if (error) return { errore: messaggioErrore(error, "admin/assemblee/chiudiVotazione") };
  revalidatePath(`/admin/assemblee/${assembleaId}`);
}

export async function aggiornaLinkVideoconferenza(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const assembleaId = String(formData.get("assemblea_id") ?? "");
  const link = String(formData.get("link_videoconferenza") ?? "").trim();
  if (!assembleaId) return { errore: "Assemblea non valida." };

  if (link && !/^https:\/\/.+/.test(link)) {
    return { errore: "Il link deve iniziare con https://." };
  }

  await richiedeAmministratore();
  const supabase = await createClient();
  const { error } = await supabase
    .from("assemblee")
    .update({ link_videoconferenza: link || null })
    .eq("id", assembleaId);

  if (error) {
    return { errore: messaggioErrore(error, "admin/assemblee/aggiornaLinkVideoconferenza") };
  }
  revalidatePath(`/admin/assemblee/${assembleaId}`);
  revalidatePath(`/area-riservata/assemblee/${assembleaId}`);
}

const VERBALE_MAX_BYTES = 4 * 1024 * 1024;

export async function caricaVerbale(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const assembleaId = String(formData.get("assemblea_id") ?? "");
  const file = formData.get("verbale");

  if (!assembleaId || !(file instanceof File) || file.size === 0) {
    return { errore: "Seleziona un file da caricare." };
  }
  if (file.size > VERBALE_MAX_BYTES) {
    return { errore: "Il file supera i 4MB consentiti." };
  }

  // COD-06: tipo e estensione vengono dai primi byte del file, non dal nome
  // né da `file.type`, che li dichiara il browser.
  const tipo = verificaTipoFile(await testaDiFile(file), file.name, FAMIGLIE_PDF_E_IMMAGINI);
  if (!tipo.ok) return { errore: tipo.errore };

  await richiedeAmministratore();
  const supabase = await createClient();
  const percorso = `assemblee/${assembleaId}/${Date.now()}.${tipo.estensione}`;

  const { error: erroreUpload } = await supabase.storage
    .from("documenti-condominio")
    .upload(percorso, file, { contentType: tipo.mime });

  if (erroreUpload) {
    console.error("[assemblee] caricamento del verbale non riuscito", {
      assembleaId,
      errore: erroreUpload.message,
    });
    return { errore: "Caricamento del file non riuscito: riprova." };
  }

  const { error } = await supabase
    .from("assemblee")
    .update({ verbale_url: percorso })
    .eq("id", assembleaId);

  if (error) return { errore: messaggioErrore(error, "admin/assemblee/caricaVerbale") };
  revalidatePath(`/admin/assemblee/${assembleaId}`);
  revalidatePath(`/area-riservata/assemblee/${assembleaId}`);
}

export async function aggiornaStatoAssemblea(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const assembleaId = String(formData.get("assemblea_id") ?? "");
  const nuovoStato = String(formData.get("nuovo_stato") ?? "");
  if (!assembleaId || !nuovoStato) return { errore: "Stato non valido." };

  await richiedeAmministratore();
  const supabase = await createClient();
  const { error } = await supabase
    .from("assemblee")
    .update({ stato: nuovoStato })
    .eq("id", assembleaId);

  if (error) return { errore: messaggioErrore(error, "admin/assemblee/aggiornaStatoAssemblea") };
  revalidatePath(`/admin/assemblee/${assembleaId}`);
  revalidatePath("/admin/assemblee");
}

/* =========================================================================
   Luogo e convocazione
   ========================================================================= */

export async function aggiornaDettagliAssemblea(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const assembleaId = String(formData.get("assemblea_id") ?? "");
  const luogo = String(formData.get("luogo") ?? "").trim();
  const convocazione = Number(formData.get("convocazione"));

  if (!assembleaId) return { errore: "Assemblea non valida." };
  if (convocazione !== 1 && convocazione !== 2) {
    return { errore: "La convocazione può essere solo prima o seconda." };
  }

  await richiedeAmministratore();
  const supabase = await createClient();
  const { error } = await supabase
    .from("assemblee")
    .update({ luogo: luogo || null, convocazione })
    .eq("id", assembleaId);

  if (error) return { errore: messaggioErrore(error, "admin/assemblee/aggiornaDettagliAssemblea") };
  rivalidaAssemblea(assembleaId);
}

/* =========================================================================
   Presenze (quorum costitutivo)
   ========================================================================= */

/**
 * Segna un'unità presente (in sede o da remoto) oppure assente.
 *
 * I millesimi salvati sono quelli dell'unità al momento della registrazione:
 * uno snapshot, come già avviene per i voti, così il verbale resta coerente
 * anche se le tabelle millesimali cambiano in seguito.
 */
export async function aggiornaPresenza(input: {
  assembleaId: string;
  unitaId: string;
  modalita: ModalitaPresenza | null;
}): Promise<{ errore?: string } | void> {
  const { assembleaId, unitaId, modalita } = input;
  if (!assembleaId || !unitaId) return { errore: "Unità non valida." };

  const amministratore = await richiedeAmministratore();
  const supabase = await createClient();

  if (!modalita) {
    const { error } = await supabase
      .from("presenze")
      .delete()
      .eq("assemblea_id", assembleaId)
      .eq("unita_id", unitaId);
    if (error) return { errore: messaggioErrore(error, "admin/assemblee/aggiornaPresenza") };
    rivalidaAssemblea(assembleaId);
    return;
  }

  const { data: unita } = await supabase
    .from("unita")
    .select("millesimi_proprieta")
    .eq("id", unitaId)
    .single();
  if (!unita) return { errore: "Unità non trovata." };

  // Se l'unità ha un proprietario con account lo si registra come presente,
  // altrimenti la presenza resta intestata alla sola unità: molti condòmini
  // esistono solo in anagrafica e non hanno un login.
  const { data: proprietario } = await supabase
    .from("unita_proprietari")
    .select("utente_id")
    .eq("unita_id", unitaId)
    .not("utente_id", "is", null)
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("presenze").upsert(
    {
      assemblea_id: assembleaId,
      unita_id: unitaId,
      utente_id: proprietario?.utente_id ?? null,
      modalita,
      millesimi_rappresentati: unita.millesimi_proprieta,
      ora_uscita: null,
      registrata_da: amministratore.id,
    },
    { onConflict: "assemblea_id,unita_id" }
  );

  if (error) return { errore: messaggioErrore(error, "admin/assemblee/aggiornaPresenza") };
  rivalidaAssemblea(assembleaId);
}

/* =========================================================================
   Documenti generati (bozze di convocazione e verbale)
   ========================================================================= */

/**
 * Genera il PDF del verbale dai dati registrati e lo deposita nello storage
 * come verbale ufficiale dell'assemblea.
 *
 * L'upload manuale resta disponibile e sovrascrive questo file: la bozza
 * generata è un punto di partenza, non un vincolo.
 */
export async function generaESalvaVerbale(
  assembleaId: string
): Promise<{ errore?: string } | void> {
  if (!assembleaId) return { errore: "Assemblea non valida." };
  await richiedeAmministratore();

  const documento = await costruisciDocumentoAssemblea(assembleaId, "verbale");
  if (!documento) return { errore: "Assemblea non trovata." };

  const pdf = await generaPdf(documento);
  const percorso = `assemblee/${assembleaId}/${Date.now()}-verbale-generato.pdf`;

  const supabase = await createClient();
  const { error: erroreUpload } = await supabase.storage
    .from("documenti-condominio")
    .upload(percorso, pdf, { contentType: "application/pdf" });
  if (erroreUpload) {
    return { errore: messaggioErrore(erroreUpload, "admin/assemblee/generaESalvaVerbale") };
  }

  const { error } = await supabase
    .from("assemblee")
    .update({ verbale_url: percorso })
    .eq("id", assembleaId);
  if (error) return { errore: messaggioErrore(error, "admin/assemblee/generaESalvaVerbale") };

  rivalidaAssemblea(assembleaId);
}

/* =========================================================================
   Firma leggera del verbale (conferma via codice usa-e-getta)
   ========================================================================= */

const RUOLI_FIRMATARIO: RuoloFirmatario[] = [
  "presidente",
  "segretario",
  "amministratore",
  "altro",
];

export async function aggiungiFirmatario(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const assembleaId = String(formData.get("assemblea_id") ?? "");
  const nominativo = String(formData.get("nominativo") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const ruoloRichiesto = String(formData.get("ruolo") ?? "altro");
  const ruolo: RuoloFirmatario = RUOLI_FIRMATARIO.includes(ruoloRichiesto as RuoloFirmatario)
    ? (ruoloRichiesto as RuoloFirmatario)
    : "altro";

  if (!assembleaId) return { errore: "Assemblea non valida." };
  if (!nominativo) return { errore: "Indica il nominativo di chi deve confermare." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { errore: "Indirizzo email non valido." };
  }

  await richiedeAmministratore();
  const supabase = await createClient();

  const { error } = await supabase.from("firme_verbale").insert({
    assemblea_id: assembleaId,
    nominativo,
    email,
    ruolo,
    token: generaToken(),
  });

  if (error) {
    if (error.code === "23505") {
      return { errore: "Questo indirizzo è già tra i firmatari di questa assemblea." };
    }
    return { errore: messaggioErrore(error, "admin/assemblee/aggiungiFirmatario") };
  }

  rivalidaAssemblea(assembleaId);
}

export async function rimuoviFirmatario(
  firmaId: string,
  assembleaId: string
): Promise<{ errore?: string }> {
  await richiedeAmministratore();
  const supabase = await createClient();
  const { error } = await supabase.from("firme_verbale").delete().eq("id", firmaId);
  if (error) return { errore: messaggioErrore(error, "admin/assemblee/rimuoviFirmatario") };
  rivalidaAssemblea(assembleaId);
  return {};
}

/**
 * Invia (o rimanda) la richiesta di conferma: una email con il collegamento
 * personale alla pagina di conferma. Il codice usa-e-getta NON viaggia in
 * questa email: lo si richiede dalla pagina, così il codice e il link non
 * stanno nello stesso messaggio.
 */
export async function inviaRichiestaFirma(
  firmaId: string,
  assembleaId: string
): Promise<{ errore?: string; ok?: true }> {
  await richiedeAmministratore();
  const supabase = await createClient();

  const { data: firma } = await supabase
    .from("firme_verbale")
    .select("id, nominativo, email, token, confermato_il")
    .eq("id", firmaId)
    .single();
  if (!firma) return { errore: "Firmatario non trovato." };
  if (firma.confermato_il) return { errore: "Questa persona ha già confermato il verbale." };

  const { data: assemblea } = await supabase
    .from("assemblee")
    .select("tipo, data_assemblea, verbale_url, condominio:condominio_id(nome)")
    .eq("id", assembleaId)
    .single();
  if (!assemblea) return { errore: "Assemblea non trovata." };
  if (!assemblea.verbale_url) {
    return { errore: "Carica o genera prima il verbale: non c'è nulla da confermare." };
  }

  const nomeCondominio =
    (assemblea.condominio as unknown as { nome: string } | null)?.nome ?? "condominio";

  const headersList = await headers();
  const origine = headersList.get("origin") ?? `https://${headersList.get("host")}`;
  const link = `${origine}/firma-verbale/${firma.token}`;

  try {
    await resend.emails.send({
      from: MITTENTE_EMAIL,
      to: firma.email,
      subject: `Conferma del verbale — ${nomeCondominio}`,
      html:
        `<p>Gentile ${escapeHtml(firma.nominativo)},</p>` +
        `<p>le chiediamo di confermare il verbale dell'assemblea ${escapeHtml(
          assemblea.tipo
        )} del ${formatDataOra(assemblea.data_assemblea)} del ${escapeHtml(nomeCondominio)}.</p>` +
        `<p>Apra questo collegamento personale, legga il verbale e richieda il codice di conferma:<br>` +
        `<a href="${link}">${link}</a></p>` +
        `<p style="color:#666;font-size:13px">La conferma tramite codice inviato per email NON è una firma ` +
        `elettronica con valore legale: serve a registrare la sua approvazione del documento.</p>`,
    });
  } catch (e) {
    // COD-02: il messaggio del provider di posta resta nel log. Qui conta
    // sapere che la richiesta non è partita e che si può ritentare.
    registraErrore("admin/assemblee/inviaRichiestaFirma", e);
    return {
      errore:
        "Invio della richiesta non riuscito: riprova. Se il problema persiste, verifica la configurazione della posta.",
    };
  }

  const { error } = await supabase
    .from("firme_verbale")
    .update({ richiesta_inviata_il: new Date().toISOString() })
    .eq("id", firmaId);
  if (error) return { errore: messaggioErrore(error, "admin/assemblee/inviaRichiestaFirma") };

  rivalidaAssemblea(assembleaId);
  return { ok: true };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
