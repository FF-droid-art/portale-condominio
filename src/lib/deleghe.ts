import type { SupabaseClient } from "@supabase/supabase-js";

// Art. 67, comma 3, disp. att. c.c.: nei condomini con più di 20
// condòmini, il delegato non può rappresentare più di un quinto dei
// condòmini né più di un quinto del valore millesimale dell'edificio.
// Sotto quella soglia la legge non pone un limite numerico esplicito,
// quindi qui non blocchiamo nulla: l'amministratore resta libero di
// intervenire manualmente in casi particolari.
export async function verificaLimiteDelega(
  supabase: SupabaseClient,
  params: {
    assembleaId: string;
    condominioId: string;
    utenteDelegatoId: string;
    millesimiNuovaDelega: number;
  }
): Promise<{ errore?: string }> {
  const { assembleaId, condominioId, utenteDelegatoId, millesimiNuovaDelega } = params;

  const [{ data: numeroUnita }, { data: millesimiTotali }, { data: riepilogo }] = await Promise.all([
    supabase.rpc("condominio_conteggio_unita", { p_condominio_id: condominioId }),
    supabase.rpc("condominio_millesimi_totali", { p_condominio_id: condominioId }),
    supabase
      .rpc("deleghe_riepilogo_delegato", {
        p_assemblea_id: assembleaId,
        p_utente_delegato_id: utenteDelegatoId,
      })
      .single(),
  ]);

  if ((numeroUnita ?? 0) <= 20) return {};

  const riepilogoTipizzato = riepilogo as { numero_deleghe: number; millesimi_totali: number } | null;
  const deleghePreesistenti = riepilogoTipizzato?.numero_deleghe ?? 0;
  const millesimiPreesistenti = riepilogoTipizzato?.millesimi_totali ?? 0;

  const limiteUnita = (numeroUnita ?? 0) / 5;
  const limiteMillesimi = (millesimiTotali ?? 0) / 5;

  if (deleghePreesistenti + 1 > limiteUnita) {
    return {
      errore: `Questo delegato rappresenterebbe più di un quinto dei condòmini (max ${Math.floor(
        limiteUnita
      )} deleghe), non consentito dall'art. 67 disp. att. c.c.`,
    };
  }
  if (millesimiPreesistenti + millesimiNuovaDelega > limiteMillesimi) {
    return {
      errore:
        "Questo delegato rappresenterebbe più di un quinto del valore millesimale dell'edificio, non consentito dall'art. 67 disp. att. c.c.",
    };
  }

  return {};
}
