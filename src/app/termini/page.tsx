import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { DocumentoLegale } from "@/components/documento-legale";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termini e condizioni",
  description: "Termini e condizioni d'uso del Portale Condominio.",
};

function leggiMarkdown(nomeFile: string) {
  return fs.readFileSync(path.join(process.cwd(), "legale", nomeFile), "utf-8");
}

export default function TerminiPage() {
  const markdown = leggiMarkdown("termini-BOZZA.md");

  return (
    <div className="flex flex-1 flex-col bg-background">
      <header className="border-b border-border bg-surface px-4 py-5 sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4">
          <Link href="/" className="rounded-lg">
            <Logo />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Torna al sito
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <DocumentoLegale markdown={markdown} />
      </main>
    </div>
  );
}
