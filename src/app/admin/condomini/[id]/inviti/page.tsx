import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { richiedeAmministratore } from "@/lib/supabase/dal";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { CodiceCopiabile } from "@/components/inviti/codice-copiabile";
import { RigeneraCodiceButton } from "@/components/inviti/rigenera-codice-button";
import { GeneraMancantiButton } from "@/components/inviti/genera-mancanti-button";
import { StampaButton } from "@/components/inviti/stampa-button";
import { formattaCodiceInvito, urlRegistrazioneConCodice } from "@/lib/inviti";
import { qrCodiceInvito } from "@/lib/inviti-qr";
import { urlCanonicoSito } from "@/lib/sito";

export const metadata: Metadata = {
  title: "Codici di invito",
};

type RigaUnita = {
  id: string;
  identificativo: string;
  piano: string | null;
  inviti_unita: { codice: string } | { codice: string }[] | null;
  unita_proprietari: { utente_id: string | null; attivo: boolean | null }[] | null;
};

/** PostgREST restituisce una relazione uno-a-uno come oggetto o come array
 *  di un elemento a seconda di come la riconosce: va normalizzato. */
function codiceDi(riga: RigaUnita): string | null {
  const invito = Array.isArray(riga.inviti_unita) ? riga.inviti_unita[0] : riga.inviti_unita;
  return invito?.codice ?? null;
}

/**
 * Riepilogo dei codici di invito di un condominio, fatto per essere
 * stampato.
 *
 * ## Perché una pagina sola per tutte le unità
 *
 * Il codice di ogni unità si vede anche nella scheda dell'unità, ma un
 * amministratore con cinquanta unità non apre cinquanta schede: consegnare
 * i codici è un'operazione che si fa una volta, tutta insieme, quando si
 * prende in gestione uno stabile. Questa pagina è quel foglio — si stampa,
 * si taglia e si infila nelle cassette della posta, oppure si affigge in
 * bacheca per la parte QR.
 *
 * ## La stampa
 *
 * Nessun PDF generato lato server: le regole `print:` di Tailwind
 * nascondono navigazione, pulsanti e tutto ciò che su carta non serve, e
 * `break-inside-avoid` impedisce che la scheda di un'unità si spezzi tra
 * due pagine. Il guscio dell'applicazione
 * (`src/components/app-shell.tsx`) nasconde da sé barra laterale e
 * intestazione mobile in stampa.
 *
 * ## Attenzione a cosa finisce sul foglio
 *
 * Qui non si stampano nomi di persone, importi o morosità: solo unità,
 * piano e codice. Un foglio che gira per le scale non deve dire chi abita
 * dove, né quanto deve.
 */
