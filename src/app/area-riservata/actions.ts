"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { richiedeUtente } from "@/lib/supabase/dal";
import { getStripe } from "@/lib/stripe";

export async function avviaPagamento(formData: FormData) {
  const ripartizioneId = String(formData.get("ripartizione_id") ?? "");
  if (!ripartizioneId) return;

  await richiedeUtente();
  const supabase = await createClient();

  const { data: ripartizione } = await supabase
    .from("ripartizioni")
    .select(
      "id, importo_dovuto, stato_pagamento, spesa:spesa_id(descrizione), unita:unita_id(identificativo)"
    )
    .eq("id", ripartizioneId)
    .single();

  // Se non trovata (o non di sua competenza) la RLS ha già impedito la
  // select: "ripartizione" è null e non si procede al pagamento.
  if (!ripartizione || ripartizione.stato_pagamento === "pagato") {
    redirect("/area-riservata");
  }

  const spesa = ripartizione.spesa as unknown as { descrizione: string } | null;
  const unita = ripartizione.unita as unknown as { identificativo: string } | null;

  const headersList = await headers();
  const origine = headersList.get("origin") ?? `https://${headersList.get("host")}`;

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "eur",
          unit_amount: Math.round(ripartizione.importo_dovuto * 100),
          product_data: {
            name: [spesa?.descrizione, unita?.identificativo].filter(Boolean).join(" — ") || "Quota condominiale",
          },
        },
        quantity: 1,
      },
    ],
    client_reference_id: ripartizione.id,
    metadata: { ripartizione_id: ripartizione.id },
    success_url: `${origine}/area-riservata?pagamento=ok`,
    cancel_url: `${origine}/area-riservata?pagamento=annullato`,
  });

  if (session.url) {
    await supabase
      .from("ripartizioni")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", ripartizioneId);

    redirect(session.url);
  }

  redirect("/area-riservata");
}
