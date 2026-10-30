"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { inviaNotifichePersonalizzate } from "@/lib/notifiche-invio";
import { formatValuta } from "@/lib/format";
import { FAMIGLIE_PDF_E_IMMAGINI, testaDiFile, verificaTipoFile } from "@/lib/tipi-file";

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
// delle ripartizioni, che a questo punto è già avvenuta. L'invio passa dal
// cancello delle preferenze (`avviso_pagamento`): chi non ha toccato nulla lo
// riceve come prima, chi lo ha disattivato no.
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
      .select("unita_id, utente_id, utente:utente_id(email)")
      .in("unita_id", righe.map((r) => r.unita_id));

    const importoPerUnita = new Map(righe.map((r) => [r.unita_id, r.importo_dovuto]));

    await inviaNotifichePersonalizzate({
      tipoEvento: "avviso_pagamento",
      messaggi: (proprietari ?? [])
        .map((p) => ({
          utenteId: (p.utente_id as string | null) ?? "",
          email: (p.utente as unknown as { email: string } | null)?.email ?? "",
          unitaId: p.unita_id as string,
        }))
        .filter((p) => p.utenteId && p.email)
        .map((p) => ({
          utenteId: p.utenteId,
          email: p.email,
          subject: "Nuova spesa ripartita",
          html: `<p>Ti è stata addebitata una quota di ${formatValuta(
            importoPerUnita.get(p.unitaId) ?? 0
          )} per la spesa "${spesa?.descrizione ?? ""}".</p><p>Accedi al portale per i dettagli.</p>`,
        })),
    });
  } catch (errore) {
    // ignorato di proposito, vedi commento sopra — logghiamo per lo stesso
    // motivo di notificaNuovaAssemblea (COD-09 in docs/audit/01-codice.md).
    console.error("notificaRipartizioni fallita", { spesaId, errore });
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

  // COD-06: una fattura è un PDF o la foto di un documento cartaceo. Il
  // formato si verifica sui primi byte, non su `file.type`.
  const tipo = verificaTipoFile(await testaDiFile(file), file.name, FAMIGLIE_PDF_E_IMMAGINI);
  if (!tipo.ok) return { errore: tipo.errore };

  const supabase = await createClient();
  const percorso = `spese/${spesaId}/${Date.now()}.${tipo.estensione}`;

  const { error: erroreUpload } = await supabase.storage
    .from("documenti-condominio")
    .upload(percorso, file, { contentType: tipo.mime });

  if (erroreUpload) {
    console.error("[spese] caricamento del documento di spesa non riuscito", {
      spesaId,
      errore: erroreUpload.message,
    });
    return { errore: "Caricamento del file non riuscito: riprova." };
  }

  const { error } = await supabase
    .from("spese")
    .update({ documento_url: percorso })
    .eq("id", spesaId);

  if (error) return { errore: error.message };
  revalidatePath(`/admin/spese/${spesaId}`);
}
