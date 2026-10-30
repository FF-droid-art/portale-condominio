import type { MetadataRoute } from "next";

/**
 * SITO-02: nessun crawler aveva finora un'indicazione esplicita su cosa
 * indicizzare. `/admin` e `/area-riservata` sono già irraggiungibili senza
 * sessione (il proxy reindirizza a `/login`, vedi `src/proxy.ts`), ma senza
 * questa direttiva un motore di ricerca può comunque indicizzare l'URL del
 * redirect o della pagina di login sotto percorsi come
 * `/admin/condomini/[id]`, generando voci duplicate o poco utili.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/area-riservata", "/api"],
    },
    sitemap: "/sitemap.xml",
  };
}
