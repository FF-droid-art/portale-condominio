"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registrati } from "./actions";
import { Card } from "@/components/ui/card";
import { Field, Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function RegistrazionePage() {
  const [stato, action, pending] = useActionState(registrati, undefined);

  if (stato?.successo) {
    return (
      <div className="bg-auth flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-sm rounded-3xl text-center flex flex-col gap-4">
          <h1 className="text-3xl font-bold tracking-tight">
            Controlla la tua email
          </h1>
          <p className="text-sm text-muted-foreground">
            Ti abbiamo inviato un link di conferma. Dopo aver confermato
            potrai accedere.
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
            Crea un account
          </h1>

          <div className="flex gap-3">
            <Field className="flex-1">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" name="nome" required />
            </Field>
            <Field className="flex-1">
              <Label htmlFor="cognome">Cognome</Label>
              <Input id="cognome" name="cognome" required />
            </Field>
          </div>

          <Field>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </Field>

          <Field>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
            />
          </Field>

          <Field>
            <Label htmlFor="ruolo">Come vuoi registrarti?</Label>
            <Select id="ruolo" name="ruolo" defaultValue="condomino">
              <option value="condomino">Sono un condomino</option>
              <option value="amministratore">
                Sono l&apos;amministratore di un condominio
              </option>
            </Select>
          </Field>

          {stato?.errore && (
            <p className="text-sm text-danger">{stato.errore}</p>
          )}

          <Button type="submit" pending={pending} className="mt-2 w-full">
            {pending ? "Creazione account…" : "Registrati"}
          </Button>

          <p className="text-sm text-center text-muted-foreground">
            Hai già un account?{" "}
            <Link href="/login" className="font-medium text-accent">
              Accedi
            </Link>
          </p>
        </form>
      </Card>
    </div>
  );
}
