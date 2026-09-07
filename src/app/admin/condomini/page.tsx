import { Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { NuovoCondominioBox } from "./nuovo-condominio-box";
import { ElencoCondomini, type CondominioInElenco } from "./elenco-condomini";

export const metadata = { title: "Condomìni" };

export default async function CondominiPage() {
  const supabase = await createClient();
  const [{ data: condomini }, { data: unita }] = await Promise.all([
    supabase.from("condomini").select("*").order("created_at", { ascending: false }),
    supabase.from("unita").select("condominio_id"),
  ]);

  const conteggioUnita = new Map<string, number>();
  for (const u of unita ?? []) {
    conteggioUnita.set(u.condominio_id, (conteggioUnita.get(u.condominio_id) ?? 0) + 1);
  }

  const elenco: CondominioInElenco[] = (condomini ?? []).map((c) => ({
    id: c.id,
    nome: c.nome,
    indirizzo: c.indirizzo,
    codice_fiscale: c.codice_fiscale ?? null,
    numeroUnita: conteggioUnita.get(c.id) ?? 0,
  }));

  return (
    <PageBody>
      <PageHeader
        titolo="Condomìni"
        descrizione="Tutti i condomìni che amministri. Apri una scheda per gestire unità, occupanti, spese e assemblee."
        azioni={<NuovoCondominioBox />}
      />

      {elenco.length ? (
        <ElencoCondomini condomini={elenco} />
      ) : (
        <EmptyState
          icon={Building2}
          title="Nessun condominio registrato"
          description="Aggiungi il primo condominio a mano oppure importa in un colpo solo condomìni, unità e occupanti da un file .xlsx o .csv."
          action={
            <>
              <NuovoCondominioBox />
              <Button href="/admin/importa/condomini-unita" variant="secondary">
                Importa da un file
              </Button>
            </>
          }
        />
      )}
    </PageBody>
  );
}
