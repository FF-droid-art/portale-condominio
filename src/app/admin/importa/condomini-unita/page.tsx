import { PageBody, PageHeader } from "@/components/ui/page-header";
import { ImportCondominiUnitaWizard } from "./wizard";

export const metadata = { title: "Importa condomìni e unità" };

export default function ImportaCondominiUnitaPage() {
  return (
    <PageBody>
      <PageHeader
        indietro={{ href: "/admin/importa", label: "Importa dati" }}
        titolo="Importa condomìni e unità"
        descrizione="Il percorso più completo: da un unico file nascono i condomìni, le loro unità, le persone in anagrafica e le tabelle millesimali. I condomìni con stesso nome e indirizzo di uno esistente vengono riutilizzati invece che duplicati."
      />
      <ImportCondominiUnitaWizard />
    </PageBody>
  );
}
