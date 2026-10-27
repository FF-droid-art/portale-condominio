import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { Logo } from "@/components/logo";

const PUNTI_FORZA = [
  "Spese e ripartizioni sempre aggiornate, senza aspettare il rendiconto",
  "Assemblee e votazioni online, con i millesimi calcolati",
  "Un unico archivio per condomìni, unità e proprietari",
];

/**
 * Cornice comune a tutte le pagine di autenticazione.
 *
 * Lo sfondo resta scuro in entrambi i temi: è una scelta di identità
 * deliberata, come nelle app bancarie, e serve anche a segnalare che si è
 * fuori dall'applicazione vera e propria. Da 1024px in su accanto al modulo
 * compare un pannello di presentazione, così la pagina non è un riquadro
 * solo in mezzo al vuoto; sotto quella soglia resta il solo modulo, centrato.
 */
export function AuthShell({
  titolo,
  sottotitolo,
  piede,
  children,
}: {
  titolo: string;
  sottotitolo?: React.ReactNode;
  /** Riga sotto al modulo (es. "Non hai un account? Registrati"). */
  piede?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-auth relative isolate flex min-h-dvh flex-col">
      <div className="trama-griglia pointer-events-none absolute inset-0" aria-hidden="true" />

      <header className="relative px-4 py-5 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg text-white/70 transition-colors hover:text-white"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span className="text-sm font-medium">Torna al sito</span>
        </Link>
      </header>

      <div className="relative mx-auto flex w-full max-w-5xl flex-1 items-center justify-center gap-16 px-4 py-8 sm:px-6 lg:py-16">
        {/* Pannello di presentazione: solo su schermi larghi, dove c'è spazio
            che altrimenti resterebbe vuoto. */}
        <section className="hidden max-w-sm flex-1 flex-col gap-8 lg:flex">
          <Logo inverso />
          <div className="flex flex-col gap-3">
            <h2 className="text-3xl font-semibold leading-tight tracking-tight text-balance text-white">
              Il tuo condominio, sempre a portata di mano.
            </h2>
            <p className="leading-relaxed text-white/65">
              Un solo posto per amministratori e condòmini, accessibile da
              qualsiasi dispositivo.
            </p>
          </div>
          <ul className="flex flex-col gap-3">
            {PUNTI_FORZA.map((punto) => (
              <li key={punto} className="flex items-start gap-3 text-sm leading-relaxed text-white/80">
                <span
                  className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-white/12 text-white ring-1 ring-inset ring-white/20"
                  aria-hidden="true"
                >
                  <Check className="size-3" />
                </span>
                {punto}
              </li>
            ))}
          </ul>
        </section>

        <main className="flex w-full max-w-sm flex-col gap-6">
          <div className="lg:hidden">
            <Logo inverso />
          </div>

          <div className="flex flex-col gap-6 rounded-2xl border border-border bg-surface p-6 shadow-overlay sm:p-8">
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-balance">{titolo}</h1>
              {sottotitolo && (
                <p className="text-sm leading-relaxed text-muted-foreground">{sottotitolo}</p>
              )}
            </div>
            {children}
          </div>

          {piede && <div className="text-center text-sm text-white/70">{piede}</div>}
        </main>
      </div>

      <footer className="relative px-4 py-5 text-center sm:px-6">
        <nav aria-label="Informazioni legali" className="flex justify-center gap-4 text-xs text-white/50">
          <Link href="/privacy" className="rounded hover:text-white/80">
            Privacy
          </Link>
          <Link href="/cookie" className="rounded hover:text-white/80">
            Cookie
          </Link>
        </nav>
      </footer>
    </div>
  );
}

/** Collegamento in evidenza dentro la cornice scura (piede del modulo). */
export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="rounded font-semibold text-white underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}
