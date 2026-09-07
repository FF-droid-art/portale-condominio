"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function ErroreAdmin({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <ErrorState
      descrizione="Non siamo riusciti a caricare questa sezione del pannello. Spesso è un problema temporaneo: riprova fra un istante."
      digest={error.digest}
      onRiprova={() => unstable_retry()}
      tornaA={{ href: "/admin", label: "Torna alla panoramica" }}
    />
  );
}
