import { richiedeUtente } from "@/lib/supabase/dal";
import { NavHeader } from "@/components/nav-header";
import { ImpersonazioneBanner } from "./impersonazione-banner";

const LINK_CONDOMINO = [
  { href: "/area-riservata", label: "Dashboard" },
  { href: "/area-riservata/assemblee", label: "Assemblee" },
];

export default async function AreaRiservataLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const utente = await richiedeUtente();

  return (
    <div className="flex flex-1 flex-col">
      <ImpersonazioneBanner />
      <NavHeader utente={utente} links={LINK_CONDOMINO} />
      <main className="max-w-6xl mx-auto w-full px-4 py-8 flex-1">
        {children}
      </main>
    </div>
  );
}
