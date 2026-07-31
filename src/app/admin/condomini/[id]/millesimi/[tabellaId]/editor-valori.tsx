"use client";

import { useActionState } from "react";
import { aggiornaValoriMillesimali } from "../actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

export function EditorValoriMillesimali({
  condominioId,
  tabellaId,
  righe,
}: {
  condominioId: string;
  tabellaId: string;
  righe: { unitaId: string; identificativo: string; piano: string | null; valore: number }[];
}) {
  const [stato, action, pending] = useActionState(aggiornaValoriMillesimali, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="condominio_id" value={condominioId} />
      <input type="hidden" name="tabella_id" value={tabellaId} />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Unità</TableHead>
            <TableHead>Piano</TableHead>
            <TableHead>Valore</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {righe.map((r) => (
            <TableRow key={r.unitaId}>
              <TableCell className="font-medium">{r.identificativo}</TableCell>
              <TableCell>{r.piano ?? "-"}</TableCell>
              <TableCell>
                <input type="hidden" name="unita_id" value={r.unitaId} />
                <Input
                  name={`valore_${r.unitaId}`}
                  type="number"
                  step="0.001"
                  min="0"
                  defaultValue={r.valore}
                  className="w-32"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {stato?.errore && <p className="text-sm text-danger">{stato.errore}</p>}

      <Button type="submit" pending={pending} className="w-fit">
        {pending ? "Salvataggio…" : "Salva tutti i valori"}
      </Button>
    </form>
  );
}
