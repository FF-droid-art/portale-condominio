"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function Errore({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <ErrorState
      digest={error.digest}
      onRiprova={() => unstable_retry()}
      tornaA={{ href: "/", label: "Torna alla home" }}
    />
  );
}
