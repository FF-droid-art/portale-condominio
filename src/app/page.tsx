import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Building2, CalendarClock, Wallet } from "lucide-react";
import { getUtenteCorrente } from "@/lib/supabase/dal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function Home() {
  const utente = await getUtenteCorrente();
  if (utente) {
    redirect(utente.ruolo === "amministratore" ? "/admin" : "/area-riservata");
  }

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-4">
          <span className="flex items-center gap-2 font-bold tracking-tight">
            <span className="size-2.5 rounded-full bg-accent" />
            Portale condominio
          </span>
          <div className="flex items-center gap-2">
            <Button href="/login" variant="ghost" size="sm">
              Accedi
            </Button>
            <Button href="/registrazione" size="sm">
              Registrati
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-br from-accent via-accent to-accent-2 px-4 py-24 sm:py-32 text-white">
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-6 text-center">
          <Badge variant="inverse">Novità: assemblee e votazioni online</Badge>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-balance">
            Il tuo condominio, a portata di mano.
          </h1>
          <p className="max-w-xl text-lg text-white/85 text-balance">
            Spese, unità, assemblee e votazioni: tutta la gestione condominiale
            in un solo posto, accessibile in ogni momento.
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <Button href="/registrazione" size="lg" variant="inverse">
              Registrati gratis
            </Button>
            <Button href="/login" size="lg" variant="outline-inverse">
              Accedi
            </Button>
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:py-24">
        <div className="max-w-5xl mx-auto flex flex-col gap-12">
          <div className="flex flex-col items-center gap-3 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Tutto quello che serve, in un&apos;unica app
            </h2>
            <p className="max-w-xl text-muted-foreground">
              Pensato per amministratori e condòmini, senza fogli Excel né
              email perse.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <FeatureCard
              icon={Wallet}
              title="Spese sempre chiare"
              description="Consulta ripartizioni, importi e scadenze in tempo reale, senza aspettare il rendiconto di fine anno."
            />
            <FeatureCard
              icon={CalendarClock}
              title="Assemblee e votazioni"
              description="Vota i punti all'ordine del giorno da casa, con risultati e quorum calcolati automaticamente."
            />
            <FeatureCard
              icon={Building2}
              title="Tutto organizzato"
              description="Un archivio unico per condomini, unità immobiliari e proprietari, sempre aggiornato."
            />
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-surface-muted px-4 py-20">
        <div className="max-w-2xl mx-auto flex flex-col items-center gap-5 text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Pronto a iniziare?
          </h2>
          <p className="text-muted-foreground">
            Crea un account in meno di un minuto.
          </p>
          <Button href="/registrazione" size="lg">
            Registrati gratis
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </section>

      <footer className="border-t border-border px-4 py-8">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} Portale condominio</span>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-foreground">
              Accedi
            </Link>
            <Link href="/registrazione" className="hover:text-foreground">
              Registrati
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <Card className="gap-3">
      <span className="flex size-11 items-center justify-center rounded-full bg-accent/10 text-accent">
        <Icon className="size-5" />
      </span>
      <p className="text-lg font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </Card>
  );
}
