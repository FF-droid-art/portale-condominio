import { ImportCondominiUnitaWizard } from "./wizard";

export default function ImportaCondominiUnitaPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Importa condomìni e unità</h1>
        <p className="text-muted-foreground mt-1">
          Carica un file .xlsx o .csv con più condomìni insieme: una riga per
          ogni unità, con le colonne del condominio (nome, indirizzo) ripetute
          su ogni riga. I condomìni già esistenti (stesso nome e indirizzo)
          vengono riutilizzati, gli altri creati automaticamente.
        </p>
      </div>

      <ImportCondominiUnitaWizard />
    </div>
  );
}
