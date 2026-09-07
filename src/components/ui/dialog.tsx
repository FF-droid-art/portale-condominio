"use client";

import { useCallback, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

const SELETTORE_FOCUSABILI =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Larghezza = "sm" | "md" | "lg";

const larghezzaClass: Record<Larghezza, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

/**
 * Finestra modale accessibile, usata per la creazione e la modifica dei
 * dati e per le conferme distruttive.
 *
 * Fa quello che una finestra modale deve fare e che un semplice `div`
 * sovrapposto non fa: dichiara il proprio ruolo e il proprio titolo alle
 * tecnologie assistive, sposta il focus al suo interno all'apertura e lo
 * riporta al pulsante che l'ha aperta alla chiusura, trattiene il Tab, si
 * chiude con Esc e blocca lo scorrimento della pagina sottostante.
 */
export function Dialog({
  aperto,
  onChiudi,
  titolo,
  descrizione,
  larghezza = "sm",
  bloccato,
  footer,
  children,
}: {
  aperto: boolean;
  onChiudi: () => void;
  titolo: React.ReactNode;
  descrizione?: React.ReactNode;
  larghezza?: Larghezza;
  /** Impedisce la chiusura con Esc o cliccando fuori (es. operazione in corso). */
  bloccato?: boolean;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const idTitolo = useId();
  const idDescrizione = useId();
  const pannello = useRef<HTMLDivElement>(null);
  const origine = useRef<HTMLElement | null>(null);

  const chiudi = useCallback(() => {
    if (!bloccato) onChiudi();
  }, [bloccato, onChiudi]);

  // Focus all'apertura, ripristino alla chiusura.
  useEffect(() => {
    if (!aperto) return;
    origine.current = document.activeElement as HTMLElement | null;
    const primo = pannello.current?.querySelector<HTMLElement>(SELETTORE_FOCUSABILI);
    (primo ?? pannello.current)?.focus();
    return () => origine.current?.focus?.();
  }, [aperto]);

  // Esc per chiudere, Tab trattenuto dentro il pannello.
  useEffect(() => {
    if (!aperto) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        chiudi();
        return;
      }
      if (e.key !== "Tab" || !pannello.current) return;
      const focusabili = Array.from(
        pannello.current.querySelectorAll<HTMLElement>(SELETTORE_FOCUSABILI)
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
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
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [aperto, chiudi]);

  // Blocca lo scorrimento della pagina mentre la modale è aperta.
  useEffect(() => {
    if (!aperto) return;
    const precedente = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = precedente;
    };
  }, [aperto]);

  // Le finestre modali partono sempre chiuse, quindi sul server non c'è mai
  // nulla da rendere: il controllo su `document` evita di dover tenere uno
  // stato "montato" solo per poter usare il portale.
  if (!aperto || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="anima-velo fixed inset-0 z-50 flex items-end justify-center bg-navy/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) chiudi();
      }}
    >
      <div
        ref={pannello}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitolo}
        aria-describedby={descrizione ? idDescrizione : undefined}
        tabIndex={-1}
        className={cn(
          "anima-pannello flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-border bg-surface shadow-overlay sm:rounded-2xl",
          larghezzaClass[larghezza]
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id={idTitolo} className="text-base font-semibold tracking-tight">
              {titolo}
            </h2>
            {descrizione && (
              <p id={idDescrizione} className="text-sm leading-relaxed text-muted-foreground">
                {descrizione}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={chiudi}
            disabled={bloccato}
            aria-label="Chiudi"
            className="-mr-1.5 -mt-0.5"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="scorrimento-sottile flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
