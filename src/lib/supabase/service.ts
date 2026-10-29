import "server-only";
import { createClient } from "@supabase/supabase-js";

// Client con la service role key: bypassa la RLS. Da usare SOLO in
// contesti senza sessione utente (es. il webhook Stripe), mai
// esposto al browser né importato da componenti client.
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
