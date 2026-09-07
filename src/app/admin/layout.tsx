import { richiedeAmministratore } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const utente = await richiedeAmministratore();

  // Un amministratore può anche essere condomino altrove (es. possiede
  // un'unità in un condominio gestito da qualcun altro): se è collegato
  // ad almeno un'unità, gli mostriamo un collegamento diretto alla sua area
  // riservata invece di lasciarlo intrappolato nel solo pannello admin.
  const supabase = await createClient();
  const { data: unitaPossedute } = await supabase
    .from("unita_proprietari")
    .select("id")
    .eq("utente_id", utente.id)
    .limit(1);

  return (
    <AppShell utente={utente} area="admin" cambioArea={Boolean(unitaPossedute?.length)}>
      {children}
    </AppShell>
  );
}
