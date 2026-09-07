import { PageBody } from "@/components/ui/page-header";
import {
  SkeletonPageHeader,
  SkeletonStats,
  SkeletonTable,
} from "@/components/ui/skeleton";

/**
 * Segnaposto usato da tutte le sezioni del pannello che non ne definiscono
 * uno proprio. Ha la stessa struttura delle pagine reali (intestazione,
 * fila di dati di sintesi, tabella) così il contenuto, quando arriva, non
 * fa saltare il layout.
 */
export default function CaricamentoAdmin() {
  return (
    <PageBody aria-busy="true" aria-label="Caricamento in corso">
      <SkeletonPageHeader />
      <SkeletonStats />
      <SkeletonTable righe={6} colonne={5} />
    </PageBody>
  );
}
