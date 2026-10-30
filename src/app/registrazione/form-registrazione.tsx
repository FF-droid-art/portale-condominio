"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, MailCheck } from "lucide-react";
import { registrati, verificaCodiceInvito, type EsitoCodiceInvito } from "./actions";
import { AuthShell, AuthLink } from "@/components/auth-shell";
import { Field, FormGrid, Input, Select } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TurnstileWidget } from "@/components/turnstile-widget";
import {
  LUNGHEZZA_CODICE_INVITO,
  codiceInvitoValido,
  formattaCodiceInvito,
  normalizzaCodiceInvito,
} from "@/lib/inviti";

/** Riscontro mostrato sotto al campo del codice. */
type Riscontro =
  | { stato: "vuoto" }
  | { stato: "incompleto" }
  | { stato: "malformato" }
  | { stato: "verifica" }
  | { stato: "valido"; unita: string; condominio: string }
  | { stato: "sconosciuto" };

/** Millisecondi di attesa prima di interrogare il server mentre si digita. */
const ATTESA_VERIFICA = 400;

export function FormRegistrazione({ codiceIniziale }: { codiceIniziale: string }) {
  const [stato, action, pending] = useActionState(registrati, undefined);
  // Se la chiave pubblica del captcha non è configurata, il widget non
  // compare: in quel caso il form resta utilizzabile senza bloccarsi in
  // attesa di una verifica che non arriverà mai (es. in sviluppo locale).
  const captchaConfigurato = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const [captchaPronto, setCaptchaPronto] = useState(!captchaConfigurato);

  // Il ruolo è uno stato e non solo un campo del form perché decide se il
  // codice di invito ha senso: un amministratore non si collega a un'unità.
  const [ruolo, setRuolo] = useState("condomino");
  const [codice, setCodice] = useState(codiceIniziale);
  // Dell'esito del server si tiene anche il codice a cui si riferisce: così
  // la risposta di un codice vecchio, arrivata in ritardo, non viene
  // attribuita a quello che si sta digitando adesso.
  const [esitoServer, setEsitoServer] = useState<{
    codice: string;
    esito: EsitoCodiceInvito;
  } | null>(null);

  const codiceNormalizzato = normalizzaCodiceInvito(codice);
  const formaValida = codiceInvitoValido(codiceNormalizzato);

  /**
   * Verifica del codice mentre si digita (e subito, quando arriva
   * precompilato dal QR).
   *
   * Prima si guarda la forma in locale — otto caratteri dell'alfabeto, vedi
   * `src/lib/inviti.ts` — e solo se è plausibile si interroga il server:
   * nessuna richiesta per ogni tasto premuto, e un errore di battitura su
   * una «O» o uno zero viene detto senza nemmeno uscire dal browser.
   *
   * La verifica passa da una server action che chiama
   * `valida_codice_invito`, funzione che restituisce solo nome del
   * condominio e identificativo dell'unità: niente su chi ci abita.
   *
   * Il riscontro da mostrare è calcolato in `riscontro` qui sotto a partire
   * dal codice e da questo esito, e non tenuto in uno stato aggiornato
   * dall'effetto: uno stato che si può derivare non va duplicato.
   */
  useEffect(() => {
    if (ruolo !== "condomino" || !formaValida) return;

    let annullato = false;
    const attesa = setTimeout(async () => {
      const esito = await verificaCodiceInvito(codiceNormalizzato);
      if (!annullato) setEsitoServer({ codice: codiceNormalizzato, esito });
    }, ATTESA_VERIFICA);

    return () => {
      annullato = true;
      clearTimeout(attesa);
    };
  }, [codiceNormalizzato, formaValida, ruolo]);

  const riscontro: Riscontro = !codiceNormalizzato
    ? { stato: "vuoto" }
    : codiceNormalizzato.length < LUNGHEZZA_CODICE_INVITO
      ? { stato: "incompleto" }
      : !formaValida
        ? { stato: "malformato" }
        : esitoServer?.codice !== codiceNormalizzato
          ? { stato: "verifica" }
          : esitoServer.esito.valido
            ? {
                stato: "valido",
                unita: esitoServer.esito.unita,
                condominio: esitoServer.esito.condominio,
              }
            : { stato: "sconosciuto" };

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
          hint={
            ruolo === "condomino"
              ? "Con il codice di invito della tua unità ti colleghi subito; senza, sarà l'amministratore a collegarti."
              : "Un amministratore non si collega a un'unità: creerà i propri condomìni dopo l'accesso."
          }
        >
          <Select
            name="ruolo"
            value={ruolo}
            onChange={(e) => setRuolo(e.target.value)}
          >
            <option value="condomino">Sono un condòmino</option>
            <option value="amministratore">Sono l&apos;amministratore di un condominio</option>
          </Select>
        </Field>

        {/* Il campo esiste solo per il condòmino: all'amministratore non
            serve, e lasciarlo visibile e disabilitato gli farebbe chiedere
            che cos'è. Smontandolo, il campo non viene nemmeno inviato. */}
        {ruolo === "condomino" && (
          <Field
            id="codice_invito"
            label="Codice invito (facoltativo)"
            hint="Lo trovi nella lettera o nel foglio dell'amministratore, nella forma ABCD-2345. Se non l'hai, lascia vuoto: potrai essere collegato più avanti."
          >
            <Input
              name="codice_invito"
              value={codice}
              // Si riformatta a ogni tasto (maiuscolo, trattino al posto
              // giusto) e si taglia a otto caratteri: così un codice
              // incollato con caratteri di troppo non resta a metà strada
              // tra le due forme.
              onChange={(e) =>
                setCodice(
                  formattaCodiceInvito(
                    normalizzaCodiceInvito(e.target.value).slice(0, LUNGHEZZA_CODICE_INVITO)
                  )
                )
              }
              // Il codice non contiene lettere minuscole né caratteri
              // ambigui: la tastiera del telefono non deve proporre il
              // correttore automatico né la prima maiuscola "intelligente".
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
              maxLength={LUNGHEZZA_CODICE_INVITO + 1}
              placeholder="ABCD-2345"
              className="cifre tracking-[0.12em] uppercase"
            />
          </Field>
        )}

        {ruolo === "condomino" && <RiscontroCodice riscontro={riscontro} />}

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

/**
 * Il riscontro sul codice: dice a quale unità si sta per collegarsi prima
 * di premere il pulsante.
 *
 * È `aria-live="polite"`: chi usa uno screen reader deve sentire il
 * risultato della verifica senza che il focus salti via dal campo mentre
 * sta ancora scrivendo.
 *
 * Un codice sbagliato non è un errore di modulo e non impedisce di
 * registrarsi (il trigger `handle_new_user` ignora i codici che non
 * esistono): per questo il messaggio è informativo e non rosso d'allarme.
 */
function RiscontroCodice({ riscontro }: { riscontro: Riscontro }) {
  return (
    <p
      aria-live="polite"
      className="flex min-h-5 items-start gap-1.5 text-xs leading-relaxed text-muted-foreground"
    >
      {riscontro.stato === "verifica" && (
        <>
          <Loader2 className="mt-px size-3.5 shrink-0 animate-spin" aria-hidden="true" />
          <span>Verifica del codice…</span>
        </>
      )}
      {riscontro.stato === "valido" && (
        <>
          <CheckCircle2 className="mt-px size-3.5 shrink-0 text-success" aria-hidden="true" />
          <span className="text-success">
            Ti colleghi a: <strong>{riscontro.condominio}</strong>, {riscontro.unita}.
          </span>
        </>
      )}
      {riscontro.stato === "sconosciuto" && (
        <span>
          Codice non trovato. Controlla di averlo ricopiato bene; puoi registrarti comunque e
          farti collegare dall&apos;amministratore.
        </span>
      )}
      {riscontro.stato === "malformato" && (
        <span>
          Questo codice contiene caratteri che non compaiono mai in un codice di invito. Le
          cifre 0 e 1 e le lettere I, L, O e U non vengono usate proprio per non confonderle.
        </span>
      )}
    </p>
  );
}
