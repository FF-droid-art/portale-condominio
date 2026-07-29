"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "./actions";
import { Card } from "@/components/ui/card";
import { Field, Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [stato, action, pending] = useActionState(login, undefined);

  return (
    <div className="bg-auth flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm rounded-3xl">
        <form action={action} className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold tracking-tight">
            Accedi al portale
          </h1>

          <Field>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </Field>

          <Field>
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/recupera-password" className="text-sm text-accent">
                Password dimenticata?
              </Link>
            </div>
            <Input id="password" name="password" type="password" required />
          </Field>

          {stato?.errore && (
            <p className="text-sm text-danger">{stato.errore}</p>
          )}

          <Button type="submit" pending={pending} className="mt-2 w-full">
            {pending ? "Accesso in corso…" : "Accedi"}
          </Button>

          <p className="text-sm text-center text-muted-foreground">
            Non hai un account?{" "}
            <Link href="/registrazione" className="font-medium text-accent">
              Registrati
            </Link>
          </p>
        </form>
      </Card>
    </div>
  );
}
