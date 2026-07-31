import Stripe from "stripe";

// Costruito pigramente (non al momento dell'import) perché altrimenti
// il build fallirebbe ovunque questo modulo viene importato in
// ambienti senza STRIPE_SECRET_KEY (es. build locale prima del
// provisioning Stripe): il modulo "stripe" richiede la chiave subito
// alla costruzione, a differenza di "resend" che è più permissivo.
let client: Stripe | undefined;

export function getStripe(): Stripe {
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return client;
}
