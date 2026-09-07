import { PageBody } from "@/components/ui/page-header";
import { SkeletonPageHeader, SkeletonTable } from "@/components/ui/skeleton";

export default function CaricamentoUtenti() {
  return (
    <PageBody aria-busy="true" aria-label="Caricamento degli utenti">
      <SkeletonPageHeader />
      <SkeletonTable righe={5} colonne={4} />
    </PageBody>
  );
}
