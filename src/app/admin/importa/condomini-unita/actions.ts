"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { richiedeAmministratore } from "@/lib/supabase/dal";
import { messaggioErrore } from "@/lib/errori";
import { validaRigaCondominioUnita } from "@/lib/import/validazione";
import { preparaRighePersone } from "@/lib/import/collassa";
import { normalizzaQualifica } from "@/lib/import/qualifica";
import type { ErroreRiga, RigaImportCondominioUnita, RigaMillesimo } from "@/lib/import/tipi";

export type EsitoImportCondominiUnita =
  | {
      ok: true;
      condominiCreati: number;
      condominiRiusati: number;
      unitaCreate: number;
      personeCreate: number;
    }
  | { ok: false; erroreGenerale: string; erroriRiga?: undefined }
  | { ok: false; erroriRiga: ErroreRiga[]; erroreGenerale?: undefined };

const MAX_RIGHE_IMPORT = 5000;

export async function importaCondominiUnita(
  righeInput: RigaImportCondominioUnita[],
  millesimiInput: RigaMillesimo[],
  nomeFile: string
): Promise<EsitoImportCondominiUnita> {
  if (!righeInput.length) return { ok: false, erroreGenerale: "Nessuna riga da importare." };

  // Rinormalizza lato server (nome del condominio derivato dall'indirizzo se
  // assente + scarto delle righe di coda): non ci si fida della sola
  // preparazione lato client. Le righe restano "per persona": la funzione DB
  // raggruppa le unità e crea condomìni, unità, anagrafiche e legami.
  const righe = preparaRighePersone(righeInput);

  if (righe.length > MAX_RIGHE_IMPORT) {
    return { ok: false, erroreGenerale: `Troppe righe (massimo ${MAX_RIGHE_IMPORT}).` };
  }

  const erroriRiga = righe
    .map((r, indice) => ({ indice, messaggio: validaRigaCondominioUnita(r) }))
    .filter((e): e is ErroreRiga => e.messaggio !== null);
  if (erroriRiga.length) return { ok: false, erroriRiga };

  // Normalizza la qualifica grezza (es. "Ex proprietario") nei valori che il
  // database accetta, e passa NaN → null così i numeri mancanti diventano
  // NULL nel JSON inviato alla funzione.
  const payload = righe.map((r) => {
    const haPersona = Boolean(r.nominativo && r.nominativo.trim());
    const { tipoSoggetto, attivo } = normalizzaQualifica(r.qualifica);
    return {
      nomeCondominio: r.nomeCondominio,
      indirizzoCondominio: r.indirizzoCondominio,
      codiceFiscaleCondominio: r.codiceFiscaleCondominio,
      identificativo: r.identificativo,
      piano: r.piano,
      millesimiProprieta: Number.isNaN(r.millesimiProprieta) ? null : r.millesimiProprieta,
      nominativo: haPersona ? r.nominativo : null,
      email: r.email,
      tipoSoggetto: haPersona ? tipoSoggetto : null,
      quota: Number.isNaN(r.quota) ? null : r.quota,
      attivo,
    };
  });

  // COD-04: `auth.getUser()` controllava la sessione ma non il ruolo, e un
  // non-amministratore si fermava solo alla RLS (o al `raise exception` della
  // funzione di import) con un errore di database per messaggio. Qui il
  // controllo è esplicito e, se non passa, porta al login o alla propria area.
  const amministratore = await richiedeAmministratore();
  const supabase = await createClient();

  const { data: batch, error: erroreBatch } = await supabase
    .from("import_batches")
    .insert({
      condominio_id: null,
      tipo: "condomini_unita",
      nome_file: nomeFile,
      creato_da: amministratore.id,
    })
    .select("id")
    .single();
  if (erroreBatch || !batch) {
    return {
      ok: false,
      erroreGenerale: erroreBatch
        ? messaggioErrore(erroreBatch, "admin/importa/importaCondominiUnita")
        : "Impossibile registrare l'importazione: riprova.",
    };
  }

  const { data, error } = await supabase.rpc("importa_condomini_unita_persone", {
    p_batch_id: batch.id,
    p_righe: payload,
    p_millesimi: millesimiInput,
  });

  if (error) {
    await supabase.from("import_batches").delete().eq("id", batch.id);
    return {
      ok: false, erroreGenerale: messaggioErrore(error, "admin/importa/importaCondominiUnita"),
    };
  }

  const risultato = data?.[0] as
    | {
        condomini_creati: number;
        condomini_riusati: number;
        unita_create: number;
        persone_create: number;
      }
    | undefined;

  await supabase
    .from("import_batches")
    .update({ righe_importate: righe.length })
    .eq("id", batch.id);

  revalidatePath("/admin/condomini");
  revalidatePath("/admin/importa");

  return {
    ok: true,
    condominiCreati: risultato?.condomini_creati ?? 0,
    condominiRiusati: risultato?.condomini_riusati ?? 0,
    unitaCreate: risultato?.unita_create ?? 0,
    personeCreate: risultato?.persone_create ?? 0,
  };
}
