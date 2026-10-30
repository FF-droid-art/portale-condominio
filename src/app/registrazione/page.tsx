import {
  LUNGHEZZA_CODICE_INVITO,
  formattaCodiceInvito,
  normalizzaCodiceInvito,
} from "@/lib/inviti";
import { FormRegistrazione } from "./form-registrazione";

/**
 * La pagina è un Server Component sottile il cui unico compito è leggere
 * `?codice=` dall'URL e passarlo al modulo, che è il componente client.
 *
 * Perché non `useSearchParams` dentro al modulo: quel hook è un hook
 * client e, su una rotta prerenderizzata, costringe a rendere nel browser
 * tutto l'albero fino al più vicino confine `Suspense` (vedi
 * `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md`).
 * Il parametro qui serve solo come valore iniziale di un campo: leggerlo
 * lato server e passarlo come prop evita sia il confine `Suspense` sia il
 * lampeggio del campo vuoto prima dell'idratazione — che su un flusso che
 * arriva da un QR code in bacheca è esattamente il momento in cui l'utente
 * guarda lo schermo.
 */
export default async function RegistrazionePage({
  searchParams,
}: {
  searchParams: Promise<{ codice?: string | string[] }>;
}) {
  const { codice } = await searchParams;
  const grezzo = Array.isArray(codice) ? codice[0] : codice;

  // Si normalizza subito: il QR porta un codice già formattato, ma un link
  // ricopiato a mano può arrivare minuscolo o senza trattino. Il taglio a
  // otto caratteri evita che un parametro arbitrario finisca nel campo
  // così com'è: quello che non è un codice non va mostrato come tale.
  const codiceIniziale = formattaCodiceInvito(
    normalizzaCodiceInvito(grezzo).slice(0, LUNGHEZZA_CODICE_INVITO)
  );

  return <FormRegistrazione codiceIniziale={codiceIniziale} />;
}
