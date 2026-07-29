import { Building2, Home, Wallet, CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/ui/card";

export default async function AdminDashboard() {
  const supabase = await createClient();

  const [{ count: condomini }, { count: unita }, { count: spese }, { count: assemblee }] =
    await Promise.all([
      supabase.from("condomini").select("*", { count: "exact", head: true }),
      supabase.from("unita").select("*", { count: "exact", head: true }),
      supabase.from("spese").select("*", { count: "exact", head: true }),
      supabase.from("assemblee").select("*", { count: "exact", head: true }),
    ]);

  const voci = [
    { etichetta: "Condomini", valore: condomini ?? 0, icona: Building2 },
    { etichetta: "Unità immobiliari", valore: unita ?? 0, icona: Home },
    { etichetta: "Spese registrate", valore: spese ?? 0, icona: Wallet },
    { etichetta: "Assemblee", valore: assemblee ?? 0, icona: CalendarClock },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight">
        Dashboard amministratore
      </h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {voci.map((voce) => (
          <StatCard
            key={voce.etichetta}
            label={voce.etichetta}
            value={voce.valore}
            icon={voce.icona}
          />
        ))}
      </div>
    </div>
  );
}
