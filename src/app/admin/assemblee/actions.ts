"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { richiedeAmministratore } from "@/lib/supabase/dal";
import { messaggioErrore } from "@/lib/errori";
import { inviaNotificaEmailMultipla } from "@/lib/notifiche-invio";
import { formatDataOra } from "@/lib/format";

export type StatoForm = { errore?: string } | undefined;

export async function creaAssemblea(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const condominioId = String(formData.get("condominio_id") ?? "");
  const dataAssemblea = String(formData.get("data_assemblea") ?? "");
  const tipo = String(formData.get("tipo") ?? "");

  if (!condominioId || !dataAssemblea || !tipo) {
    return { errore: "Compila condominio, data e tipo." };
  }

  await richiedeAmministratore();
  const supabase = await createClient();
  const { error } = await supabase.from("assemblee").insert({
    condominio_id: condominioId,
    data_assemblea: dataAssemblea,
    tipo,
  });

  if (error) return { errore: messaggioErrore(error, "admin/assemblee/creaAssemblea") };

  await notificaNuovaAssemblea(condominioId, dataAssemblea, tipo);

  revalidatePath("/admin/assemblee");
  // L'assemblea appena convocata è anche un evento del calendario.
  revalidatePath("/admin/calendario");
  revalidatePath("/area-riservata/calendario");
}

// Invio best-effort: se Resend fallisce (o non è ancora configurato) non deve
// bloccare la creazione dell'assemblea, che a questo punto è già avvenuta.
async function notificaNuovaAssemblea(condominioId: string, dataAssemblea: string, tipo: string) {
  try {
    const supabase = await createClient();

    const { data: unita } = await supabase
      .from("unita")
      .select("id")
      .eq("condominio_id", condominioId);
    const unitaIds = (unita ?? []).map((u) => u.id);
    if (!unitaIds.length) return;

    const { data: proprietari } = await supabase
      .from("unita_proprietari")
      .select("utente_id, utente:utente_id(email)")
      .in("unita_id", unitaIds);

    // L'invio passa dal cancello delle preferenze (`nuova_assemblea`): chi non
    // ha toccato le impostazioni riceve l'avviso come prima.
    await inviaNotificaEmailMultipla({
      tipoEvento: "nuova_assemblea",
      destinatari: (proprietari ?? [])
        .map((p) => ({
          utenteId: (p.utente_id as string | null) ?? "",
          email: (p.utente as unknown as { email: string } | null)?.email ?? "",
        }))
        .filter((d) => d.utenteId && d.email),
      subject: "Nuova assemblea convocata",
      html: `<p>È stata convocata una nuova assemblea ${tipo} per il ${formatDataOra(dataAssemblea)}.</p><p>Accedi al portale per i dettagli.</p>`,
    });
  } catch (errore) {
    // ignorato di proposito, vedi commento sopra — ma logghiamo perché
    // altrimenti un fallimento qui (es. la query su unita/proprietari, non
    // solo l'invio Resend) non lascerebbe nessuna traccia (COD-09 in
    // docs/audit/01-codice.md).
    console.error("notificaNuovaAssemblea fallita", { condominioId, errore });
  }
}
