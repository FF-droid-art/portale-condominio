import { User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { RigaUtente } from "./riga-utente";
import type { Utente } from "@/lib/types";
import { Table, TableHeader, TableBody, TableRow, TableHead } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";

export default async function UtentiPage() {
  const supabase = await createClient();
  const { data: utenti } = await supabase
    .from("utenti")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold tracking-tight">Utenti</h1>
      <p className="text-sm text-muted-foreground max-w-xl">
        Qui vedi solo gli utenti collegati ai tuoi condomini: puoi
        promuovere un condomino ad amministratore o riportarlo a
        condomino. Le unità immobiliari vanno collegate a un utente tramite
        la tabella <code>unita_proprietari</code> (non ancora gestita da
        questa interfaccia).
      </p>

      {utenti?.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Ruolo</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(utenti as Utente[]).map((u) => (
              <RigaUtente key={u.id} utente={u} />
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState icon={User} title="Nessun utente registrato" />
      )}
    </div>
  );
}
