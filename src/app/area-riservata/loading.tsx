import { PageBody } from "@/components/ui/page-header";
import {
  Skeleton,
  SkeletonPageHeader,
  SkeletonStats,
  SkeletonTable,
} from "@/components/ui/skeleton";

export default function CaricamentoAreaRiservata() {
  return (
    <PageBody aria-busy="true" aria-label="Caricamento in corso">
      <SkeletonPageHeader />
      <SkeletonStats />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5"
          >
            <Skeleton className="h-4.5 w-32" />
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3.5 w-24" />
          </div>
        ))}
      </div>
      <SkeletonTable righe={5} colonne={5} />
    </PageBody>
  );
}
