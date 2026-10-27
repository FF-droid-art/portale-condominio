"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

// Piccolo wrapper attorno al widget Cloudflare Turnstile, usato per
// proteggere i form pubblici (oggi: /registrazione) dalla creazione
// automatizzata di account. Se non è configurata nessuna chiave pubblica
// (NEXT_PUBLIC_TURNSTILE_SITE_KEY), il componente non renderizza nulla e il
// form resta utilizzabile senza captcha: evita di bloccare l'ambiente di
// sviluppo locale finché la chiave non è impostata.

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: Record<string, unknown>
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export function TurnstileWidget({
  onChange,
}: {
  onChange?: (pronto: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [scriptPronto, setScriptPronto] = useState(false);

  useEffect(() => {
    if (!scriptPronto || !containerRef.current || !window.turnstile) return;

    widgetId.current = window.turnstile.render(containerRef.current, {
      sitekey: SITE_KEY,
      callback: () => onChange?.(true),
      "expired-callback": () => onChange?.(false),
      "error-callback": () => onChange?.(false),
    });

    return () => {
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptPronto]);

  if (!SITE_KEY) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        async
        defer
        onReady={() => setScriptPronto(true)}
      />
      <div ref={containerRef} />
    </>
  );
}
