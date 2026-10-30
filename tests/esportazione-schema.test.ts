// Conformità delle colonne dell'esportazione (CONT-02) allo schema reale.
//
// PERCHÉ QUESTO TEST ESISTE. L'errore n. 3 di CLAUDE.md: non esiste un tipo
// `Database` generato, quindi una stringa di `select()` con un nome di colonna
// sbagliato compila senza problemi e fallisce solo a runtime. L'esportazione
// dichiara a mano le colonne di ventisette tabelle: è esattamente il tipo di
// codice in cui quell'errore passa inosservato, e si manifesterebbe la prima
// volta che un amministratore prova a scaricare il suo archivio — cioè quando
// sta lasciando il servizio e ha meno margine di tutti per riprovare.
//
// Il controllo è una `select` delle colonne dichiarate con `limit 0`: non
// legge nessun dato e non scrive nulla, ma PostgREST rifiuta la richiesta se
// una colonna non esiste. Gira contro il progetto Supabase dedicato ai test
// (`npm run test:isolamento`), con la service role perché qui interessa lo
// schema, non le policy — l'isolamento è verificato in isolamento-tenant.test.ts.

import { describe, expect, test } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  TABELLE_CONDOMINIO,
  TABELLE_FIGLIE,
  tabellaDi,
} from "@/app/admin/condomini/[id]/esportazione-dati";

const URL_TEST = process.env.SUPABASE_TEST_URL;
const SERVICE_TEST = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const CONFIGURATO = Boolean(URL_TEST && SERVICE_TEST);

describe.skipIf(!CONFIGURATO)("esportazione: colonne dichiarate vs schema reale", () => {
  const service: SupabaseClient = createClient(URL_TEST!, SERVICE_TEST!, {
    auth: { persistSession: false },
  });

  const tutte = [...TABELLE_CONDOMINIO, ...TABELLE_FIGLIE];

  test.for(tutte.map((t) => [t.nome, t] as const))(
    "dati/%s.csv: tutte le colonne esistono e sono ordinabili",
    async ([, tabella]) => {
      const { error } = await service
        .from(tabellaDi(tabella))
        .select(tabella.colonne.join(", "))
        .order(tabella.ordine, { ascending: true })
        .limit(0);

      // Il messaggio dice anche l'altra causa possibile, che non è un errore
      // di codice: `supabase/schema.sql` si applica a mano (nessuna CLI,
      // nessun migration runner — vedi CLAUDE.md), quindi un blocco di
      // migrazione non ancora eseguito sul progetto di test si manifesta
      // esattamente così, come colonna o tabella inesistente.
      expect(
        error,
        `${tabellaDi(tabella)}: ${error?.message ?? ""}\n` +
          "Se la colonna/tabella manca, verifica di aver applicato TUTTI i blocchi " +
          "in fondo a supabase/schema.sql sul progetto Supabase di test prima di " +
          "cercare l'errore in esportazione-dati.ts."
      ).toBeNull();
    }
  );

  test("la colonna del padre esiste su ogni tabella figlia", async () => {
    for (const tabella of TABELLE_FIGLIE) {
      const { error } = await service
        .from(tabellaDi(tabella))
        .select("id")
        .in(tabella.colonnaPadre, [])
        .limit(0);
      expect(error, `${tabella.nome}.${tabella.colonnaPadre}: ${error?.message ?? ""}`).toBeNull();
    }
  });

  test("nessuna colonna segreta finisce nell'archivio", () => {
    // Regressione su una scelta che si potrebbe perdere riscrivendo gli
    // elenchi: `firme_verbale.token` apre il link pubblico di firma e
    // `otp_hash` è l'impronta del codice usa-e-getta. Un `select("*")` o un
    // copia-incolla distratto li rimetterebbe dentro.
    const vietate = ["token", "otp_hash", "otp_scadenza", "otp_tentativi"];
    for (const tabella of tutte) {
      for (const vietata of vietate) {
        expect(tabella.colonne, `${tabella.nome}`).not.toContain(vietata);
      }
    }
  });
});
