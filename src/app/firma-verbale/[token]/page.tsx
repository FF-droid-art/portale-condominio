import { notFound } from "next/navigation";
import { CheckCircle2, FileText } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/service";
import { AuthShell } from "@/components/auth-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatDataOra } from "@/lib/format";
import { DISCLAIMER_FIRMA } from "@/lib/firma-otp";
import { ModuloConferma } from "./modulo-conferma";

export const metadata = { title: "Conferma del verbale" };

/**
 * Pagina pubblica di conferma del verbale, raggiungibile dal collegamento
 * personale inviato per email: chi deve confermare può non avere un account
 * sul portale, quindi non c'è login. Il token nell'URL identifica il
 * firmatario; da solo non conferma nulla, serve anche il codice usa-e-getta
 * spedito separatamente all'indirizzo registrato.
 *
 * Lettura con client service-role: la policy RLS su "firme_verbale" riserva la
 * riga all'amministratore dell'assemblea, e qui non esiste una sessione.
 */
export default async function FirmaVerbalePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("firme_verbale")
    .select(
      "nominativo, ruolo, otp_inviato_il, confermato_il, assemblea:assemblea_id(tipo, data_assemblea, luogo, verbale_url, condominio:condominio_id(nome, indirizzo))"
    )
    .eq("token", token)
    .maybeSingle();

  if (!data) notFound();

  const assemblea = data.assemblea as unknown as {
    tipo: string;
    data_assemblea: string;
    luogo: string | null;
    verbale_url: string | null;
    condominio: { nome: string; indirizzo: string } | null;
  } | null;

  let verbaleSignedUrl: string | null = null;
  if (assemblea?.verbale_url) {
    const { data: file } = await supabase.storage
      .from("documenti-condominio")
      .createSignedUrl(assemblea.verbale_url, 900);
    verbaleSignedUrl = file?.signedUrl ?? null;
  }

  const confermato = Boolean(data.confermato_il);

  return (
    <AuthShell
      titolo={confermato ? "Verbale confermato" : "Conferma il verbale"}
      sottotitolo={
        <>
          {data.nominativo}, assemblea {assemblea?.tipo} del{" "}
          {assemblea ? formatDataOra(assemblea.data_assemblea) : "—"}
          {assemblea?.condominio ? ` — ${assemblea.condominio.nome}` : ""}
          {assemblea?.luogo ? `, ${assemblea.luogo}` : ""}.
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {verbaleSignedUrl ? (
          <Button href={verbaleSignedUrl} target="_blank" rel="noopener noreferrer" variant="secondary" full>
            <FileText className="size-4" aria-hidden="true" />
            Leggi il verbale
          </Button>
        ) : (
          <Alert tono="warning">
            Il verbale non è ancora stato depositato dall&apos;amministratore: riprova più tardi.
          </Alert>
        )}

        {confermato ? (
          <Alert tono="success" titolo="Conferma registrata">
            <p className="flex items-start gap-1.5">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                Hai confermato questo verbale il {formatDataOra(data.confermato_il as string)}. Non
                serve fare altro.
              </span>
            </p>
          </Alert>
        ) : (
          verbaleSignedUrl && (
            <ModuloConferma token={token} codiceGiaRichiesto={Boolean(data.otp_inviato_il)} />
          )
        )}

        <p className="text-xs leading-relaxed text-muted-foreground">{DISCLAIMER_FIRMA}</p>
      </div>
    </AuthShell>
  );
}
