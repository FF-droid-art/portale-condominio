"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "./actions";
import { AuthShell, AuthLink } from "@/components/auth-shell";
import { Field, Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [stato, action, pending] = useActionState(login, undefined);

  return (
    <AuthShell
      titolo="Accedi al portale"
      sottotitolo="Inserisci le credenziali con cui ti sei registrato."
      piede={
        <>
          Non hai un account? <AuthLink href="/registrazione">Registrati</AuthLink>
        </>
      }
    >
      <form action={action} className="flex flex-col gap-4">
        <Field id="email" label="Email" required>
          <Input
            name="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="nome@esempio.it"
            required
          />
        </Field>

        <Field
          id="password"
          label="Password"
          required
          action={
            <Link
              href="/recupera-password"
              className="rounded text-sm font-medium text-accent-ink underline-offset-4 hover:underline"
            >
              Password dimenticata?
            </Link>
          }
        >
          <PasswordInput name="password" autoComplete="current-password" required />
        </Field>

        <FormError>{stato?.errore}</FormError>

        <Button type="submit" pending={pending} full size="lg" className="mt-1">
          {pending ? "Accesso in corso…" : "Accedi"}
        </Button>
      </form>
    </AuthShell>
  );
}
