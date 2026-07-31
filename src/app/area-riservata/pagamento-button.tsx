import { CreditCard } from "lucide-react";
import { avviaPagamento } from "./actions";
import { Button } from "@/components/ui/button";

export function PagamentoButton({ ripartizioneId }: { ripartizioneId: string }) {
  return (
    <form action={avviaPagamento}>
      <input type="hidden" name="ripartizione_id" value={ripartizioneId} />
      <Button type="submit" size="sm" variant="secondary">
        <CreditCard className="size-4" />
        Paga ora
      </Button>
    </form>
  );
}
