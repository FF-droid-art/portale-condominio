import { PageBody } from "@/components/ui/page-header";
import { Skeleton, SkeletonPageHeader, SkeletonTable } from "@/components/ui/skeleton";

export default function CaricamentoImporta() {
  return (
    <PageBody aria-busy="true" aria-label="Caricamento della sezione importazioni">
      <SkeletonPageHeader />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5"
          >
            <Skeleton className="size-10 rounded-xl" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-4/5" />
          </div>
        ))}
      </div>
      <SkeletonTable righe={4} colonne={5} />
    </PageBody>
  );
}
