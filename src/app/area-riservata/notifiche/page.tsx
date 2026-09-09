import { MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { richiedeUtente } from "@/lib/supabase/dal";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { statoPreferenze, type PreferenzaNotifica, type TipoEvento } from "@/lib/notifiche";
import { PreferenzeForm } from "./preferenze-form";

export const metadata = { title: "Notifiche" };

export default async function NotifichePage() {
  const utente = await richiedeUtente();
  const supabase = await createClient();

  const { data } = await supabase
    .from("preferenze_notifiche")
    .select("tipo_evento, email_attiva")
    .eq("utente_id", utente.id);

  const attive = Object.fromEntries(
    statoPreferenze((data ?? []) as PreferenzaNotifica[]).map((s) => [s.tipo, s.attiva])
  ) as Record<TipoEvento, boolean>;

  return (
    <PageBody>
      <PageHeader
        titolo="Notifiche"
        descrizione="Scegli per quali avvisi vuoi ricevere una email. Quello che disattivi resta comunque visibile nel portale: cambia solo la posta che ti arriva."
      />

      <Alert tono="info" titolo="Le email di accesso arrivano sempre">
        Il recupero della password e i codici di conferma non si possono disattivare da qui:
        senza quelli non potresti più entrare nel portale.
      </Alert>

      <Card>
        <div className="mb-6 flex items-start gap-3">
          <span
            className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-muted-foreground"
            aria-hidden="true"
          >
            <MailCheck className="size-4" />
          </span>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Le email vengono inviate a <span className="font-medium text-foreground">{utente.email}</span>.
            Tutte le voci sono attive finché non le togli tu.
          </p>
        </div>

        <PreferenzeForm attive={attive} />
      </Card>
    </PageBody>
  );
}
