// Nome del cookie httpOnly che, durante una sessione "visualizza come",
// contiene i token della sessione amministratore originale (per poterla
// ripristinare) insieme ai nomi da mostrare nel banner. Essendo httpOnly
// non è leggibile da JS lato client, ma resta leggibile lato server nei
// Server Component (dove serve per decidere se mostrare il banner).
export const COOKIE_IMPERSONAZIONE = "admin_return_session";

export type SessioneImpersonazione = {
  access_token: string;
  refresh_token: string;
  admin_nome: string;
  target_nome: string;
};
