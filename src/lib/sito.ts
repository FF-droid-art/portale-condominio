/**
 * URL canonico del sito (SITO-03).
 *
 * `VERCEL_PROJECT_PRODUCTION_URL` è impostata automaticamente da Vercel con
 * il dominio di produzione del progetto — niente da configurare a mano —
 * con un fallback per lo sviluppo locale, dove quella variabile non esiste.
 *
 * ## Quando usare questo, e quando l'origine della richiesta
 *
 * Qui si ottiene sempre il dominio di **produzione**, anche quando la
 * pagina è servita da un deploy di anteprima. È quello che serve a tutto
 * ciò che deve restare valido fuori dalla sessione in cui è stato creato:
 * i metadati Open Graph (`src/app/layout.tsx`) e gli URL dentro i QR code
 * dei codici di invito, che finiscono stampati su un foglio in bacheca e
 * non devono puntare a un'anteprima destinata a scomparire.
 *
 * Quando invece il link deve riportare l'utente esattamente da dove è
 * partito — il link di conferma dell'email dopo la registrazione, quello
 * di recupero password — l'origine va letta dagli header della richiesta
 * (`headers().get("origin")`), come fanno `registrazione/actions.ts` e
 * `recupera-password/actions.ts`: chi si registra da un'anteprima deve
 * tornare su quella, non su produzione.
 */
export function urlCanonicoSito(): string {
  return process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000";
}
