import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  CreditCard,
  FileSpreadsheet,
  Mail,
  Users,
  Wallet,
} from "lucide-react";
import { getUtenteCorrente } from "@/lib/supabase/dal";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function Home() {
  const utente = await getUtenteCorrente();
  if (utente) {
    redirect(utente.ruolo === "amministratore" ? "/admin" : "/area-riservata");
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* SITO-03: dato strutturato schema.org, così un motore di ricerca
          capisce di cosa si tratta senza doverlo indovinare dal testo.
          Children testuale (non dangerouslySetInnerHTML): React scrive il
          contenuto come textContent del tag, in sicurezza, e qui il JSON è
          comunque statico — nessun dato proveniente dall'utente. */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Portale Condominio",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          description:
            "Gestione condominiale online: spese e ripartizioni, unità immobiliari, assemblee e votazioni telematiche.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
        })}
      </script>

      {/* ---------------------------------------------------------------
          Apertura scura: intestazione e hero condividono lo stesso blocco
          navy, così il passaggio al contenuto chiaro segna con chiarezza
          la fine della presentazione e l'inizio dei contenuti.
          --------------------------------------------------------------- */}
      <div className="bg-auth relative isolate text-white">
        <div className="trama-griglia pointer-events-none absolute inset-0" aria-hidden="true" />

        <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <Link href="/" className="rounded-lg">
            <Logo inverso />
          </Link>
          <nav aria-label="Accesso" className="flex items-center gap-2">
            <Button href="/login" variant="outline-inverse" size="sm">
              Accedi
            </Button>
            <Button href="/registrazione" variant="inverse" size="sm">
              Registrati
            </Button>
          </nav>
        </header>

        <section className="relative mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-4 pb-24 pt-16 text-center sm:px-6 sm:pb-32 sm:pt-24">
          <Badge variant="inverse">Assemblee e votazioni online, con i millesimi</Badge>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            La gestione del condominio, finalmente in chiaro.
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-pretty text-white/75">
            Spese, ripartizioni, unità immobiliari, assemblee e votazioni in un
            unico posto. L&apos;amministratore lavora più in fretta, il condòmino
            vede sempre a che punto sono le sue quote.
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <Button href="/registrazione" size="lg" variant="inverse">
              Inizia gratis
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
            <Button href="/login" size="lg" variant="outline-inverse">
              Ho già un account
            </Button>
          </div>
          <p className="text-sm text-white/55">
            Nessuna installazione: si accede dal browser, anche dal telefono.
          </p>
        </section>
      </div>

      {/* --------------------------------------------------------------- */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Due ruoli, un solo portale
          </h2>
          <p className="text-pretty leading-relaxed text-muted-foreground">
            Ognuno vede quello che gli serve, senza chiedere nulla all&apos;altro.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <SchedaRuolo
            icon={Building2}
            titolo="Per l'amministratore"
            descrizione="Il registro di tutti i condomìni che gestisci, senza fogli di calcolo sparsi."
            voci={[
              "Anagrafica di condomìni, unità e occupanti (proprietari, usufruttuari, conduttori)",
              "Spese ripartite in automatico sui millesimi o su una tabella millesimale",
              "Assemblee con ordine del giorno, votazioni ed esiti calcolati",
              "Importazione da Excel o CSV dei dati che hai già",
            ]}
          />
          <SchedaRuolo
            icon={Users}
            titolo="Per il condòmino"
            descrizione="Quello che vuoi sapere sul tuo appartamento, senza dover telefonare."
            voci={[
              "Le tue unità, i tuoi millesimi e la tua quota di possesso",
              "Le spese a tuo carico con importi, scadenze e stato del pagamento",
              "Pagamento online della quota con carta",
              "Voto in assemblea da casa, anche delegando un altro condòmino",
            ]}
          />
        </div>
      </section>

      {/* --------------------------------------------------------------- */}
      <section className="border-y border-border bg-surface-muted/50">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Tutto quello che serve durante l&apos;anno
            </h2>
            <p className="text-pretty leading-relaxed text-muted-foreground">
              Dalla prima nota di spesa al verbale dell&apos;assemblea.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SchedaFunzione
              icon={Wallet}
              titolo="Spese e ripartizioni"
              descrizione="Registri la spesa una volta sola: la quota di ogni unità viene calcolata sui millesimi, con scadenza e stato del pagamento."
            />
            <SchedaFunzione
              icon={CalendarClock}
              titolo="Assemblee e votazioni"
              descrizione="Punti all'ordine del giorno, votazione aperta e chiusa dall'amministratore, esito e quorum espressi in millesimi."
            />
            <SchedaFunzione
              icon={Users}
              titolo="Deleghe"
              descrizione="Chi non può partecipare delega il voto della propria unità a un altro condòmino, e può revocare la delega quando vuole."
            />
            <SchedaFunzione
              icon={CreditCard}
              titolo="Pagamenti online"
              descrizione="Il condòmino salda la quota con carta direttamente dal portale; lo stato del pagamento si aggiorna da solo."
            />
            <SchedaFunzione
              icon={FileSpreadsheet}
              titolo="Importazione dei dati"
              descrizione="Carichi i file .xlsx o .csv che usi già, abbini le colonne e controlli l'anteprima prima di confermare."
            />
            <SchedaFunzione
              icon={Mail}
              titolo="Avvisi ai condòmini"
              descrizione="Un messaggio a tutti i soggetti di un condominio, con i loro indirizzi già pronti."
            />
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------- */}
      <section className="mx-auto w-full max-w-4xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Si parte in tre passi
          </h2>
        </div>

        <ol className="mt-12 grid gap-8 sm:grid-cols-3">
          <Passo
            numero={1}
            titolo="Crea l'account"
            descrizione="Ti registri come amministratore o come condòmino: il portale ti porta nell'area giusta."
          />
          <Passo
            numero={2}
            titolo="Porta dentro i dati"
            descrizione="Inserisci i condomìni a mano oppure importa in blocco unità e spese storiche da un file."
          />
          <Passo
            numero={3}
            titolo="Invita i condòmini"
            descrizione="Ognuno accede con il proprio account e trova le sue unità, le sue quote e le sue assemblee."
          />
        </ol>
      </section>

      {/* --------------------------------------------------------------- */}
      <section className="border-t border-border bg-surface-muted/50">
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-5 px-4 py-20 text-center sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight text-balance">
            Pronto a mettere ordine?
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            Crei un account in meno di un minuto e puoi provare il portale con un
            condominio di esempio.
          </p>
          <Button href="/registrazione" size="lg">
            Registrati gratis
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex max-w-xs flex-col gap-3">
              <Logo />
              <p className="text-sm leading-relaxed text-muted-foreground">
                Gestione condominiale online per amministratori e condòmini.
              </p>
            </div>
            <nav aria-label="Collegamenti" className="flex flex-col gap-2 text-sm">
              <p className="font-semibold">Accesso</p>
              <Link href="/login" className="rounded text-muted-foreground hover:text-foreground">
                Accedi
              </Link>
              <Link
                href="/registrazione"
                className="rounded text-muted-foreground hover:text-foreground"
              >
                Registrati
              </Link>
              <Link
                href="/recupera-password"
                className="rounded text-muted-foreground hover:text-foreground"
              >
                Password dimenticata
              </Link>
            </nav>
            <nav aria-label="Informazioni legali" className="flex flex-col gap-2 text-sm">
              <p className="font-semibold">Legale</p>
              <Link href="/privacy" className="rounded text-muted-foreground hover:text-foreground">
                Privacy
              </Link>
              <Link href="/cookie" className="rounded text-muted-foreground hover:text-foreground">
                Cookie
              </Link>
            </nav>
          </div>
          <p className="border-t border-border pt-6 text-sm text-muted-foreground">
            © {new Date().getFullYear()} Portale Condominio
          </p>
        </div>
      </footer>
    </div>
  );
}

