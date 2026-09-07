import { cookies } from "next/headers";
import { Eye } from "lucide-react";
import { COOKIE_IMPERSONAZIONE, type SessioneImpersonazione } from "@/lib/impersonazione";
import { terminaImpersonazione } from "@/app/admin/utenti/actions";
import { Button } from "@/components/ui/button";

/**
 * Striscia sempre visibile in cima alla pagina durante una sessione
 * "Visualizza come". Deve essere impossibile da confondere con
 * l'interfaccia normale: chi sta guardando i dati di un altro utente deve
 * saperlo in ogni momento e poter tornare indietro con un solo clic.
 *
 * L'altezza è fissa (`h-12`, pari a `--altezza-banner`) perché la barra
 * laterale e l'intestazione mobile, entrambe adesive, si spostano di
 * altrettanto quando questa striscia è presente: la regola sta in
 * `globals.css` e si attiva da sola grazie alla classe
 * `barra-impersonazione`.
 */
export async function ImpersonazioneBanner() {
  const cookieStore = await cookies();
  const grezzo = cookieStore.get(COOKIE_IMPERSONAZIONE)?.value;
  if (!grezzo) return null;

  let sessione: SessioneImpersonazione;
  try {
    sessione = JSON.parse(grezzo);
  } catch {
    return null;
  }

  return (
    <div
      role="status"
      className="barra-impersonazione sticky top-0 z-40 flex h-12 items-center border-b border-warning/30 bg-warning-bg text-warning"
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <span className="flex min-w-0 items-center gap-2 text-sm">
          <Eye className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">
            Stai visualizzando il portale come{" "}
            <strong className="font-semibold">{sessione.target_nome}</strong>
            <span className="hidden md:inline"> — sei {sessione.admin_nome}</span>
          </span>
        </span>

        <form action={terminaImpersonazione} className="shrink-0">
          <Button variant="secondary" size="sm" type="submit">
            <span className="hidden sm:inline">Torna amministratore</span>
            <span className="sm:hidden">Torna admin</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
