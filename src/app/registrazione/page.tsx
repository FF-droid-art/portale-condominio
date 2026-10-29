"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { registrati } from "./actions";
import { AuthShell, AuthLink } from "@/components/auth-shell";
import { Field, FormGrid, Input, Select } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TurnstileWidget } from "@/components/turnstile-widget";

export default function RegistrazionePage() {
  const [stato, action, pending] = useActionState(registrati, undefined);
  // Se la chiave pubblica del captcha non è configurata, il widget non
  // compare: in quel caso il form resta utilizzabile senza bloccarsi in
  // attesa di una verifica che non arriverà mai (es. in sviluppo locale).
  const captchaConfigurato = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const [captchaPronto, setCaptchaPronto] = useState(!captchaConfigurato);

  if (stato?.successo) {
    return (
      <AuthShell
        titolo="Controlla la tua email"
        sottotitolo="Ti abbiamo inviato un link di conferma: aprilo per attivare l'account, poi potrai accedere."
      >
        <div className="flex flex-col items-center gap-5 text-center">
          <span
            className="grid size-12 place-items-center rounded-2xl bg-success-bg text-success"
            aria-hidden="true"
          >
            <MailCheck className="size-6" />
          </span>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Se non lo trovi entro qualche minuto, controlla anche la cartella
            della posta indesiderata.
          </p>
          <Button href="/login" variant="secondary" full>
            Torna all&apos;accesso
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      titolo="Crea il tuo account"
      sottotitolo="Bastano pochi dati: potrai completare tutto il resto dopo."
      piede={
        <>
          Hai già un account? <AuthLink href="/login">Accedi</AuthLink>
        </>
      }
    >
      <form action={action} className="flex flex-col gap-4">
        <FormGrid colonne={2}>
          <Field id="nome" label="Nome" required>
            <Input name="nome" autoComplete="given-name" required />
          </Field>
          <Field id="cognome" label="Cognome" required>
            <Input name="cognome" autoComplete="family-name" required />
          </Field>
        </FormGrid>

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

        <Field id="password" label="Password" required hint="Almeno 8 caratteri.">
          <PasswordInput name="password" autoComplete="new-password" minLength={8} required />
        </Field>

        <Field
          id="ruolo"
          label="Come vuoi registrarti?"
          hint="Puoi cambiare idea più avanti: sarà l'amministratore a collegarti alle tue unità."
        >
          <Select name="ruolo" defaultValue="condomino">
            <option value="condomino">Sono un condòmino</option>
            <option value="amministratore">Sono l&apos;amministratore di un condominio</option>
          </Select>
        </Field>

        <TurnstileWidget onChange={setCaptchaPronto} />

        <p className="text-xs leading-relaxed text-muted-foreground">
          Creando l&apos;account accetti il trattamento dei tuoi dati descritto
          nella{" "}
          <Link href="/privacy" className="font-medium text-accent-ink underline-offset-4 hover:underline">
            privacy policy
          </Link>
          .
        </p>

        <FormError>{stato?.errore}</FormError>

        <Button
          type="submit"
          pending={pending}
          disabled={!captchaPronto}
          full
          size="lg"
          className="mt-1"
        >
          {pending ? "Creazione account…" : "Crea account"}
        </Button>
      </form>
    </AuthShell>
  );
}
