import { richiedeAmministratore } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";
import { NavHeader } from "@/components/nav-header";

const LINK_ADMIN = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/condomini", label: "Condomini" },
  { href: "/admin/spese", label: "Spese" },
  { href: "/admin/assemblee", label: "Assemblee" },
  { href: "/admin/importa", label: "Importa dati" },
  { href: "/admin/utenti", label: "Utenti" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const utente = await richiedeAmministratore();

  // Un amministratore può anche essere condomino altrove (es. possiede
  // un'unità in un condominio gestito da qualcun altro): se è collegato
  // ad almeno un'unità, gli mostriamo un link diretto alla sua area
  // riservata invece di lasciarlo intrappolato nel solo pannello admin.
  const supabase = await createClient();
  const { data: unitaPossedute } = await supabase
    .from("unita_proprietari")
    .select("id")
    .eq("utente_id", utente.id)
    .limit(1);

  const link = unitaPossedute?.length
    ? [...LINK_ADMIN, { href: "/area-riservata", label: "La mia area condomino" }]
    : LINK_ADMIN;

  return (
    <div className="flex flex-1 flex-col">
      <NavHeader utente={utente} links={link} />
      <main className="max-w-6xl mx-auto w-full px-4 py-8 flex-1">
        {children}
      </main>
    </div>
  );
}
