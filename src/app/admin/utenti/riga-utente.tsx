"use client";

import { useActionState } from "react";
import { Check, Eye, User } from "lucide-react";
import { cambiaRuolo, visualizzaComeCondomino } from "./actions";
import type { Utente } from "@/lib/types";
import { TableRow, TableCell, RowIcon } from "@/components/ui/table";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/alert";

export function RigaUtente({ utente }: { utente: Utente }) {
  const [stato, action, pending] = useActionState(cambiaRuolo, undefined);
  const nomeCompleto = `${utente.nome} ${utente.cognome}`;
  const idRuolo = `ruolo-${utente.id}`;

  return (
    <TableRow>
      <TableCell className="font-medium">
        <RowIcon icon={User}>{nomeCompleto}</RowIcon>
      </TableCell>

      <TableCell etichetta="Email" className="text-muted-foreground">
        {utente.email}
      </TableCell>

      <TableCell etichetta="Ruolo">
        <form action={action} className="flex flex-col items-start gap-1">
          <input type="hidden" name="utente_id" value={utente.id} />
          <div className="flex items-center gap-2">
            <label htmlFor={idRuolo} className="sr-only">
              Ruolo di {nomeCompleto}
            </label>
            <Select
              id={idRuolo}
              name="ruolo"
              defaultValue={utente.ruolo}
              dimensione="sm"
              contenitoreClassName="w-auto"
              className="w-auto min-w-40 text-sm"
            >
              <option value="condomino">Condòmino</option>
              <option value="amministratore">Amministratore</option>
            </Select>
            <Button
              variant="secondary"
              size="sm"
              iconOnly
              type="submit"
              pending={pending}
              aria-label={`Salva il ruolo di ${nomeCompleto}`}
              title="Salva"
            >
              {!pending && <Check className="size-4" aria-hidden="true" />}
            </Button>
          </div>
          <FormError piccolo>{stato?.errore}</FormError>
        </form>
      </TableCell>

      <TableCell className="md:text-right">
        {utente.ruolo === "condomino" && (
          <form action={visualizzaComeCondomino} className="md:flex md:justify-end">
            <input type="hidden" name="utente_id" value={utente.id} />
            <Button
              variant="ghost"
              size="sm"
              type="submit"
              aria-label={`Visualizza il portale come ${nomeCompleto}`}
            >
              <Eye className="size-4" aria-hidden="true" />
              Visualizza come
            </Button>
          </form>
        )}
      </TableCell>
    </TableRow>
  );
}
