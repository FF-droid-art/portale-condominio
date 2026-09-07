import { PageBody } from "@/components/ui/page-header";
import { SkeletonCards, SkeletonPageHeader } from "@/components/ui/skeleton";

export default function CaricamentoCondomini() {
  return (
    <PageBody aria-busy="true" aria-label="Caricamento dei condomìni">
      <SkeletonPageHeader />
      <SkeletonCards quante={4} />
    </PageBody>
  );
}
