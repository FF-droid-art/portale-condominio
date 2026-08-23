import Link from "next/link";
import { CondominioForm } from "./form";
import { cn } from "@/lib/cn";

export function NuovoCondominioBox() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 rounded-xl bg-surface-muted p-1">
        <span
          className={cn(
            "flex-1 rounded-lg px-3 py-1.5 text-center text-sm font-medium",
            "bg-surface shadow-sm"
          )}
        >
          Manuale
        </span>
        {/* Porta direttamente alla sezione "Importa dati" del menu in alto
            invece di aprire uno stato intermedio con un secondo bottone. */}
        <Link
          href="/admin/importa"
          className="flex-1 rounded-lg px-3 py-1.5 text-center text-sm font-medium text-muted-foreground transition-colors hover:text-accent"
        >
          Importa
        </Link>
      </div>

      <CondominioForm />
    </div>
  );
}
