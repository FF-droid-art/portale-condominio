import { createClient } from "@/lib/supabase/server";
import { ImportUnitaWizard } from "./wizard";

export default async function ImportaUnitaPage() {
  const supabase = await createClient();
  const { data: condomini } = await supabase
    .from("condomini")
    .select("id, nome")
    .order("nome");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Importa unità</h1>
        <p className="text-muted-foreground mt-1">
          Carica un file .xlsx o .csv con l&apos;elenco delle unità immobiliari di un
          condominio (identificativo, piano, millesimi).
        </p>
      </div>

      <ImportUnitaWizard condomini={condomini ?? []} />
    </div>
  );
}
