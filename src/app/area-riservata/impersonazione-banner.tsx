import { cookies } from "next/headers";
import { Eye } from "lucide-react";
import { COOKIE_IMPERSONAZIONE, type SessioneImpersonazione } from "@/lib/impersonazione";
import { terminaImpersonazione } from "@/app/admin/utenti/actions";
import { Button } from "@/components/ui/button";

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
    <div className="bg-warning-bg text-warning px-4 py-2 flex flex-wrap items-center justify-center gap-3 text-sm">
      <Eye className="size-4" />
      <span>
        Stai visualizzando come <strong>{sessione.target_nome}</strong> — sei {sessione.admin_nome}
      </span>
      <form action={terminaImpersonazione}>
        <Button variant="secondary" size="sm" type="submit">
          Torna amministratore
        </Button>
      </form>
    </div>
  );
}
