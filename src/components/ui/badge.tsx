import { cn } from "@/lib/cn";

type VarianteBadge = "neutral" | "accent" | "success" | "danger" | "warning" | "outline" | "inverse";

const variantClass: Record<VarianteBadge, string> = {
  neutral: "bg-neutral-bg text-muted-foreground",
  accent: "bg-accent-subtle text-accent-ink",
  success: "bg-success-bg text-success",
  danger: "bg-danger-bg text-danger",
  warning: "bg-warning-bg text-warning",
  outline: "border border-border-strong text-muted-foreground",
  // Per sfondi scuri o colorati (hero, pagine di autenticazione).
  inverse: "bg-white/12 text-white ring-1 ring-inset ring-white/20",
};

const puntoClass: Record<VarianteBadge, string> = {
  neutral: "bg-muted-foreground",
  accent: "bg-accent",
  success: "bg-success",
  danger: "bg-danger",
  warning: "bg-warning",
  outline: "bg-muted-foreground",
  inverse: "bg-white",
};

export function Badge({
  variant = "neutral",
  punto,
  className,
  children,
  ...props
}: {
  variant?: VarianteBadge;
  /** Pallino colorato davanti all'etichetta: lo stato resta leggibile anche
   *  per chi non distingue le tinte, perché non è affidato al solo colore. */
  punto?: boolean;
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
        variantClass[variant],
        className
      )}
      {...props}
    >
      {punto && (
        <span className={cn("size-1.5 shrink-0 rounded-full", puntoClass[variant])} aria-hidden="true" />
      )}
      {children}
    </span>
  );
}

const MAPPE_STATO: Record<string, Record<string, { label: string; variant: VarianteBadge }>> = {
  stato_pagamento: {
    da_pagare: { label: "Da pagare", variant: "warning" },
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
  stato_segnalazione: {
    aperta: { label: "Aperta", variant: "warning" },
    in_corso: { label: "In corso", variant: "accent" },
    chiusa: { label: "Chiusa", variant: "success" },
  },
  priorita_segnalazione: {
    bassa: { label: "Priorità bassa", variant: "neutral" },
    normale: { label: "Priorità normale", variant: "outline" },
    alta: { label: "Priorità alta", variant: "danger" },
  },
  stato_manutenzione: {
    programmata: { label: "Programmata", variant: "accent" },
    completata: { label: "Completata", variant: "success" },
    annullata: { label: "Annullata", variant: "neutral" },
  },
  urgenza_scadenza: {
    scaduta: { label: "Scaduta", variant: "danger" },
    in_scadenza: { label: "In scadenza", variant: "warning" },
    futura: { label: "In programma", variant: "neutral" },
  },
  stato_prenotazione: {
    confermata: { label: "Confermata", variant: "success" },
    annullata: { label: "Annullata", variant: "neutral" },
  },
  livello_sollecito: {
    "1": { label: "Primo sollecito", variant: "neutral" },
    "2": { label: "Sollecito", variant: "warning" },
    "3": { label: "Diffida", variant: "danger" },
  },
  stato_movimento: {
    da_abbinare: { label: "Da abbinare", variant: "warning" },
    abbinato: { label: "Abbinato", variant: "success" },
    ignorato: { label: "Ignorato", variant: "neutral" },
  },
  confidenza_abbinamento: {
    alta: { label: "Corrispondenza certa", variant: "success" },
    media: { label: "Da verificare", variant: "warning" },
  },
  tipo_evento_calendario: {
    assemblea: { label: "Assemblea", variant: "accent" },
    manutenzione: { label: "Manutenzione", variant: "neutral" },
    prenotazione: { label: "Prenotazione", variant: "outline" },
    scadenza_pagamento: { label: "Scadenza", variant: "warning" },
  },
  tipo_soggetto: {
    proprietario: { label: "Proprietario", variant: "neutral" },
    nudo_proprietario: { label: "Nudo proprietario", variant: "neutral" },
    usufruttuario: { label: "Usufruttuario", variant: "accent" },
    conduttore: { label: "Conduttore", variant: "warning" },
    comodatario: { label: "Comodatario", variant: "warning" },
    assegnatario: { label: "Assegnatario", variant: "warning" },
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
  if (!voce) {
    return (
      <Badge punto className={className}>
        {valore}
      </Badge>
    );
  }
  return (
    <Badge variant={voce.variant} punto className={className}>
      {voce.label}
    </Badge>
  );
}
