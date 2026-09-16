import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      // `server-only` è un marcatore che esiste solo dentro la risoluzione di
      // Next: importarlo da vitest fallirebbe. Si punta al modulo vuoto che
      // Next stesso usa lato server, così i moduli marcati restano testabili.
      "server-only": path.resolve(
        import.meta.dirname,
        "./node_modules/next/dist/compiled/server-only/empty.js"
      ),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
