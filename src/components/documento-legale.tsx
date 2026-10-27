import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Rende in pagina un documento legale scritto in Markdown (privacy policy,
// cookie policy, ecc.), con una tipografia coerente col resto del design
// system invece dello stile di default del browser. Non è un componente di
// uso generale per "markdown qualsiasi": è pensato per testo legale lungo,
// con tabelle e citazioni, letto raramente e per intero.

const componenti: Components = {
  h1: ({ children }) => (
    <h1 className="mt-10 text-2xl font-semibold tracking-tight text-balance first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-10 border-t border-border pt-8 text-xl font-semibold tracking-tight first:mt-0 first:border-none first:pt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-6 text-base font-semibold tracking-tight">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="leading-relaxed text-foreground">{children}</p>
  ),
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  a: ({ href, children }) => (
    <a href={href} className="font-medium text-accent-ink underline-offset-4 hover:underline">
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="flex flex-col gap-2 pl-5 leading-relaxed [&>li]:list-disc">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="flex flex-col gap-2 pl-5 leading-relaxed [&>li]:list-decimal">{children}</ol>
  ),
  li: ({ children }) => <li>{children}</li>,
  hr: () => <hr className="my-8 border-border" />,
  blockquote: ({ children }) => (
    <blockquote className="rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm leading-relaxed text-muted-foreground">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded bg-surface-muted px-1.5 py-0.5 text-[0.85em]">{children}</code>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-surface-muted">{children}</thead>,
  tr: ({ children }) => <tr className="border-b border-border last:border-none">{children}</tr>,
  th: ({ children }) => (
    <th className="px-3 py-2 font-semibold whitespace-normal align-top">{children}</th>
  ),
  td: ({ children }) => <td className="px-3 py-2 align-top whitespace-normal">{children}</td>,
};

export function DocumentoLegale({ markdown }: { markdown: string }) {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={componenti}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
