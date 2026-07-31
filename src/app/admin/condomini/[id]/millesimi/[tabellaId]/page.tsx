import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { formatMillesimi } from "@/lib/format";
import { EditorValoriMillesimali } from "./editor-valori";

export default async function TabellaMillesimaleDettaglioPage({
  params,
}: {
  params: Promise<{ id: string; tabellaId: string }>;
}) {
  const { id, tabellaId } = await params;
  const supabase = await createClient();

  const { data: tabella } = await supabase
    .from("tabelle_millesimali")
    .select("*")
    .eq("id", tabellaId)
    .single();
  if (!tabella) notFound();

  const [{ data: unita }, { data: valori }] = await Promise.all([
    supabase
      .from("unita")
      .select("id, identificativo, piano")
      .eq("condominio_id", id)
      .order("identificativo"),
    supabase.from("valori_millesimali").select("unita_id, valore").eq("tabella_id", tabellaId),
  ]);

  const valorePerUnita = new Map((valori ?? []).map((v) => [v.unita_id, v.valore]));
  const righe = (unita ?? []).map((u) => ({
    unitaId: u.id,
    identificativo: u.identificativo,
    piano: u.piano,
    valore: valorePerUnita.get(u.id) ?? 0,
  }));
  const totale = righe.reduce((somma, r) => somma + r.valore, 0);

  return (
    <div className="flex flex-col gap-8">
      <Link
        href={`/admin/condomini/${id}/millesimi`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-accent w-fit"
      >
        <ArrowLeft className="size-4" /> Tabelle millesimali
      </Link>

      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <h1 className="text-3xl font-bold tracking-tight">{tabella.nome}</h1>
        <p className="text-sm text-muted-foreground">Totale: {formatMillesimi(totale)}</p>
      </div>

      <Card>
        <EditorValoriMillesimali condominioId={id} tabellaId={tabellaId} righe={righe} />
      </Card>
    </div>
  );
}
