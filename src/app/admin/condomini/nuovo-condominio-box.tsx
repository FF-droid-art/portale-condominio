"use client";

import { useState } from "react";
import { CondominioForm } from "./form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function NuovoCondominioBox() {
  const [modo, setModo] = useState<"manuale" | "importa">("manuale");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 rounded-xl bg-surface-muted p-1">
        {(
          [
            { chiave: "manuale", etichetta: "Manuale" },
            { chiave: "importa", etichetta: "Importa" },
          ] as const
        ).map((opzione) => (
          <button
            key={opzione.chiave}
            type="button"
            onClick={() => setModo(opzione.chiave)}
            className={cn(
              "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              modo === opzione.chiave
                ? "bg-surface shadow-sm"
                : "text-muted-foreground hover:text-accent"
            )}
          >
            {opzione.etichetta}
          </button>
        ))}
      </div>

      {modo === "manuale" ? (
        <CondominioForm />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Importa condomìni, unità, persone e millesimi da un file Excel o CSV.
          </p>
          <Button href="/admin/importa/condomini-unita">Vai a Importa dati</Button>
        </div>
      )}
    </div>
  );
}
