"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LinkIcon, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AuthShell, AuthLink } from "@/components/auth-shell";
import { Field } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function ReimpostaPasswordPage() {
  const router = useRouter();
  const [pronto, setPronto] = useState(false);
  const [scaduto, setScaduto] = useState(false);
  const [password, setPassword] = useState("");
  const [conferma, setConferma] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [fatto, setFatto] = useState(false);

  // Il link nell'email porta i token di recupero nel frammento dell'URL
  // (#access_token=...), che il browser non invia mai al server: solo il
  // client Supabase lato browser può leggerli e aprire la sessione di
  // recupero, quindi qui non si può usare una server action.
  const prontoRef = useRef(pronto);
  useEffect(() => {
    prontoRef.current = pronto;
  }, [pronto]);

  useEffect(() => {
    const supabase = createClient();

    // Il link di recupero porta nel frammento dell'URL "type=recovery": è
    // la prova che questo caricamento di pagina sta davvero elaborando un
    // token appena arrivato dall'email. Senza questo controllo, una
    // sessione qualsiasi già presente nel browser (es. un altro account
    // rimasto loggato su questo dispositivo) verrebbe scambiata per la
    // sessione di recupero, mostrando il modulo per un account che non è
    // quello per cui è stato chiesto il reset.
    const eRecuperoDaUrl = window.location.hash.includes("type=recovery");

    const { data: listener } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "PASSWORD_RECOVERY") setPronto(true);
    });

    if (eRecuperoDaUrl) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) setPronto(true);
      });
    }

    const timeout = setTimeout(() => {
      if (!prontoRef.current) setScaduto(true);
    }, 4000);

    return () => {
      listener.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);

    if (password.length < 8) {
      setErrore("La password deve avere almeno 8 caratteri.");
      return;
    }
    if (password !== conferma) {
      setErrore("Le due password non coincidono.");
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setPending(false);

    if (error) {
      setErrore(error.message);
      return;
    }
    setFatto(true);
    setTimeout(() => router.push("/login"), 2000);
  }

  if (fatto) {
    return (
      <AuthShell
        titolo="Password aggiornata"
        sottotitolo="Da ora puoi accedere con la nuova password."
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <span
            className="grid size-12 place-items-center rounded-2xl bg-success-bg text-success"
            aria-hidden="true"
          >
            <CheckCircle2 className="size-6" />
          </span>
          <p
            role="status"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            Ti riportiamo all&apos;accesso…
          </p>
        </div>
      </AuthShell>
    );
  }

  if (!pronto && scaduto) {
    return (
      <AuthShell
        titolo="Link non valido"
        sottotitolo="Il link è scaduto oppure è già stato usato. Richiedine uno nuovo: ne bastano pochi secondi."
        piede={
          <>
            Ti sei ricordato la password? <AuthLink href="/login">Accedi</AuthLink>
          </>
        }
      >
        <div className="flex flex-col items-center gap-5 text-center">
          <span
            className="grid size-12 place-items-center rounded-2xl bg-warning-bg text-warning"
            aria-hidden="true"
          >
            <LinkIcon className="size-6" />
          </span>
          <Button href="/recupera-password" full>
            Richiedi un nuovo link
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      titolo="Scegli una nuova password"
      sottotitolo={
        pronto
          ? "Deve avere almeno 8 caratteri. Scrivila due volte per sicurezza."
          : "Stiamo verificando il link ricevuto per email…"
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field id="password" label="Nuova password" required hint="Almeno 8 caratteri.">
          <PasswordInput
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={!pronto}
          />
        </Field>

        <Field id="conferma" label="Conferma password" required>
          <PasswordInput
            name="conferma"
            autoComplete="new-password"
            required
            minLength={8}
            value={conferma}
            onChange={(e) => setConferma(e.target.value)}
            disabled={!pronto}
          />
        </Field>

        <FormError>{errore}</FormError>

        <Button type="submit" pending={pending} disabled={!pronto} full size="lg" className="mt-1">
          {pronto
            ? pending
              ? "Salvataggio…"
              : "Salva la nuova password"
            : "Verifica del link in corso…"}
        </Button>
      </form>
    </AuthShell>
  );
}
