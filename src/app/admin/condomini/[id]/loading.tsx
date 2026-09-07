import { PageBody } from "@/components/ui/page-header";
import {
  Skeleton,
  SkeletonPageHeader,
  SkeletonStats,
  SkeletonTable,
} from "@/components/ui/skeleton";

export default function CaricamentoCondominio() {
  return (
    <PageBody aria-busy="true" aria-label="Caricamento del condominio">
      <SkeletonPageHeader />
      <SkeletonStats />
      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <SkeletonTable righe={6} colonne={5} />
        </div>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-3/4" />
          </div>
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        </div>
      </div>
    </PageBody>
  );
}
