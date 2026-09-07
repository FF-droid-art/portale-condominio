import { createClient } from "@/lib/supabase/server";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { ImportSpeseWizard } from "./wizard";

export const metadata = { title: "Importa spese storiche" };

export default async function ImportaSpesePage() {
  const supabase = await createClient();
  const { data: condomini } = await supabase
    .from("condomini")
    .select("id, nome")
    .order("nome");

  return (
    <PageBody>
      <PageHeader
        indietro={{ href: "/admin/importa", label: "Importa dati" }}
        titolo="Importa spese storiche"
        descrizione="Per le spese degli anni passati, già ripartite fra le unità: una riga per ogni quota. Le unità citate nel file devono esistere già nel condominio scelto."
      />
      <ImportSpeseWizard condomini={condomini ?? []} />
    </PageBody>
  );
}
