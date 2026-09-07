"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Utente } from "@/lib/types";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchField } from "@/components/ui/search-field";
import { RigaUtente } from "./riga-utente";

export function ElencoUtenti({ utenti }: { utenti: Utente[] }) {
  const [ricerca, setRicerca] = useState("");

  const visibili = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    if (!q) return utenti;
    return utenti.filter((u) =>
      [u.nome, u.cognome, u.email, `${u.nome} ${u.cognome}`].some((campo) =>
        campo.toLowerCase().includes(q)
      )
    );
  }, [utenti, ricerca]);

  return (
    <div className="flex flex-col gap-4">
      {utenti.length > 6 && (
        <SearchField
          valore={ricerca}
          onCambia={setRicerca}
          placeholder="Cerca per nome o email…"
          etichetta="Cerca fra gli utenti"
        />
      )}

      {visibili.length === 0 ? (
        <EmptyState
          compatta
          icon={Search}
          title="Nessun utente trovato"
          description={`Nessun risultato per "${ricerca}".`}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Ruolo</TableHead>
              <TableHead>
                <span className="sr-only">Azioni</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibili.map((u) => (
              <RigaUtente key={u.id} utente={u} />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
