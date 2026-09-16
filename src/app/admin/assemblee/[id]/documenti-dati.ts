import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getUtenteCorrente } from "@/lib/supabase/dal";
import {
  costruisciConvocazione,
  costruisciVerbale,
  type Documento,
} from "@/lib/documenti/modello";
import {
  calcolaQuorumCostitutivo,
  calcolaQuorumDeliberativo,
  normalizzaConvocazione,
} from "@/lib/quorum";
import type { PuntoOdg } from "@/lib/types";

export type TipoDocumento = "convocazione" | "verbale";

export function isTipoDocumento(valore: string): valore is TipoDocumento {
  return valore === "convocazione" || valore === "verbale";
}

type Riepilogo = {
  unita_totali: number;
  millesimi_totali: number;
  unita_intervenute: number;
  millesimi_intervenuti: number;
};

/**
 * Raccoglie dai dati già presenti tutto ciò che serve a una bozza di
 * convocazione o di verbale.
 *
 * Sta qui, e non dentro la Server Action o il Route Handler, perché entrambi ne
 * hanno bisogno: il route handler per l'anteprima/scaricamento, l'azione
 * "genera e salva" per depositare il PDF nello storage. Le query passano dal
 * client con la sessione dell'utente, quindi la RLS resta l'unico gate: un
 * amministratore non può generare il verbale di un'assemblea non sua.
 */
