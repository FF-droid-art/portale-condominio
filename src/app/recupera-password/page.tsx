"use client";

import { useActionState } from "react";
import Link from "next/link";
import { richiediReset } from "./actions";
import { Card } from "@/components/ui/card";
import { Field, Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function RecuperaPasswordPage() {
  const [stato, action, pending] = useActionState(richiediReset, undefined);

  if (stato?.successo) {
    return (
      <div className="bg-auth flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-sm rounded-3xl text-center flex flex-col gap-4">
          <h1 className="text-3xl font-bold tracking-tight">
            Controlla la tua email
          </h1>
          <p className="text-sm text-muted-foreground">
            Se l&apos;indirizzo corrisponde a un account esistente, ti abbiamo
            inviato un link per reimpostare la password.
          </p>
          <Link href="/login" className="font-medium text-accent">
            Torna al login
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-auth flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm rounded-3xl">
        <form action={action} className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold tracking-tight">
            Recupera password
          </h1>
          <p className="text-sm text-muted-foreground">
            Inserisci l&apos;email con cui ti sei registrato: ti mandiamo un
            link per scegliere una nuova password.
          </p>

          <Field>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </Field>

          {stato?.errore && (
            <p className="text-sm text-danger">{stato.errore}</p>
          )}

          <Button type="submit" pending={pending} className="mt-2 w-full">
            {pending ? "Invio in corso…" : "Invia link di reset"}
          </Button>

          <p className="text-sm text-center text-muted-foreground">
            <Link href="/login" className="font-medium text-accent">
              Torna al login
            </Link>
          </p>
        </form>
      </Card>
    </div>
  );
}
