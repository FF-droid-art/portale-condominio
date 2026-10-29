// Carica le credenziali del progetto Supabase dedicato ai test di
// isolamento tenant da .env.test.local (ignorato da git, vedi .gitignore).
// Se il file non esiste, non blocca nulla: le suite che ne hanno bisogno
// si saltano da sole (vedi tests/isolamento-tenant.test.ts), così il
// repo resta clonabile e testabile (con `npm run test`, la suite di
// logica pura) anche senza il progetto di test configurato.
try {
  process.loadEnvFile(new URL("../.env.test.local", import.meta.url));
} catch {
  // File assente: ok, vedi commento sopra.
}
