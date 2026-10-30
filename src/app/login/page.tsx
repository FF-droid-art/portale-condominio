"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { login } from "./actions";
import { AuthShell, AuthLink } from "@/components/auth-shell";
import { Field, Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TurnstileWidget } from "@/components/turnstile-widget";

export default function LoginPage() {
  const [stato, action, pending] = useActionState(login, undefined);
  // Vedi recupera-password/page.tsx: la protezione captcha di Supabase,
  // se attiva sul progetto, può coprire anche l'accesso con password,
  // non solo la registrazione.
  const captchaConfigurato = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const [captchaPronto, setCaptchaPronto] = useState(!captchaConfigurato);

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

        <TurnstileWidget onChange={setCaptchaPronto} />

        <FormError>{stato?.errore}</FormError>

        <Button
          type="submit"
          pending={pending}
          disabled={!captchaPronto}
          full
          size="lg"
          className="mt-1"
        >
          {pending ? "Accesso in corso…" : "Accedi"}
        </Button>
      </form>
    </AuthShell>
  );
}
