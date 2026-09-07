import { Building2, CalendarClock, FileSpreadsheet, Home, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { Card, CardDescription, CardHeader, CardHeaderText, CardTitle, Section } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Panoramica" };

export default async function AdminDashboard() {
  const supabase = await createClient();

  const [{ count: condomini }, { count: unita }, { count: spese }, { count: assemblee }] =
    await Promise.all([
      supabase.from("condomini").select("*", { count: "exact", head: true }),
      supabase.from("unita").select("*", { count: "exact", head: true }),
      supabase.from("spese").select("*", { count: "exact", head: true }),
      supabase.from("assemblee").select("*", { count: "exact", head: true }),
    ]);

  const nessunDato = !condomini;

  return (
    <PageBody>
      <PageHeader
        titolo="Panoramica"
        descrizione="Il quadro d'insieme dei condomìni che gestisci."
      />

      <StatGrid>
        <StatCard
          label="Condomìni"
          value={condomini ?? 0}
          icon={Building2}
          href="/admin/condomini"
        />
        <StatCard
          label="Unità immobiliari"
          value={unita ?? 0}
          icon={Home}
          href="/admin/condomini"
        />
        <StatCard label="Spese registrate" value={spese ?? 0} icon={Wallet} href="/admin/spese" />
        <StatCard
          label="Assemblee"
          value={assemblee ?? 0}
          icon={CalendarClock}
          href="/admin/assemblee"
        />
      </StatGrid>

      {/* Primo accesso: invece di quattro zeri senza indicazioni, la pagina
          spiega qual è il primo passo e come farlo. */}
      {nessunDato && (
        <Section titolo="Da dove iniziare">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardHeaderText>
                  <CardTitle>1. Aggiungi il primo condominio</CardTitle>
                  <CardDescription>
                    Inserisci nome, indirizzo ed eventualmente il conto corrente: da lì potrai
                    creare le unità e collegare i proprietari.
                  </CardDescription>
                </CardHeaderText>
              </CardHeader>
              <div className="mt-auto">
                <Button href="/admin/condomini">
                  <Building2 className="size-4" aria-hidden="true" />
                  Vai ai condomìni
                </Button>
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardHeaderText>
                  <CardTitle>2. Oppure importa quello che hai già</CardTitle>
                  <CardDescription>
                    Se gestisci i condomìni con un foglio di calcolo, carica il file .xlsx o .csv:
                    condomìni, unità, occupanti e millesimi entrano in un colpo solo.
                  </CardDescription>
                </CardHeaderText>
              </CardHeader>
              <div className="mt-auto">
                <Button href="/admin/importa" variant="secondary">
                  <FileSpreadsheet className="size-4" aria-hidden="true" />
                  Importa dati
                </Button>
              </div>
            </Card>
          </div>
        </Section>
      )}
    </PageBody>
  );
}
