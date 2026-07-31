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

  // Chi ha ruolo amministratore ma è anche collegato a un'unità (es.
  // condomino altrove) può tornare al pannello admin da qui. Durante
  // un'impersonazione "Visualizza come" questo non compare, perché in
  // quel caso richiedeUtente() restituisce l'utente impersonato (un
  // condomino vero), non l'amministratore che ha avviato la sessione.
  const link =
    utente.ruolo === "amministratore"
      ? [...LINK_CONDOMINO, { href: "/admin", label: "Pannello amministratore" }]
      : LINK_CONDOMINO;

  return (
    <div className="flex flex-1 flex-col">
      <ImpersonazioneBanner />
      <NavHeader utente={utente} links={link} />
      <main className="max-w-6xl mx-auto w-full px-4 py-8 flex-1">
        {children}
      </main>
    </div>
  );
}
