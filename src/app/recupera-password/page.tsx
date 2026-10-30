"use client";

import { useActionState, useState } from "react";
import { MailCheck } from "lucide-react";
import { richiediReset } from "./actions";
import { AuthShell, AuthLink } from "@/components/auth-shell";
import { Field, Input } from "@/components/ui/input";
import { FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TurnstileWidget } from "@/components/turnstile-widget";

export default function RecuperaPasswordPage() {
  const [stato, action, pending] = useActionState(richiediReset, undefined);
  // La protezione captcha di Supabase, una volta attiva sul progetto, non
  // si limita alla registrazione: copre anche il recupero password. Senza
  // il widget qui, ogni richiesta falliva con "no captcha_token found".
  const captchaConfigurato = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const [captchaPronto, setCaptchaPronto] = useState(!captchaConfigurato);

  if (stato?.successo) {
    return (
      <AuthShell
        titolo="Controlla la tua email"
        sottotitolo="Se l'indirizzo corrisponde a un account esistente, ti abbiamo inviato un link per scegliere una nuova password."
      >
        <div className="flex flex-col items-center gap-5 text-center">
          <span
            className="grid size-12 place-items-center rounded-2xl bg-success-bg text-success"
            aria-hidden="true"
          >
            <MailCheck className="size-6" />
          </span>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Il link resta valido per un tempo limitato. Se non arriva, controlla
            la posta indesiderata e riprova.
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
      titolo="Recupera la password"
      sottotitolo="Inserisci l'email con cui ti sei registrato: ti mandiamo un link per sceglierne una nuova."
      piede={
        <>
          Te la sei ricordata? <AuthLink href="/login">Torna all&apos;accesso</AuthLink>
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
          {pending ? "Invio in corso…" : "Invia il link"}
        </Button>
      </form>
    </AuthShell>
  );
}
