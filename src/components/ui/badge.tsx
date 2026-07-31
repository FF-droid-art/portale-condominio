import { cn } from "@/lib/cn";

type VarianteBadge = "neutral" | "accent" | "success" | "danger" | "warning" | "inverse";

const variantClass: Record<VarianteBadge, string> = {
  neutral: "bg-neutral-bg text-muted-foreground",
  accent: "bg-accent/10 text-accent",
  success: "bg-success-bg text-success",
  danger: "bg-danger-bg text-danger",
  warning: "bg-warning-bg text-warning",
  // Per badge su sfondi colorati/scuri (es. hero).
  inverse: "bg-white/15 text-white",
};

export function Badge({
  variant = "neutral",
  className,
  ...props
}: { variant?: VarianteBadge } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        variantClass[variant],
        className
      )}
      {...props}
    />
  );
}

const MAPPE_STATO: Record<string, Record<string, { label: string; variant: VarianteBadge }>> = {
  stato_pagamento: {
    da_pagare: { label: "Da pagare", variant: "neutral" },
    pagato: { label: "Pagato", variant: "success" },
    in_ritardo: { label: "In ritardo", variant: "danger" },
  },
  stato_assemblea: {
    convocata: { label: "Convocata", variant: "neutral" },
    in_corso: { label: "In corso", variant: "accent" },
    conclusa: { label: "Conclusa", variant: "success" },
  },
  stato_votazione: {
    aperta: { label: "Votazione aperta", variant: "accent" },
    chiusa: { label: "Votazione chiusa", variant: "neutral" },
  },
  esito: {
    approvato: { label: "Approvato", variant: "success" },
    respinto: { label: "Respinto", variant: "danger" },
  },
  ruolo: {
    amministratore: { label: "Amministratore", variant: "accent" },
    condomino: { label: "Condòmino", variant: "neutral" },
  },
  tipo_soggetto: {
    proprietario: { label: "Proprietario", variant: "neutral" },
    nudo_proprietario: { label: "Nudo proprietario", variant: "neutral" },
    usufruttuario: { label: "Usufruttuario", variant: "accent" },
    conduttore: { label: "Conduttore", variant: "warning" },
    comodatario: { label: "Comodatario", variant: "warning" },
  },
};

export function StatoBadge({
  tipo,
  valore,
  className,
}: {
  tipo: keyof typeof MAPPE_STATO;
  valore: string | null | undefined;
  className?: string;
}) {
  if (!valore) return null;
  const voce = MAPPE_STATO[tipo]?.[valore];
  if (!voce) return <Badge className={className}>{valore}</Badge>;
  return (
    <Badge variant={voce.variant} className={className}>
      {voce.label}
    </Badge>
  );
}
