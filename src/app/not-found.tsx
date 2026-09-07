import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Pagina non trovata" };

export default function NonTrovata() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <span
          className="grid size-12 place-items-center rounded-2xl bg-surface-muted text-muted-foreground"
          aria-hidden="true"
        >
          <Compass className="size-6" />
        </span>

        <div className="flex flex-col gap-2">
          <p className="cifre text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Errore 404
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Pagina non trovata</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            L&apos;indirizzo non esiste, oppure il contenuto che cercavi è stato rimosso o non è
            più accessibile con il tuo account.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button href="/">Torna alla home</Button>
          <Button href="/area-riservata" variant="secondary">
            Vai alla tua area
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Se pensi che si tratti di un errore,{" "}
          <Link href="/login" className="rounded font-medium text-accent-ink hover:underline">
            prova ad accedere di nuovo
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
