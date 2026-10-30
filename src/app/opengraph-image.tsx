import { ImageResponse } from "next/og";

// SITO-03: senza questo file, condividere il link del sito su WhatsApp,
// LinkedIn o email (i canali plausibili per raggiungere un amministratore
// di condominio) mostrava solo il link nudo, senza anteprima. La
// convenzione `opengraph-image.tsx` di Next genera l'immagine a richiesta
// e la collega da sola ai meta tag Open Graph di ogni pagina che non ne
// dichiari una propria — niente file statico da aggiornare a mano.

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Stessi colori di src/app/globals.css (--navy, --navy-2, --navy-3,
// --navy-light, --accent): l'immagine deve sembrare lo stesso prodotto
// della pagina che la condivide, non un badge generato a parte.
const NAVY = "#070b14";
const NAVY_2 = "#0e1626";
const NAVY_3 = "#16233b";
const NAVY_LIGHT = "#2f5ea8";
const ACCENT = "#2d5bd0";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "96px",
          background: `linear-gradient(160deg, ${NAVY_3}, ${NAVY} 55%, ${NAVY_2})`,
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* Stessa icona di src/components/logo.tsx (lucide "building-2"),
              ridisegnata qui perché ImageResponse non rende componenti React
              esterni: serve l'SVG inline. */}
          <div
            style={{
              display: "flex",
              width: 72,
              height: 72,
              borderRadius: 18,
              background: `linear-gradient(135deg, ${NAVY_LIGHT}, ${ACCENT})`,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M10 12h4" />
              <path d="M10 8h4" />
              <path d="M14 21v-3a2 2 0 0 0-4 0v3" />
              <path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2" />
              <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
            </svg>
          </div>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 600, letterSpacing: "-0.02em" }}>
            <span style={{ color: "rgba(255,255,255,0.65)" }}>Portale&nbsp;</span>
            <span>Condominio</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 48,
            fontSize: 34,
            lineHeight: 1.35,
            maxWidth: 820,
            color: "rgba(255,255,255,0.8)",
          }}
        >
          Spese e ripartizioni, unità immobiliari, assemblee e votazioni
          telematiche in un unico posto.
        </div>
      </div>
    ),
    { ...size }
  );
}
