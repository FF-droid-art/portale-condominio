import { createClient } from "@/lib/supabase/server";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { ImportUnitaWizard } from "./wizard";

export const metadata = { title: "Importa unità" };

export default async function ImportaUnitaPage() {
  const supabase = await createClient();
  const { data: condomini } = await supabase
    .from("condomini")
    .select("id, nome")
    .order("nome");

  return (
    <PageBody>
      <PageHeader
        indietro={{ href: "/admin/importa", label: "Importa dati" }}
        titolo="Importa unità"
        descrizione="Aggiunge unità immobiliari a un condominio che hai già creato: identificativo, piano e millesimi. Per importare anche gli occupanti usa invece «Condomìni e unità»."
      />
      <ImportUnitaWizard condomini={condomini ?? []} />
    </PageBody>
  );
}
