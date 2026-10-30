import { defineConfig } from "vitest/config";
import path from "node:path";

// Config separata da vitest.config.mts: questa è per i test di
// integrazione che parlano davvero con un progetto Supabase (quello di
// test, mai quello di produzione/demo), non per la logica pura di
// src/**. Tenerla separata mantiene `npm run test` rapido e senza
// dipendenze di rete, come documentato in CLAUDE.md.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      // Stesso alias di vitest.config.mts: `server-only` è un marcatore che
      // esiste solo dentro la risoluzione di Next, e un test che importa un
      // modulo marcato (per esempio gli elenchi di colonne dell'esportazione)
      // fallirebbe sull'import prima di arrivare alla prima asserzione.
      "server-only": path.resolve(
        import.meta.dirname,
        "./node_modules/next/dist/compiled/server-only/empty.js"
      ),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup-env.ts"],
    // Le query di rete contro un progetto Supabase reale sono più lente
    // dei test unitari: il default di vitest (5s) basta appena, meglio
    // avere margine.
    testTimeout: 30_000,
  },
});
