"use client";

import { useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { aggiungiSoggetto } from "./actions";
import { haQuota } from "@/lib/ruoli";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, FormGrid, Input, Select, Textarea } from "@/components/ui/input";
import { Alert, FormError } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const OPZIONI_TIPO_SOGGETTO: { value: string; label: string }[] = [
  { value: "proprietario", label: "Proprietario" },
  { value: "nudo_proprietario", label: "Nudo proprietario" },
  { value: "usufruttuario", label: "Usufruttuario" },
  { value: "conduttore", label: "Conduttore" },
  { value: "comodatario", label: "Comodatario" },
  { value: "assegnatario", label: "Assegnatario" },
];

type Esistente = { id: string; nominativo: string; email: string | null };

/**
 * Aggiunta di un soggetto (proprietario, usufruttuario, inquilino…) a
 * un'unità.
 *
 * Quando la server action segnala che in quel condominio esiste già una
 * persona simile, il passo di conferma prende il posto del modulo dentro la
 * stessa finestra invece di aprirne una seconda sopra: una sola cosa alla
 * volta a cui rispondere, senza perdere quello che si era digitato.
 */
export function ProprietarioForm({
  unitaId,
  condominioId,
}: {
  unitaId: string;
  condominioId: string;
}) {
  const [aperto, setAperto] = useState(false);
  const [nominativo, setNominativo] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [codiceFiscale, setCodiceFiscale] = useState("");
  const [residenza, setResidenza] = useState("");
  const [tipoSoggetto, setTipoSoggetto] = useState("proprietario");
  const [quota, setQuota] = useState("100");
  const [dirittoVoto, setDirittoVoto] = useState(true);

  const [errore, setErrore] = useState<string | null>(null);
  const [conferma, setConferma] = useState<Esistente | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setNominativo("");
    setEmail("");
    setTelefono("");
    setCodiceFiscale("");
    setResidenza("");
    setTipoSoggetto("proprietario");
    setQuota("100");
    setDirittoVoto(true);
  }

  function apri() {
    setErrore(null);
    setConferma(null);
    setAperto(true);
  }

  function invia(opts: { riusaId?: string; forzaNuovo?: boolean }) {
    setErrore(null);
    startTransition(async () => {
      const res = await aggiungiSoggetto({
        unitaId,
        condominioId,
        nominativo,
        email,
        telefono: telefono.trim() || null,
        codiceFiscale: codiceFiscale.trim() || null,
        residenzaDomicilio: residenza.trim() || null,
        tipoSoggetto,
        quota: Number(quota),
        dirittoVoto,
        riusaId: opts.riusaId,
        forzaNuovo: opts.forzaNuovo,
      });

      if ("needsConfirm" in res) {
        setConferma(res.esistente);
        return;
      }
      if ("errore" in res) {
        setErrore(res.errore);
        setConferma(null);
        return;
      }
      // successo
      setConferma(null);
      reset();
      setAperto(false);
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={apri}>
        <UserPlus className="size-4" aria-hidden="true" />
        Aggiungi soggetto
      </Button>

      <Dialog
        aperto={aperto}
        onChiudi={() => setAperto(false)}
        bloccato={pending}
        titolo={conferma ? "È la stessa persona?" : "Aggiungi un soggetto"}
        descrizione={
          conferma
            ? undefined
            : "Il soggetto viene creato in anagrafica del condominio e collegato a questa unità."
        }
        larghezza="md"
      >
        {conferma ? (
          <div className="flex flex-col gap-5">
            <Alert tono="warning" titolo="Esiste già una persona simile in questo condominio">
              <strong className="font-semibold">{conferma.nominativo}</strong>
              {conferma.email ? ` (${conferma.email})` : ""} è già in anagrafica. Se è la stessa
              persona conviene riutilizzarla, così i contatti restano uno solo.
            </Alert>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() => invia({ forzaNuovo: true })}
              >
                No, è un&apos;altra persona
              </Button>
              <Button pending={pending} onClick={() => invia({ riusaId: conferma.id })}>
                Sì, è la stessa
              </Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              invia({});
            }}
            className="flex flex-col gap-4"
          >
            <Field id="nominativo" label="Nome o denominazione" required>
              <Input
                value={nominativo}
                onChange={(e) => setNominativo(e.target.value)}
                placeholder="Es. Mario Rossi"
                required
              />
            </Field>

            <FormGrid colonne={2}>
              <Field id="email" label="Email" required>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="nome@esempio.it"
                  required
                />
              </Field>
              <Field id="telefono" label="Telefono" hint="Facoltativo.">
                <Input
                  type="tel"
                  inputMode="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                />
              </Field>
            </FormGrid>

            {/* Codice fiscale e residenza sono richiesti dall'art. 1130,
                n. 6, c.c. per il registro di anagrafe, ma restano
                facoltativi qui: spesso si collega la persona all'unità
                prima di avere i suoi dati completi, e si aggiungono poi
                dalla riga del soggetto. */}
            <Field
              id="soggetto_codice_fiscale"
              label="Codice fiscale"
              hint="Facoltativo, per il registro di anagrafe. 16 caratteri, o 11 cifre per una società."
            >
              <Input
                value={codiceFiscale}
                onChange={(e) => setCodiceFiscale(e.target.value.toUpperCase())}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={16}
                placeholder="RSSMRA80A01H501U"
                className="cifre"
              />
            </Field>

            <Field
              id="soggetto_residenza"
              label="Residenza o domicilio"
              hint="Facoltativa. Via, numero civico, CAP, comune e provincia."
            >
              <Textarea
                rows={2}
                value={residenza}
                onChange={(e) => setResidenza(e.target.value)}
                placeholder="Via Roma 1, 00100 Roma (RM)"
              />
            </Field>

            <Field
              id="tipo_soggetto"
              label="Ruolo sull'unità"
              hint="Determina se la persona concorre alla quota di possesso."
            >
              <Select value={tipoSoggetto} onChange={(e) => setTipoSoggetto(e.target.value)}>
                {OPZIONI_TIPO_SOGGETTO.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>

            {haQuota(tipoSoggetto) && (
              <Field
                id="quota_possesso"
                label="Quota di possesso (%)"
                required
                hint="100% se è l'unico titolare; in caso di comproprietà, la sua parte."
              >
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="100"
                  inputMode="decimal"
                  value={quota}
                  onChange={(e) => setQuota(e.target.value)}
                  className="cifre"
                  required
                />
              </Field>
            )}

            <label className="flex items-start gap-2.5 rounded-xl border border-border p-3.5 text-sm">
              <Checkbox
                checked={dirittoVoto}
                onChange={(e) => setDirittoVoto(e.target.checked)}
                className="mt-0.5"
              />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">Ha diritto di voto in assemblea</span>
                <span className="text-xs text-muted-foreground">
                  Di norma spetta al proprietario; per le unità locate può spettare al conduttore
                  su alcune materie.
                </span>
              </span>
            </label>

            <FormError>{errore}</FormError>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => setAperto(false)}
              >
                Annulla
              </Button>
              <Button type="submit" pending={pending}>
                {pending ? "Salvataggio…" : "Aggiungi soggetto"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}
