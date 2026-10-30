import type { MetadataRoute } from "next";

/**
 * SITO-02. Solo le pagine pubbliche e stabili: non ci va `/reimposta-password`
 * (si raggiunge solo dal link dentro un'email, non è pensata per essere
 * scoperta) né nulla sotto `/admin`/`/area-riservata` (vedi `robots.ts`).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const pagine = [
    { percorso: "/", priorita: 1, frequenza: "monthly" as const },
    { percorso: "/login", priorita: 0.3, frequenza: "yearly" as const },
    { percorso: "/registrazione", priorita: 0.5, frequenza: "yearly" as const },
    { percorso: "/recupera-password", priorita: 0.1, frequenza: "yearly" as const },
    { percorso: "/privacy", priorita: 0.2, frequenza: "yearly" as const },
    { percorso: "/cookie", priorita: 0.2, frequenza: "yearly" as const },
  ];

  return pagine.map((p) => ({
    url: p.percorso,
    lastModified: new Date(),
    changeFrequency: p.frequenza,
    priority: p.priorita,
  }));
}
