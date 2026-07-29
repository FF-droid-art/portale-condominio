"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Field, Input, Label } from "@/components/ui/input";
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

    const { data: listener } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "PASSWORD_RECOVERY") setPronto(true);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setPronto(true);
    });

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
      <div className="bg-auth flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-sm rounded-3xl text-center flex flex-col gap-4">
          <h1 className="text-3xl font-bold tracking-tight">Password aggiornata</h1>
          <p className="text-sm text-muted-foreground">Ti reindirizziamo al login…</p>
        </Card>
      </div>
    );
  }

  if (!pronto && scaduto) {
    return (
      <div className="bg-auth flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-sm rounded-3xl text-center flex flex-col gap-4">
          <h1 className="text-3xl font-bold tracking-tight">Link non valido</h1>
          <p className="text-sm text-muted-foreground">
            Il link è scaduto o non è valido. Richiedine uno nuovo.
          </p>
          <Link href="/recupera-password" className="font-medium text-accent">
            Richiedi un nuovo link
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-auth flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm rounded-3xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold tracking-tight">Scegli una nuova password</h1>

          <Field>
            <Label htmlFor="password">Nuova password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!pronto}
            />
          </Field>

          <Field>
            <Label htmlFor="conferma">Conferma password</Label>
            <Input
              id="conferma"
              type="password"
              required
              minLength={8}
              value={conferma}
              onChange={(e) => setConferma(e.target.value)}
              disabled={!pronto}
            />
          </Field>

          {errore && <p className="text-sm text-danger">{errore}</p>}

          <Button type="submit" pending={pending} disabled={!pronto} className="mt-2 w-full">
            {pronto ? (pending ? "Salvataggio…" : "Salva nuova password") : "Verifica link in corso…"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
