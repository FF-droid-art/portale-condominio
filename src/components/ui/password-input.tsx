"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * Campo password con interruttore "mostra/nascondi".
 *
 * Poter rileggere quello che si è digitato riduce gli errori di battitura e
 * i tentativi di accesso falliti, e vale ancora di più su tastiera mobile.
 * L'interruttore è un vero `button` con `aria-pressed`, non un'icona muta.
 */
export function PasswordInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const [visibile, setVisibile] = useState(false);

  return (
    <span className="relative block w-full">
      <Input
        {...props}
        type={visibile ? "text" : "password"}
        spaziatura="conAzione"
        className={className}
      />
      <button
        type="button"
        onClick={() => setVisibile((v) => !v)}
        aria-pressed={visibile}
        aria-label={visibile ? "Nascondi la password" : "Mostra la password"}
        title={visibile ? "Nascondi la password" : "Mostra la password"}
        className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
      >
        {visibile ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
      </button>
    </span>
  );
}
