"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarClock,
  DoorOpen,
  FileSpreadsheet,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  MessagesSquare,
  Receipt,
  ShieldCheck,
  TriangleAlert,
  Users,
  Wallet,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { logout } from "@/app/logout/actions";
import type { Utente } from "@/lib/types";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/* --------------------------------------------------------------------------
   Struttura della navigazione.

   Vive qui, dentro il componente client, e non nei layout: le icone sono
   funzioni React e non attraversano il confine server → client come prop.
   I layout passano solo l'area e qualche flag.

   Le voci sono raggruppate perché sei destinazioni in fila si leggono come
   un elenco indifferenziato, mentre due gruppi da tre si scandiscono a
   colpo d'occhio.
   -------------------------------------------------------------------------- */

export type AreaApp = "admin" | "condomino";

type VoceNav = { href: string; label: string; icon: LucideIcon };
type GruppoNav = { titolo?: string; voci: VoceNav[] };

const NAV_ADMIN: GruppoNav[] = [
  { voci: [{ href: "/admin", label: "Panoramica", icon: LayoutDashboard }] },
  {
    titolo: "Gestione",
    voci: [
      { href: "/admin/condomini", label: "Condomini", icon: Building2 },
      { href: "/admin/spese", label: "Spese", icon: Wallet },
      { href: "/admin/assemblee", label: "Assemblee", icon: CalendarClock },
      { href: "/admin/sondaggi", label: "Sondaggi", icon: MessagesSquare },
    ],
  },
  {
    titolo: "Servizi",
    voci: [
      { href: "/admin/segnalazioni", label: "Segnalazioni", icon: TriangleAlert },
      { href: "/admin/manutenzioni", label: "Fornitori e manutenzioni", icon: Wrench },
      { href: "/admin/spazi", label: "Spazi comuni", icon: DoorOpen },
      { href: "/admin/documenti", label: "Documenti", icon: FolderOpen },
    ],
  },
  {
    titolo: "Amministrazione",
    voci: [
      { href: "/admin/utenti", label: "Utenti", icon: Users },
      { href: "/admin/importa", label: "Importa dati", icon: FileSpreadsheet },
    ],
  },
];

const NAV_CONDOMINO: GruppoNav[] = [
  { voci: [{ href: "/area-riservata", label: "Riepilogo", icon: LayoutDashboard }] },
  {
    titolo: "Partecipa",
    voci: [
      { href: "/area-riservata/assemblee", label: "Assemblee", icon: CalendarClock },
      { href: "/area-riservata/sondaggi", label: "Sondaggi", icon: MessagesSquare },
    ],
  },
  {
    titolo: "Servizi",
    voci: [
      { href: "/area-riservata/segnalazioni", label: "Segnalazioni", icon: TriangleAlert },
      { href: "/area-riservata/spazi", label: "Spazi comuni", icon: DoorOpen },
      { href: "/area-riservata/documenti", label: "Documenti", icon: FolderOpen },
    ],
  },
];

/** Etichetta dell'area, mostrata sotto al marchio. */
const ETICHETTA_AREA: Record<AreaApp, string> = {
  admin: "Amministrazione",
  condomino: "Area condòmino",
};

/** Radici di area: sono attive solo con corrispondenza esatta, altrimenti
 *  resterebbero evidenziate anche nelle sottopagine. */
const RADICI = ["/admin", "/area-riservata"];

const ID_MENU_MOBILE = "menu-navigazione";

const SELETTORE_FOCUSABILI =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function isAttivo(href: string, pathname: string) {
  if (href === pathname) return true;
  if (RADICI.includes(href)) return false;
  return pathname.startsWith(`${href}/`);
}

