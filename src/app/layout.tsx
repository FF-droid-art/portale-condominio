import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// URL canonico del sito (SITO-03): serve a Next per trasformare in assoluti
// gli URL relativi di Open Graph/Twitter/sitemap. `VERCEL_PROJECT_PRODUCTION_URL`
// è impostata automaticamente da Vercel con il dominio di produzione del
// progetto — niente da configurare a mano — con un fallback per lo sviluppo
// locale, dove quella variabile non esiste.
const urlSito = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

const TITOLO_DEFAULT = "Portale Condominio";
const DESCRIZIONE_DEFAULT =
  "Gestione condominiale online: spese e ripartizioni, unità immobiliari, assemblee e votazioni telematiche.";

export const metadata: Metadata = {
  metadataBase: new URL(urlSito),
  title: {
    default: TITOLO_DEFAULT,
    template: "%s · Portale Condominio",
  },
  description: DESCRIZIONE_DEFAULT,
  // SITO-03: senza questi campi, condividere il link su WhatsApp/LinkedIn/
  // email mostrava solo il link nudo. L'immagine la genera
  // src/app/opengraph-image.tsx, collegata automaticamente da Next.
  openGraph: {
    type: "website",
    locale: "it_IT",
    siteName: TITOLO_DEFAULT,
    title: TITOLO_DEFAULT,
    description: DESCRIZIONE_DEFAULT,
  },
  twitter: {
    card: "summary_large_image",
    title: TITOLO_DEFAULT,
    description: DESCRIZIONE_DEFAULT,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
