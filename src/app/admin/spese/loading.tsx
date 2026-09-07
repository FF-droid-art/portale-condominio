import { PageBody } from "@/components/ui/page-header";
import { SkeletonPageHeader, SkeletonTable } from "@/components/ui/skeleton";

export default function CaricamentoSpese() {
  return (
    <PageBody aria-busy="true" aria-label="Caricamento delle spese">
      <SkeletonPageHeader />
      <SkeletonTable righe={8} colonne={6} />
    </PageBody>
  );
}
