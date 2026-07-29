"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/logout/actions";
import type { Utente } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function NavHeader({
  utente,
  links,
}: {
  utente: Utente;
  links: { href: string; label: string }[];
}) {
  const pathname = usePathname();
  const iniziali = `${utente.nome[0] ?? ""}${utente.cognome[0] ?? ""}`.toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-4 gap-4">
        <nav className="flex items-center gap-1">
          <span className="flex items-center gap-2 pr-4 mr-2 border-r border-border font-bold tracking-tight">
            <span className="size-2.5 rounded-full bg-accent" />
            Portale condominio
          </span>
          {links.map((link) => {
            const attivo =
              link.href === pathname ||
              (link.href !== "/admin" &&
                link.href !== "/area-riservata" &&
                pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm transition-colors hover:bg-surface-muted",
                  attivo
                    ? "bg-surface-muted font-medium text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="flex size-7 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
              {iniziali}
            </span>
            <span className="hidden sm:inline text-muted-foreground">
              {utente.nome} {utente.cognome}
            </span>
          </div>
          <form action={logout}>
            <Button variant="ghost" size="sm" type="submit">
              Esci
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