function SchedaRuolo({
  icon: Icon,
  titolo,
  descrizione,
  voci,
}: {
  icon: React.ComponentType<{ className?: string }>;
  titolo: string;
  descrizione: string;
  voci: string[];
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-8">
      <span
        className="grid size-11 place-items-center rounded-xl bg-accent-subtle text-accent-ink"
        aria-hidden="true"
      >
        <Icon className="size-5" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h3 className="text-xl font-semibold tracking-tight">{titolo}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{descrizione}</p>
      </div>
      <ul className="flex flex-col gap-2.5 text-sm">
        {voci.map((voce) => (
          <li key={voce} className="flex items-start gap-2.5 leading-relaxed">
            <span
              className="mt-2 size-1.5 shrink-0 rounded-full bg-accent"
              aria-hidden="true"
            />
            {voce}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SchedaFunzione({
  icon: Icon,
  titolo,
  descrizione,
}: {
  icon: React.ComponentType<{ className?: string }>;
  titolo: string;
  descrizione: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-6">
      <span
        className="grid size-9 place-items-center rounded-lg bg-surface-muted text-muted-foreground"
        aria-hidden="true"
      >
        <Icon className="size-4.5" />
      </span>
      <h3 className="font-semibold tracking-tight">{titolo}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{descrizione}</p>
    </div>
  );
}

function Passo({
  numero,
  titolo,
  descrizione,
}: {
  numero: number;
  titolo: string;
  descrizione: string;
}) {
  return (
    <li className="flex flex-col gap-2.5">
      <span className="grid size-8 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
        {numero}
      </span>
      <h3 className="font-semibold tracking-tight">{titolo}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{descrizione}</p>
    </li>
  );
}