export default async function InvitiCondominioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await richiedeAmministratore();
  const supabase = await createClient();

  // La RLS fa il lavoro vero: un condominio di un altro amministratore non
  // è visibile, quindi la pagina risponde 404 come se non esistesse.
  const { data: condominio } = await supabase
    .from("condomini")
    .select("id, nome, indirizzo")
    .eq("id", id)
    .single();
  if (!condominio) notFound();

  const { data: unitaData } = await supabase
    .from("unita")
    .select("id, identificativo, piano, inviti_unita(codice), unita_proprietari(utente_id, attivo)")
    .eq("condominio_id", id)
    .order("identificativo");

  const unita = (unitaData ?? []) as unknown as RigaUnita[];
  const mancanti = unita.filter((u) => !codiceDi(u)).length;

  // I QR si generano tutti in parallelo: sono calcolo puro e locale (nessuna
  // rete), ma su un condominio grande sono decine di immagini.
  const qrPerUnita = new Map(
    await Promise.all(
      unita
        .map((u) => ({ id: u.id, codice: codiceDi(u) }))
        .filter((u): u is { id: string; codice: string } => Boolean(u.codice))
        .map(async ({ id: unitaId, codice }): Promise<[string, string]> => [
          unitaId,
          await qrCodiceInvito(codice),
        ])
    )
  );

  const origine = urlCanonicoSito();
  const indirizzoRegistrazione = `${origine.replace(/^https?:\/\//, "")}/registrazione`;

  return (
    <PageBody>
      <PageHeader
        indietro={{ href: `/admin/condomini/${condominio.id}`, label: condominio.nome }}
        titolo="Codici di invito"
        descrizione="Un codice per unità: chi lo inserisce in fase di registrazione risulta collegato alla propria unità senza che tu debba fare nulla. Lo stesso codice vale per tutti gli occupanti di quell'unità."
        azioni={
          <>
            <StampaButton etichetta="Stampa il foglio" />
            <GeneraMancantiButton condominioId={condominio.id} mancanti={mancanti} />
          </>
        }
      />

      {/* Intestazione del foglio stampato: su schermo l'informazione è già
          nell'intestazione di pagina e nella barra laterale, su carta no. */}
      <div className="hidden print:block">
        <h2 className="text-lg font-semibold">{condominio.nome}</h2>
        <p className="text-sm text-muted-foreground">{condominio.indirizzo}</p>
        <p className="mt-2 text-sm">
          Per accedere al portale: registrati su <strong>{indirizzoRegistrazione}</strong> e
          inserisci il codice della tua unità, oppure inquadra il QR code.
        </p>
      </div>

      {unita.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="Nessuna unità in questo condominio"
          description="I codici di invito esistono per unità: aggiungi le unità del condominio e il codice di ciascuna viene creato automaticamente."
          action={
            <Button href={`/admin/condomini/${condominio.id}`} variant="secondary" size="sm">
              Torna al condominio
            </Button>
          }
        />
      ) : (
        <>
          {mancanti > 0 && (
            <Card padding="sm" className="print:hidden">
              <p className="text-sm leading-relaxed">
                <strong>
                  {mancanti === 1
                    ? "Un'unità non ha ancora un codice"
                    : `${mancanti} unità non hanno ancora un codice`}
                </strong>
                : succede alle unità create prima dell&apos;introduzione dei codici di
                invito. Premi «Genera i codici mancanti» qui sopra: da allora in poi ogni
                nuova unità nasce già con il suo.
              </p>
            </Card>
          )}

          <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2 print:gap-3">
            {unita.map((u) => {
              const codice = codiceDi(u);
              const collegati = (u.unita_proprietari ?? []).filter(
                (p) => p.utente_id && p.attivo !== false
              ).length;
              const qr = qrPerUnita.get(u.id);

              return (
                <Card
                  key={u.id}
                  padding="sm"
                  className="flex items-start justify-between gap-4 break-inside-avoid print:shadow-none"
                >
                  <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{u.identificativo}</span>
                      {u.piano && (
                        <span className="text-xs text-muted-foreground">Piano {u.piano}</span>
                      )}
                    </div>

                    {codice ? (
                      <>
                        <span className="flex items-center gap-1">
                          <CodiceCopiabile
                            codice={formattaCodiceInvito(codice)}
                            etichetta={u.identificativo}
                          />
                          <RigeneraCodiceButton
                            unitaId={u.id}
                            condominioId={condominio.id}
                            identificativo={u.identificativo}
                          />
                        </span>
                        {/* L'URL in chiaro serve a chi riceve il foglio
                            stampato e non può o non vuole usare il QR. */}
                        <span className="break-all text-xs text-muted-foreground">
                          {urlRegistrazioneConCodice(origine, codice).replace(/^https?:\/\//, "")}
                        </span>
                      </>
                    ) : (
                      <Badge variant="warning">Codice da generare</Badge>
                    )}

                    {collegati > 0 && (
                      <span className="text-xs text-muted-foreground print:hidden">
                        {collegati === 1
                          ? "1 persona già registrata su questa unità"
                          : `${collegati} persone già registrate su questa unità`}
                      </span>
                    )}
                  </div>

                  {qr && (
                    // eslint-disable-next-line @next/next/no-img-element -- data URI generato lato server: non c'è nulla da ottimizzare e next/image non accetta data URI
                    <img
                      src={qr}
                      alt={`QR code per registrarsi all'unità ${u.identificativo}`}
                      width={112}
                      height={112}
                      className="size-28 shrink-0 rounded bg-white"
                    />
                  )}
                </Card>
              );
            })}
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground print:mt-2">
            Il codice serve una volta sola, al momento della registrazione, e può essere usato
            da più persone della stessa unità (per esempio due coniugi comproprietari). Se un
            codice finisce alla persona sbagliata, rigeneralo: il precedente smette subito di
            valere. Chi si registra con il codice risulta collegato all&apos;unità con quota di
            possesso 100: se i comproprietari sono più di uno, correggi le quote dalla scheda
            dell&apos;unità.
          </p>
        </>
      )}
    </PageBody>
  );
}
