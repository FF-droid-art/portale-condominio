"use client";

import { useActionState } from "react";
import { User } from "lucide-react";
import { cambiaRuolo } from "./actions";
import type { Utente } from "@/lib/types";
import { TableRow, TableCell, RowIcon } from "@/components/ui/table";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function RigaUtente({ utente }: { utente: Utente }) {
  const [stato, action, pending] = useActionState(cambiaRuolo, undefined);

  return (
    <TableRow className="align-top">
      <TableCell className="font-medium">
        <RowIcon icon={User}>
          {utente.nome} {utente.cognome}
        </RowIcon>
      </TableCell>
      <TableCell>{utente.email}</TableCell>
      <TableCell>
        <form action={action} className="flex items-center gap-2">
          <input type="hidden" name="utente_id" value={utente.id} />
          <Select name="ruolo" defaultValue={utente.ruolo} className="py-1">
            <option value="condomino">condomino</option>
            <option value="amministratore">amministratore</option>
          </Select>
          <Button variant="secondary" size="sm" type="submit" pending={pending}>
            Salva
          </Button>
        </form>
        {stato?.errore && (
          <p className="text-xs text-danger mt-1">{stato.errore}</p>
        )}
      </TableCell>
    </TableRow>
  );
}
