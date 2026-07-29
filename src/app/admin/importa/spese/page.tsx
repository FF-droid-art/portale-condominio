import { createClient } from "@/lib/supabase/server";
import { ImportSpeseWizard } from "./wizard";

export default async function ImportaSpesePage() {
  const supabase = await createClient();
  const { data: condomini } = await supabase
    .from("condomini")
    .select("id, nome")
    .order("nome");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Importa spese storiche</h1>
        <p className="text-muted-foreground mt-1">
          Carica un file .xlsx o .csv con una riga per ogni quota di unità su
          una spesa. Le unità devono già esistere nel condominio scelto.
        </p>
      </div>

      <ImportSpeseWizard condomini={condomini ?? []} />
    </div>
  );
}
