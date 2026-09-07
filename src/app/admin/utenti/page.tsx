import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Utente } from "@/lib/types";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { ElencoUtenti } from "./elenco-utenti";

export const metadata = { title: "Utenti" };

export default async function UtentiPage() {
  const supabase = await createClient();
  const { data: utenti } = await supabase
    .from("utenti")
    .select("*")
    .order("created_at", { ascending: false });

  const elenco = (utenti ?? []) as Utente[];

  return (
    <PageBody>
      <PageHeader
        titolo="Utenti"
        descrizione="Gli account registrati collegati ai tuoi condomìni. Da qui puoi promuovere un condòmino ad amministratore, riportarlo a condòmino oppure vedere il portale con i suoi occhi."
      />

      <Alert tono="info" titolo="Come si collega un utente a un'unità">
        Il legame fra una persona e la sua unità immobiliare si crea dalla scheda dell&apos;unità,
        con «Aggiungi soggetto». Qui si gestiscono solo i permessi dell&apos;account.
      </Alert>

      {elenco.length ? (
        <ElencoUtenti utenti={elenco} />
      ) : (
        <EmptyState
          icon={Users}
          title="Nessun utente registrato"
          description="Qui compariranno gli account dei condòmini dei tuoi condomìni, non appena si registreranno al portale."
        />
      )}
    </PageBody>
  );
}
