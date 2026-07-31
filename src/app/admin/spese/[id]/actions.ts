"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resend, MITTENTE_EMAIL } from "@/lib/resend";
import { formatValuta } from "@/lib/format";

export type StatoForm = { errore?: string } | undefined;

export async function aggiornaStatoPagamento(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const ripartizioneId = String(formData.get("ripartizione_id") ?? "");
  const spesaId = String(formData.get("spesa_id") ?? "");
  const statoPagamento = String(formData.get("stato_pagamento") ?? "");

  if (
    !ripartizioneId ||
    !["da_pagare", "pagato", "in_ritardo"].includes(statoPagamento)
  ) {
    return { errore: "Dati non validi." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("ripartizioni")
    .update({
      stato_pagamento: statoPagamento,
      data_pagamento:
        statoPagamento === "pagato" ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq("id", ripartizioneId);

  if (error) return { errore: error.message };

  revalidatePath(`/admin/spese/${spesaId}`);
  revalidatePath("/admin/spese");
}

export async function generaRipartizioni(
  spesaId: string,
  condominioId: string,
  importoTotale: number,
  tabellaMillesimaleId?: string | null
): Promise<{ errore?: string }> {
  const supabase = await createClient();

  const { data: unita, error: erroreUnita } = await supabase
    .from("unita")
    .select("id, millesimi_proprieta")
    .eq("condominio_id", condominioId)
    .order("identificativo");

  if (erroreUnita) return { errore: erroreUnita.message };
  if (!unita?.length) {
    return { errore: "Il condominio non ha ancora unità: aggiungile prima." };
  }

  // Di default si usano i millesimi generali (unita.millesimi_proprieta);
  // se è stata scelta una tabella millesimale specifica (es. ascensore),
  // si usano i suoi valori per unità al posto dei millesimi generali.
  let millesimiPerUnita = new Map(unita.map((u) => [u.id, u.millesimi_proprieta]));
  if (tabellaMillesimaleId) {
    const { data: valori, error: erroreValori } = await supabase
      .from("valori_millesimali")
      .select("unita_id, valore")
      .eq("tabella_id", tabellaMillesimaleId);

    if (erroreValori) return { errore: erroreValori.message };
    millesimiPerUnita = new Map(unita.map((u) => [u.id, 0]));
    for (const v of valori ?? []) {
      millesimiPerUnita.set(v.unita_id, v.valore);
    }
  }

  const millesimiTotali = Array.from(millesimiPerUnita.values()).reduce((s, v) => s + v, 0);
  if (millesimiTotali <= 0) {
    return { errore: "I millesimi totali (della tabella selezionata) sono zero." };
  }

  const righe = unita
    .filter((u) => (millesimiPerUnita.get(u.id) ?? 0) > 0)
    .map((u) => ({
      spesa_id: spesaId,
      unita_id: u.id,
      importo_dovuto:
        Math.round(
          ((importoTotale * (millesimiPerUnita.get(u.id) ?? 0)) / millesimiTotali) * 100
        ) / 100,
    }));

  // L'arrotondamento per unità può lasciare un residuo di pochi centesimi
  // rispetto all'importo totale: lo si assorbe sull'ultima riga così la
  // somma delle quote torna esatta.
  const sommaRighe = righe.reduce((somma, r) => somma + r.importo_dovuto, 0);
  const residuo = Math.round((importoTotale - sommaRighe) * 100) / 100;
  righe[righe.length - 1].importo_dovuto =
    Math.round((righe[righe.length - 1].importo_dovuto + residuo) * 100) / 100;

  const { error } = await supabase.from("ripartizioni").insert(righe);
  if (error) return { errore: error.message };

  await notificaRipartizioni(spesaId, righe);

  revalidatePath(`/admin/spese/${spesaId}`);
  revalidatePath("/admin/spese");
  return {};
}

// Invio best-effort: se Resend fallisce non deve bloccare la generazione
// delle ripartizioni, che a questo punto è già avvenuta.
async function notificaRipartizioni(
  spesaId: string,
  righe: { unita_id: string; importo_dovuto: number }[]
) {
  try {
    const supabase = await createClient();
    const { data: spesa } = await supabase
      .from("spese")
      .select("descrizione")
      .eq("id", spesaId)
      .single();

    const { data: proprietari } = await supabase
      .from("unita_proprietari")
      .select("unita_id, utente:utente_id(email)")
      .in("unita_id", righe.map((r) => r.unita_id));

    const importoPerUnita = new Map(righe.map((r) => [r.unita_id, r.importo_dovuto]));

    await Promise.all(
      (proprietari ?? [])
        .map((p) => ({
          unitaId: p.unita_id as string,
          email: (p.utente as unknown as { email: string } | null)?.email,
        }))
        .filter((p): p is { unitaId: string; email: string } => !!p.email)
        .map((p) =>
          resend.emails.send({
            from: MITTENTE_EMAIL,
            to: p.email,
            subject: "Nuova spesa ripartita",
            html: `<p>Ti è stata addebitata una quota di ${formatValuta(
              importoPerUnita.get(p.unitaId) ?? 0
            )} per la spesa "${spesa?.descrizione ?? ""}".</p><p>Accedi al portale per i dettagli.</p>`,
          })
        )
    );
  } catch {
    // ignorato di proposito, vedi commento sopra
  }
}

const DOCUMENTO_MAX_BYTES = 4 * 1024 * 1024;

export async function caricaDocumentoSpesa(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const spesaId = String(formData.get("spesa_id") ?? "");
  const file = formData.get("documento");

  if (!spesaId || !(file instanceof File) || file.size === 0) {
    return { errore: "Seleziona un file da caricare." };
  }
  if (file.size > DOCUMENTO_MAX_BYTES) {
    return { errore: "Il file supera i 4MB consentiti." };
  }

  const supabase = await createClient();
  const estensione = file.name.split(".").pop() ?? "pdf";
  const percorso = `spese/${spesaId}/${Date.now()}.${estensione}`;

  const { error: erroreUpload } = await supabase.storage
    .from("documenti-condominio")
    .upload(percorso, file, { contentType: file.type || undefined });

  if (erroreUpload) return { errore: erroreUpload.message };

  const { error } = await supabase
    .from("spese")
    .update({ documento_url: percorso })
    .eq("id", spesaId);

  if (error) return { errore: error.message };
  revalidatePath(`/admin/spese/${spesaId}`);
}
