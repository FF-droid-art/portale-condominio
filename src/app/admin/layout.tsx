import { richiedeAmministratore } from "@/lib/supabase/dal";
import { NavHeader } from "@/components/nav-header";

const LINK_ADMIN = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/condomini", label: "Condomini" },
  { href: "/admin/spese", label: "Spese" },
  { href: "/admin/importa", label: "Importa dati" },
  { href: "/admin/assemblee", label: "Assemblee" },
  { href: "/admin/utenti", label: "Utenti" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const utente = await richiedeAmministratore();

  return (
    <div className="flex flex-1 flex-col">
      <NavHeader utente={utente} links={LINK_ADMIN} />
      <main className="max-w-6xl mx-auto w-full px-4 py-8 flex-1">
        {children}
      </main>
    </div>
  );
}
