"use client";

import { useEffect, useRef } from "react";

/**
 * Esegue `onSuccesso` quando una server action collegata a `useActionState`
 * termina senza errore.
 *
 * Serve a chiudere le finestre modali dopo un salvataggio riuscito: la
 * action non restituisce nulla quando va a buon fine, quindi il segnale è il
 * passaggio di `pending` da vero a falso senza un errore in stato. È logica
 * puramente di interfaccia: non tocca né i dati né la action.
 */
export function useAlSuccesso(
  pending: boolean,
  stato: { errore?: string } | undefined,
  onSuccesso: () => void
) {
  const eraPending = useRef(false);
  const callback = useRef(onSuccesso);

  // La callback arriva quasi sempre come funzione anonima, quindi cambia a
  // ogni render: la teniamo in un ref (aggiornato dopo il render, non
  // durante) per non far dipendere l'effetto principale dalla sua identità.
  useEffect(() => {
    callback.current = onSuccesso;
  });

  useEffect(() => {
    if (eraPending.current && !pending && !stato?.errore) {
      callback.current();
    }
    eraPending.current = pending;
  }, [pending, stato]);
}
