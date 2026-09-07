"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function ErroreAreaRiservata({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <ErrorState
      descrizione="Non siamo riusciti a caricare questa pagina della tua area. Spesso è un problema temporaneo: riprova fra un istante."
      digest={error.digest}
      onRiprova={() => unstable_retry()}
      tornaA={{ href: "/area-riservata", label: "Torna al riepilogo" }}
    />
  );
}