export function AppShell({
  utente,
  area,
  /** Mostra il collegamento all'altra area (amministratore che è anche condòmino). */
  cambioArea,
  banner,
  children,
}: {
  utente: Utente;
  area: AreaApp;
  cambioArea?: boolean;
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuAperto, setMenuAperto] = useState(false);
  const pannelloMenu = useRef<HTMLDivElement>(null);

  const gruppi = area === "admin" ? NAV_ADMIN : NAV_CONDOMINO;
  const voceCambioArea: VoceNav | null = !cambioArea
    ? null
    : area === "admin"
      ? { href: "/area-riservata", label: "La mia area condòmino", icon: Receipt }
      : { href: "/admin", label: "Pannello amministratore", icon: ShieldCheck };

  // Il menu mobile è una finestra modale a tutti gli effetti: blocca lo
  // scorrimento sotto di sé, si chiude con Esc, riceve il focus all'apertura
  // e lo trattiene, altrimenti con la tastiera si finirebbe a navigare la
  // pagina nascosta dietro il velo.
  useEffect(() => {
    if (!menuAperto) return;

    const origine = document.activeElement as HTMLElement | null;
    pannelloMenu.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuAperto(false);
        return;
      }
      if (e.key !== "Tab" || !pannelloMenu.current) return;
      const focusabili = Array.from(
        pannelloMenu.current.querySelectorAll<HTMLElement>(SELETTORE_FOCUSABILI)
      );
      if (!focusabili.length) return;
      const primo = focusabili[0];
      const ultimo = focusabili[focusabili.length - 1];
      if (e.shiftKey && document.activeElement === primo) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primo.focus();
      }
    }

    const precedente = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = precedente;
      document.removeEventListener("keydown", onKeyDown);
      origine?.focus?.();
    };
  }, [menuAperto]);

  // Il menu mobile si chiude appena si sceglie una destinazione: restare
  // aperto sopra la pagina appena raggiunta è disorientante.
  const contenutoNav = (
    <Navigazione
      area={area}
      gruppi={gruppi}
      voceCambioArea={voceCambioArea}
      pathname={pathname}
      utente={utente}
      onNaviga={() => setMenuAperto(false)}
    />
  );

  return (
    <div className="guscio-app flex min-h-dvh flex-col">
      {banner}

      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Barra laterale fissa da 1024px in su. */}
        <aside className="hidden w-64 shrink-0 border-r border-border bg-surface lg:flex lg:flex-col">
          <div className="barra-laterale-fissa sticky top-0 flex h-dvh flex-col">
            {contenutoNav}
          </div>
        </aside>

        {/* Barra superiore compatta sotto i 1024px. */}
        <header className="barra-superiore-mobile sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-surface/85 px-4 backdrop-blur lg:hidden">
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={() => setMenuAperto(true)}
            aria-label="Apri il menu di navigazione"
            aria-expanded={menuAperto}
            aria-controls={ID_MENU_MOBILE}
          >
            <Menu className="size-5" />
          </Button>
          <Link href={area === "admin" ? "/admin" : "/area-riservata"} className="rounded-lg">
            <Logo />
          </Link>
          <Avatar utente={utente} />
        </header>

        {/* Pannello scorrevole del menu su schermi stretti. */}
        {menuAperto && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="anima-velo absolute inset-0 bg-navy/50 backdrop-blur-[2px]"
              onClick={() => setMenuAperto(false)}
            />
            <div
              id={ID_MENU_MOBILE}
              ref={pannelloMenu}
              tabIndex={-1}
              className="absolute inset-y-0 left-0 flex w-[17.5rem] max-w-[85vw] flex-col border-r border-border bg-surface shadow-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Menu di navigazione"
            >
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                onClick={() => setMenuAperto(false)}
                aria-label="Chiudi il menu"
                className="absolute right-3 top-3.5 z-10"
              >
                <X className="size-4" />
              </Button>
              {contenutoNav}
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function Navigazione({
  area,
  gruppi,
  voceCambioArea,
  pathname,
  utente,
  onNaviga,
}: {
  area: AreaApp;
  gruppi: GruppoNav[];
  voceCambioArea: VoceNav | null;
  pathname: string;
  utente: Utente;
  onNaviga: () => void;
}) {
  return (
    <>
      <div className="flex h-16 shrink-0 items-center px-5">
        <Link
          href={area === "admin" ? "/admin" : "/area-riservata"}
          className="rounded-lg"
          onClick={onNaviga}
        >
          <Logo />
        </Link>
      </div>

      <p className="px-5 pb-4 text-xs font-medium text-muted-foreground">{ETICHETTA_AREA[area]}</p>

      <nav
        aria-label="Sezioni principali"
        className="scorrimento-sottile flex-1 overflow-y-auto px-3 pb-4"
      >
        <div className="flex flex-col gap-6">
          {gruppi.map((gruppo, i) => (
            <div key={gruppo.titolo ?? i} className="flex flex-col gap-1">
              {gruppo.titolo && (
                <p className="px-2 pb-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground/80">
                  {gruppo.titolo}
                </p>
              )}
              {gruppo.voci.map((voce) => (
                <VoceLink
                  key={voce.href}
                  voce={voce}
                  attivo={isAttivo(voce.href, pathname)}
                  onNaviga={onNaviga}
                />
              ))}
            </div>
          ))}
        </div>
      </nav>

      <div className="shrink-0 border-t border-border p-3">
        {voceCambioArea && (
          <div className="pb-2">
            <VoceLink voce={voceCambioArea} attivo={false} onNaviga={onNaviga} />
          </div>
        )}

        <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
          <Avatar utente={utente} />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium leading-tight">
              {utente.nome} {utente.cognome}
            </span>
            <span className="truncate text-xs leading-tight text-muted-foreground">
              {utente.email}
            </span>
          </div>
          <form action={logout}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              iconOnly
              aria-label="Esci dal portale"
              title="Esci"
            >
              <LogOut className="size-4" />
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}

function VoceLink({
  voce,
  attivo,
  onNaviga,
}: {
  voce: VoceNav;
  attivo: boolean;
  onNaviga: () => void;
}) {
  const Icona = voce.icon;
  return (
    <Link
      href={voce.href}
      onClick={onNaviga}
      aria-current={attivo ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150",
        attivo
          ? "bg-accent-subtle font-semibold text-accent-ink"
          : "font-medium text-muted-foreground hover:bg-surface-muted hover:text-foreground"
      )}
    >
      {/* Indicatore verticale: lo stato attivo non è affidato al solo colore. */}
      {attivo && (
        <span
          className="absolute left-0 top-1/2 h-4.5 w-0.5 -translate-y-1/2 rounded-r-full bg-accent"
          aria-hidden="true"
        />
      )}
      <Icona className="size-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{voce.label}</span>
    </Link>
  );
}

function Avatar({ utente }: { utente: Utente }) {
  const iniziali = `${utente.nome[0] ?? ""}${utente.cognome[0] ?? ""}`.toUpperCase();
  return (
    <span
      className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-subtle text-xs font-semibold text-accent-ink"
      aria-hidden="true"
    >
      {iniziali}
    </span>
  );
}
