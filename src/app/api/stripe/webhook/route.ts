import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";

// Il webhook non ha una sessione utente (Stripe chiama questo endpoint
// direttamente, senza cookie di autenticazione): serve il client con
// service role per poter aggiornare "ripartizioni" bypassando la RLS.
export async function POST(request: NextRequest) {
  const firma = request.headers.get("stripe-signature");
  const corpoGrezzo = await request.text();

  if (!firma) {
    return NextResponse.json({ errore: "Firma mancante" }, { status: 400 });
  }

  let evento: Stripe.Event;
  try {
    evento = getStripe().webhooks.constructEvent(
      corpoGrezzo,
      firma,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const messaggio = err instanceof Error ? err.message : "Firma non valida";
    return NextResponse.json({ errore: messaggio }, { status: 400 });
  }

  if (evento.type === "checkout.session.completed") {
    const session = evento.data.object as Stripe.Checkout.Session;
    const ripartizioneId = session.metadata?.ripartizione_id;

    if (ripartizioneId) {
      const supabase = createServiceClient();
      await supabase
        .from("ripartizioni")
        .update({
          stato_pagamento: "pagato",
          data_pagamento: new Date().toISOString().slice(0, 10),
        })
        .eq("id", ripartizioneId);
    }
  }

  return NextResponse.json({ received: true });
}
