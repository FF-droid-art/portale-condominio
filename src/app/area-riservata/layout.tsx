import type { Metadata } from "next";
import { richiedeUtente } from "@/lib/supabase/dal";
import { AppShell } from "@/components/app-shell";
import { ImpersonazioneBanner } from "./impersonazione-banner";

// SITO-02: vedi la stessa nota in src/app/admin/layout.tsx.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

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
  return (
    <AppShell
      utente={utente}
      area="condomino"
      cambioArea={utente.ruolo === "amministratore"}
      banner={<ImpersonazioneBanner />}
    >
      {children}
    </AppShell>
  );
}