export async function costruisciDocumentoAssemblea(
  assembleaId: string,
  tipo: TipoDocumento
): Promise<Documento | null> {
  const supabase = await createClient();

  const { data: assemblea } = await supabase
    .from("assemblee")
    .select(
      "id, tipo, stato, data_assemblea, convocazione, luogo, link_videoconferenza, condominio_id, condominio:condominio_id(nome, indirizzo, codice_fiscale)"
    )
    .eq("id", assembleaId)
    .single();

  if (!assemblea) return null;

  const condominioRel = assemblea.condominio as unknown as {
    nome: string;
    indirizzo: string;
    codice_fiscale: string | null;
  } | null;

  const condominio = {
    nome: condominioRel?.nome ?? "—",
    indirizzo: condominioRel?.indirizzo ?? "—",
    codiceFiscale: condominioRel?.codice_fiscale ?? null,
  };

  const utente = await getUtenteCorrente();
  const amministratore = utente
    ? { nome: utente.nome, cognome: utente.cognome, email: utente.email }
    : null;

  const convocazione = normalizzaConvocazione(assemblea.convocazione);
  const generatoIl = new Date().toISOString();

  const { data: puntiData } = await supabase
    .from("punti_odg")
    .select("*")
    .eq("assemblea_id", assembleaId)
    .order("numero_punto", { ascending: true });
  const punti = (puntiData ?? []) as PuntoOdg[];

  if (tipo === "convocazione") {
    return costruisciConvocazione({
      condominio,
      assemblea: {
        tipo: assemblea.tipo,
        dataAssemblea: assemblea.data_assemblea,
        convocazione,
        luogo: assemblea.luogo,
        linkVideoconferenza: assemblea.link_videoconferenza,
      },
      puntiOdg: punti.map((p) => ({
        numero: p.numero_punto,
        descrizione: p.descrizione,
        tipoMaggioranza: p.tipo_maggioranza,
      })),
      amministratore,
      generatoIl,
    });
  }

  const [
    { data: riepilogoData },
    { data: presenzeData },
    { data: delegheData },
    { data: unitaData },
    { data: firmeData },
  ] = await Promise.all([
    supabase.rpc("assemblea_riepilogo_quorum", { p_assemblea_id: assembleaId }).maybeSingle(),
    supabase
      .from("presenze")
      // Anche chi è uscito prima della fine: nell'elenco dei presenti non
      // compare, ma non è nemmeno un assente ai fini dell'impugnazione, quindi
      // le due liste si ricavano dalla stessa query filtrando qui sotto.
      .select(
        "unita_id, modalita, millesimi_rappresentati, ora_uscita, unita:unita_id(identificativo, millesimi_proprieta)"
      )
      .eq("assemblea_id", assembleaId),
    supabase
      .from("deleghe")
      .select(
        "unita_delegante:unita_delegante_id(identificativo), utente_delegato:utente_delegato_id(nome, cognome)"
      )
      .eq("assemblea_id", assembleaId),
    // Tutte le unità del condominio: gli assenti si ricavano per differenza
    // dalle presenze, e vanno nel verbale perché per loro il termine di
    // impugnazione decorre dalla comunicazione (art. 1137 c.c.).
    supabase
      .from("unita")
      .select("id, identificativo, millesimi_proprieta")
      .eq("condominio_id", assemblea.condominio_id)
      .order("identificativo", { ascending: true }),
    // Presidente e segretario sono già noti se l'amministratore li ha indicati
    // tra i firmatari del verbale: meglio usare quei nomi che lasciare la
    // riga vuota.
    supabase
      .from("firme_verbale")
      .select("nominativo, ruolo")
      .eq("assemblea_id", assembleaId),
  ]);

  const riepilogo = (riepilogoData as Riepilogo | null) ?? {
    unita_totali: 0,
    millesimi_totali: 0,
    unita_intervenute: 0,
    millesimi_intervenuti: 0,
  };

  const quorumCostitutivo = calcolaQuorumCostitutivo({
    unitaTotali: riepilogo.unita_totali,
    millesimiTotali: riepilogo.millesimi_totali,
    unitaIntervenute: riepilogo.unita_intervenute,
    millesimiIntervenuti: riepilogo.millesimi_intervenuti,
    convocazione,
  });

  const presenze = (presenzeData ?? [])
    .filter((p) => p.ora_uscita === null)
    .map((p) => {
      const unita = p.unita as unknown as {
        identificativo: string;
        millesimi_proprieta: number;
      } | null;
      return {
        identificativo: unita?.identificativo ?? "—",
        modalita: p.modalita as string,
        millesimi: unita?.millesimi_proprieta ?? p.millesimi_rappresentati,
      };
    });

  const unitaIntervenute = new Set((presenzeData ?? []).map((p) => p.unita_id as string));
  const assenti = (unitaData ?? [])
    .filter((u) => !unitaIntervenute.has(u.id as string))
    .map((u) => ({
      identificativo: u.identificativo as string,
      millesimi: u.millesimi_proprieta as number,
    }));

  const firme = (firmeData ?? []) as { nominativo: string; ruolo: string }[];
  const nominativoPerRuolo = (ruolo: string) =>
    firme.find((f) => f.ruolo === ruolo)?.nominativo?.trim() || null;

  const deleghe = (delegheData ?? []).map((d) => {
    const delegante = d.unita_delegante as unknown as { identificativo: string } | null;
    const delegato = d.utente_delegato as unknown as { nome: string; cognome: string } | null;
    return {
      delegante: delegante?.identificativo ?? "—",
      delegato: delegato ? `${delegato.nome} ${delegato.cognome}` : "—",
    };
  });

  return costruisciVerbale({
    condominio,
    assemblea: {
      tipo: assemblea.tipo,
      dataAssemblea: assemblea.data_assemblea,
      convocazione,
      luogo: assemblea.luogo,
      stato: assemblea.stato,
    },
    quorum: {
      unitaTotali: riepilogo.unita_totali,
      millesimiTotali: riepilogo.millesimi_totali,
      unitaIntervenute: riepilogo.unita_intervenute,
      millesimiIntervenuti: riepilogo.millesimi_intervenuti,
      raggiunto: quorumCostitutivo.raggiunto,
      riferimento: quorumCostitutivo.riferimento,
    },
    cariche: {
      presidente: nominativoPerRuolo("presidente"),
      segretario: nominativoPerRuolo("segretario"),
    },
    presenze,
    assenti,
    deleghe,
    punti: punti.map((p) => {
      // A votazione chiusa contano i valori congelati nell'esito, altrimenti i
      // conteggi correnti: il verbale può essere generato anche in bozza,
      // durante la seduta.
      const chiusa = p.stato_votazione === "chiusa" && p.esito !== null;
      const favorevoliMillesimi = chiusa ? p.esito_favorevole ?? 0 : p.tally_favorevole;
      const deliberativo = calcolaQuorumDeliberativo({
        tipoMaggioranza: p.tipo_maggioranza,
        convocazione,
        unitaTotali: riepilogo.unita_totali,
        millesimiTotali: riepilogo.millesimi_totali,
        unitaIntervenute: riepilogo.unita_intervenute,
        favorevoliUnita: p.tally_n_favorevole,
        favorevoliMillesimi,
      });

      return {
        numero: p.numero_punto,
        descrizione: p.descrizione,
        tipoMaggioranza: p.tipo_maggioranza,
        esito: p.esito,
        // I conteggi per testa non hanno un equivalente congelato nell'esito:
        // l'unica fonte sono i tally, che restano fermi a votazione chiusa.
        favorevoliUnita: p.tally_n_favorevole,
        contrariUnita: p.tally_n_contrario,
        astenutiUnita: p.tally_n_astenuto,
        favorevoliMillesimi,
        contrariMillesimi: chiusa ? p.esito_contrario ?? 0 : p.tally_contrario,
        astenutiMillesimi: chiusa ? p.esito_astenuto ?? 0 : p.tally_astenuto,
        quorumRaggiunto: deliberativo.raggiunto,
        riferimento: deliberativo.riferimento,
      };
    }),
    amministratore,
    generatoIl,
  });
}
