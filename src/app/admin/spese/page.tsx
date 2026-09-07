import { Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { SpesaForm } from "./form";
import { ElencoSpese, type SpesaInElenco } from "./elenco-spese";

export const metadata = { title: "Spese" };

export default async function SpesePage() {
  const supabase = await createClient();

  const [{ data: spese }, { data: condomini }, { data: ripartizioni }] = await Promise.all([
    supabase
      .from("spese")
      .select("*, condominio:condominio_id(nome)")
      .order("data_spesa", { ascending: false }),
    supabase.from("condomini").select("id, nome").order("nome"),
    supabase.from("ripartizioni").select("spesa_id, stato_pagamento"),
  ]);

  const pagamentiPerSpesa = new Map<string, { totale: number; pagate: number }>();
  for (const r of ripartizioni ?? []) {
    const voce = pagamentiPerSpesa.get(r.spesa_id) ?? { totale: 0, pagate: 0 };
    voce.totale += 1;
    if (r.stato_pagamento === "pagato") voce.pagate += 1;
    pagamentiPerSpesa.set(r.spesa_id, voce);
  }

  const elenco: SpesaInElenco[] = (spese ?? []).map((s) => {
    const pagamenti = pagamentiPerSpesa.get(s.id);
    return {
      id: s.id,
      descrizione: s.descrizione,
      categoria: s.categoria,
      importo_totale: s.importo_totale,
      data_spesa: s.data_spesa,
      condominioNome: s.condominio?.nome ?? null,
      ripartizioniTotali: pagamenti?.totale ?? 0,
      ripartizioniPagate: pagamenti?.pagate ?? 0,
    };
  });

  return (
    <PageBody>
      <PageHeader
        titolo="Spese"
        descrizione="Tutte le spese dei condomìni che amministri. Apri una spesa per generare o correggere la ripartizione fra le unità."
        azioni={<SpesaForm condomini={condomini ?? []} />}
      />

      {elenco.length ? (
        <ElencoSpese spese={elenco} />
      ) : (
        <EmptyState
          icon={Wallet}
          title="Nessuna spesa registrata"
          description="Registra la prima spesa oppure importa in blocco le spese storiche già ripartite da un file .xlsx o .csv."
          action={
            <>
              <SpesaForm condomini={condomini ?? []} />
              <Button href="/admin/importa/spese" variant="secondary">
                Importa spese storiche
              </Button>
            </>
          }
        />
      )}
    </PageBody>
  );
}
