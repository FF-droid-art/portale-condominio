import { PageBody } from "@/components/ui/page-header";
import { SkeletonPageHeader, SkeletonTable } from "@/components/ui/skeleton";

export default function CaricamentoAssembleeCondomino() {
  return (
    <PageBody aria-busy="true" aria-label="Caricamento delle assemblee">
      <SkeletonPageHeader />
      <SkeletonTable righe={5} colonne={4} />
    </PageBody>
  );
}
