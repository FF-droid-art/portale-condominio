"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resend, MITTENTE_EMAIL } from "@/lib/resend";
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

  const supabase = await createClient();
  const { error } = await supabase.from("assemblee").insert({
    condominio_id: condominioId,
    data_assemblea: dataAssemblea,
    tipo,
  });

  if (error) return { errore: error.message };

  await notificaNuovaAssemblea(condominioId, dataAssemblea, tipo);

  revalidatePath("/admin/assemblee");
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
      .select("utente:utente_id(email)")
      .in("unita_id", unitaIds);

    const email = Array.from(
      new Set(
        (proprietari ?? [])
          .map((p) => (p.utente as unknown as { email: string } | null)?.email)
          .filter((e): e is string => !!e)
      )
    );
    if (!email.length) return;

    await resend.emails.send({
      from: MITTENTE_EMAIL,
      to: email,
      subject: "Nuova assemblea convocata",
      html: `<p>È stata convocata una nuova assemblea ${tipo} per il ${formatDataOra(dataAssemblea)}.</p><p>Accedi al portale per i dettagli.</p>`,
    });
  } catch {
    // ignorato di proposito, vedi commento sopra
  }
}
