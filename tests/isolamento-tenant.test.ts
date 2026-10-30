// Test di isolamento tenant (THREAT-03 / COD-10 in docs/audit/01-codice.md
// e 04-threat-model.md): verificano con query REALI, autenticate, contro
// un progetto Supabase VERO (dedicato ai test, mai quello di produzione)
// che le policy RLS impediscano davvero a un condòmino o a un
// amministratore di leggere dati di un altro condominio.
//
// Prima di questa suite, l'unico modo per saperlo era leggere a mano le
// policy in supabase/schema.sql: è esattamente il motivo per cui
// THREAT-01 (impersonazione senza verifica reale di appartenenza) non è
// stato intercettato prima di un audit dedicato. Il test 5 qui sotto è
// la regressione diretta di quel bug.
//
// Richiede un progetto Supabase dedicato ai test, configurato in
// .env.test.local (SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY,
// SUPABASE_TEST_SERVICE_ROLE_KEY — vedi .env.test.local.example) con lo
// schema di supabase/schema.sql già applicato. Si lancia con
// `npm run test:isolamento`, separato da `npm run test` apposta: non
// deve bloccare chi clona il repo senza quel progetto configurato.

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL_TEST = process.env.SUPABASE_TEST_URL;
const ANON_TEST = process.env.SUPABASE_TEST_ANON_KEY;
const SERVICE_TEST = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const CONFIGURATO = Boolean(URL_TEST && ANON_TEST && SERVICE_TEST);

describe.skipIf(!CONFIGURATO)("isolamento tenant (progetto Supabase di test)", () => {
  const service: SupabaseClient = createClient(URL_TEST!, SERVICE_TEST!, {
    auth: { persistSession: false },
  });

  // Due "tenant" paralleli e indipendenti: ogni cosa con suffisso A
  // appartiene a un amministratore, ogni cosa con suffisso B a un altro.
  // Un'esecuzione di questa suite non deve mai lasciare residui: l'id
  // casuale nell'email evita collisioni tra esecuzioni consecutive.
  const suffisso = crypto.randomUUID().slice(0, 8);
  const PASSWORD = `Test-${crypto.randomUUID()}`;

  let adminAId: string, adminBId: string, condominoAId: string, condominoBId: string;
  let condominioAId: string, condominioBId: string;
  let unitaAId: string, unitaBId: string;
  let spesaAId: string;

  // CONT-02: un oggetto nello storage del condominio A, per verificare che
  // l'esportazione completa non possa leggerlo da un altro amministratore.
  // Non è dato per scontato che l'upload riesca (il bucket potrebbe non
  // esistere su un progetto di test incompleto): se fallisce, il caso di
  // prova lo dice invece di passare in silenzio.
  const percorsoDocumentoA = () => `condomini/${condominioAId}/isolamento-${suffisso}.txt`;
  let documentoACaricato = false;

  let clienteCondominoA: SupabaseClient;
  let clienteCondominoB: SupabaseClient;
  let clienteAdminA: SupabaseClient;
  let clienteAdminB: SupabaseClient;

  async function creaUtente(ruolo: "amministratore" | "condomino", lettera: "A" | "B") {
    // Il prefisso di ruolo è necessario: senza, amministratore-A e
    // condòmino-A finirebbero sulla stessa email ("test-a-...") e la
    // seconda createUser fallirebbe come "già registrata".
    const email = `test-${ruolo === "amministratore" ? "admin" : "cond"}-${lettera.toLowerCase()}-${suffisso}@example.com`;
    const { data, error } = await service.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { nome: "Test", cognome: lettera, ruolo },
    });
    if (error || !data.user) throw new Error(`Creazione utente di test fallita: ${error?.message}`);
    return { id: data.user.id, email };
  }

  async function accedi(email: string): Promise<SupabaseClient> {
    const cliente = createClient(URL_TEST!, ANON_TEST!, { auth: { persistSession: false } });
    const { error } = await cliente.auth.signInWithPassword({ email, password: PASSWORD });
    if (error) throw new Error(`Login di test fallito per ${email}: ${error.message}`);
    return cliente;
  }

  beforeAll(async () => {
    const adminA = await creaUtente("amministratore", "A");
    const adminB = await creaUtente("amministratore", "B");
    const condominoA = await creaUtente("condomino", "A");
    const condominoB = await creaUtente("condomino", "B");
    adminAId = adminA.id;
    adminBId = adminB.id;
    condominoAId = condominoA.id;
    condominoBId = condominoB.id;

    // Le tabelle di dominio si creano con la service role: questa suite
    // verifica l'isolamento in LETTURA (e la RPC di autorizzazione), non
    // le policy di scrittura — già verificate a mano in Fase 4.
    const { data: condomA, error: erroreCondomA } = await service
      .from("condomini")
      .insert({ nome: `Condominio Test A ${suffisso}`, indirizzo: "Via Test A 1", amministratore_id: adminAId })
      .select("id")
      .single();
    if (erroreCondomA || !condomA) throw new Error(`Setup condominio A fallito: ${erroreCondomA?.message}`);
    condominioAId = condomA.id;

    const { data: condomB, error: erroreCondomB } = await service
      .from("condomini")
      .insert({ nome: `Condominio Test B ${suffisso}`, indirizzo: "Via Test B 1", amministratore_id: adminBId })
      .select("id")
      .single();
    if (erroreCondomB || !condomB) throw new Error(`Setup condominio B fallito: ${erroreCondomB?.message}`);
    condominioBId = condomB.id;

    const { data: unitaA, error: erroreUnitaA } = await service
      .from("unita")
      .insert({ condominio_id: condominioAId, identificativo: "Interno 1", millesimi_proprieta: 500 })
      .select("id")
      .single();
    if (erroreUnitaA || !unitaA) throw new Error(`Setup unità A fallito: ${erroreUnitaA?.message}`);
    unitaAId = unitaA.id;

    const { data: unitaB, error: erroreUnitaB } = await service
      .from("unita")
      .insert({ condominio_id: condominioBId, identificativo: "Interno 1", millesimi_proprieta: 500 })
      .select("id")
      .single();
    if (erroreUnitaB || !unitaB) throw new Error(`Setup unità B fallito: ${erroreUnitaB?.message}`);
    unitaBId = unitaB.id;

    const { error: erroreLinkA } = await service
      .from("unita_proprietari")
      .insert({ unita_id: unitaAId, utente_id: condominoAId });
    if (erroreLinkA) throw new Error(`Collegamento condòmino A fallito: ${erroreLinkA.message}`);

    const { error: erroreLinkB } = await service
      .from("unita_proprietari")
      .insert({ unita_id: unitaBId, utente_id: condominoBId });
    if (erroreLinkB) throw new Error(`Collegamento condòmino B fallito: ${erroreLinkB.message}`);

    const { data: spesaA, error: erroreSpesaA } = await service
      .from("spese")
      .insert({
        condominio_id: condominioAId,
        descrizione: "Spesa riservata al condominio A",
        importo_totale: 123.45,
        categoria: "ordinaria",
        data_spesa: "2026-01-01",
      })
      .select("id")
      .single();
    if (erroreSpesaA || !spesaA) throw new Error(`Setup spesa A fallito: ${erroreSpesaA?.message}`);
    spesaAId = spesaA.id;

    const { error: erroreUpload } = await service.storage
      .from("documenti-condominio")
      .upload(percorsoDocumentoA(), new Blob(["documento riservato al condominio A"]), {
        contentType: "text/plain",
        upsert: true,
      });
    documentoACaricato = !erroreUpload;

    clienteCondominoA = await accedi(condominoA.email);
    clienteCondominoB = await accedi(condominoB.email);
    clienteAdminA = await accedi(adminA.email);
    clienteAdminB = await accedi(adminB.email);
  });

  afterAll(async () => {
    // Ordine importante: condomini prima (cascata su unita/
    // unita_proprietari/spese), poi gli utenti auth (cascata su
    // public.utenti) — altrimenti la FK condomini.amministratore_id
    // blocca la cancellazione dell'amministratore.
    if (documentoACaricato) {
      await service.storage
        .from("documenti-condominio")
        .remove([percorsoDocumentoA()])
        .catch(() => {});
    }
    await service.from("condomini").delete().in("id", [condominioAId, condominioBId]);
    for (const id of [adminAId, adminBId, condominoAId, condominoBId]) {
      await service.auth.admin.deleteUser(id).catch(() => {});
    }
  });

  test("un condòmino non vede il condominio di un altro amministratore", async () => {
    const { data, error } = await clienteCondominoA
      .from("condomini")
      .select("id")
      .eq("id", condominioBId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  test("un condòmino non vede un'unità di un condominio altrui", async () => {
    const { data, error } = await clienteCondominoA.from("unita").select("id").eq("id", unitaBId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  test("un condòmino non vede le spese di un condominio altrui, nemmeno conoscendone l'id", async () => {
    const { data, error } = await clienteCondominoB
      .from("spese")
      .select("id, descrizione")
      .eq("id", spesaAId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  test("un amministratore non vede il condominio di un altro amministratore", async () => {
    const { data, error } = await clienteAdminB.from("condomini").select("id").eq("id", condominioAId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  test("REGRESSIONE THREAT-01: un amministratore non può essere autorizzato a impersonare un condòmino non suo", async () => {
    const { data: nonAutorizzato, error: erroreNeg } = await clienteAdminB.rpc("admin_gestisce_utente", {
      utente: condominoAId,
    });
    expect(erroreNeg).toBeNull();
    expect(nonAutorizzato).toBe(false);

    // Controllo di non-regressione nella direzione opposta: l'amministratore
    // giusto deve continuare a poter gestire il proprio condòmino, altrimenti
    // il test sopra passerebbe solo perché la RPC è rotta per tutti.
    const { data: autorizzato, error: errorePos } = await clienteAdminA.rpc("admin_gestisce_utente", {
      utente: condominoAId,
    });
    expect(errorePos).toBeNull();
    expect(autorizzato).toBe(true);
  });

  test("un utente non autenticato non vede alcun condominio", async () => {
    const anonimo = createClient(URL_TEST!, ANON_TEST!, { auth: { persistSession: false } });
    const { data, error } = await anonimo.from("condomini").select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  // FEAT-02/FEAT-03: le funzioni security definer dietro al rendiconto e
  // allo stato patrimoniale del condòmino. A differenza delle select dirette
  // sopra, qui un accesso non autorizzato non restituisce "zero righe": la
  // funzione stessa alza un'eccezione (vedi i commenti nella migrazione in
  // supabase/schema.sql), quindi il test verifica l'errore, non un array vuoto.
  test("un condòmino non può ottenere il rendiconto di un condominio che non è il suo", async () => {
    const { data, error } = await clienteCondominoB.rpc("condominio_rendiconto_quote", {
      p_condominio_id: condominioAId,
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  test("un amministratore non può ottenere il rendiconto di un condominio che non è il suo", async () => {
    const { data, error } = await clienteAdminB.rpc("condominio_rendiconto_quote", {
      p_condominio_id: condominioAId,
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  test("un condòmino non può leggere i soggetti collegati a un'unità che non è la sua", async () => {
    const { data, error } = await clienteCondominoB.rpc("unita_soggetti", {
      p_unita_id: unitaAId,
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  test("controllo positivo: il condòmino giusto ottiene davvero il proprio rendiconto e i propri soggetti", async () => {
    const { data: quote, error: erroreQuote } = await clienteCondominoA.rpc(
      "condominio_rendiconto_quote",
      { p_condominio_id: condominioAId }
    );
    expect(erroreQuote).toBeNull();
    expect(Array.isArray(quote)).toBe(true);

    const { data: soggetti, error: erroreSoggetti } = await clienteCondominoA.rpc(
      "unita_soggetti",
      { p_unita_id: unitaAId }
    );
    expect(erroreSoggetti).toBeNull();
    expect(Array.isArray(soggetti)).toBe(true);
  });

  // CONT-02: l'esportazione completa dei dati di un condominio
  // (`/admin/condomini/[id]/esportazione`). È la route che legge più dati di
  // tutte — ogni riga e ogni documento di uno stabile in una richiesta — e
  // non è provabile in isolamento perché vive dentro Next e ha bisogno di una
  // sessione via cookie. Si provano quindi le DUE cose su cui si appoggia:
  // la query di verifica della proprietà che la route esegue prima di
  // raccogliere qualsiasi cosa, e la RLS sulle tabelle e sullo storage che
  // raccoglie poi.
  test("CONT-02: un amministratore non può esportare il condominio di un altro amministratore", async () => {
    // 1) La query di verifica, identica a quella della route: id del
    //    condominio e amministratore in sessione nello stesso filtro.
    const { data: verifica, error: erroreVerifica } = await clienteAdminB
      .from("condomini")
      .select("id")
      .eq("id", condominioAId)
      .eq("amministratore_id", adminBId)
      .maybeSingle();
    expect(erroreVerifica).toBeNull();
    expect(verifica).toBeNull();

    // 2) Lo stesso filtro con l'id dell'amministratore GIUSTO al posto del
    //    proprio: è la manomissione ovvia, e deve restare senza effetto
    //    perché la riga non è visibile alla sessione di B in nessun caso.
    const { data: conIdAltrui } = await clienteAdminB
      .from("condomini")
      .select("id")
      .eq("id", condominioAId)
      .eq("amministratore_id", adminAId);
    expect(conIdAltrui).toEqual([]);

    // 3) Le tabelle che l'esportazione legge: anche saltando la verifica,
    //    non c'è nulla da portare via. Una per tabella "radice" (filtrata
    //    per condominio) e una per tabella "figlia" (filtrata per id del
    //    padre), perché sono due catene di policy diverse.
    const { data: unitaAltrui } = await clienteAdminB
      .from("unita")
      .select("id")
      .eq("condominio_id", condominioAId);
    expect(unitaAltrui).toEqual([]);

    const { data: ripartizioniAltrui } = await clienteAdminB
      .from("ripartizioni")
      .select("id")
      .eq("spesa_id", spesaAId);
    expect(ripartizioniAltrui).toEqual([]);

    // 4) Lo storage: l'esportazione scarica i documenti con la sessione
    //    dell'utente, quindi la policy "documenti_select" è l'ultima
    //    barriera. Il prefisso "condomini/{id}/" risale a
    //    admin_possiede_condominio.
    expect(
      documentoACaricato,
      "Upload di prova nel bucket documenti-condominio non riuscito: " +
        "verifica che supabase/schema.sql sia applicato sul progetto di test."
    ).toBe(true);

    const { data: scaricatoDaB, error: erroreDaB } = await clienteAdminB.storage
      .from("documenti-condominio")
      .download(percorsoDocumentoA());
    expect(scaricatoDaB).toBeNull();
    expect(erroreDaB).not.toBeNull();

    const { data: elencoDaB } = await clienteAdminB.storage
      .from("documenti-condominio")
      .list(`condomini/${condominioAId}`);
    expect(elencoDaB ?? []).toEqual([]);

    // 5) Controllo positivo: l'amministratore giusto deve passare tutti e
    //    quattro i passaggi, altrimenti i test sopra passerebbero solo
    //    perché l'esportazione è rotta per tutti.
    const { data: proprio } = await clienteAdminA
      .from("condomini")
      .select("id")
      .eq("id", condominioAId)
      .eq("amministratore_id", adminAId)
      .maybeSingle();
    expect(proprio?.id).toBe(condominioAId);

    const { data: unitaProprie } = await clienteAdminA
      .from("unita")
      .select("id")
      .eq("condominio_id", condominioAId);
    expect(unitaProprie?.length).toBe(1);

    const { data: scaricatoDaA, error: erroreDaA } = await clienteAdminA.storage
      .from("documenti-condominio")
      .download(percorsoDocumentoA());
    expect(erroreDaA).toBeNull();
    expect(scaricatoDaA).not.toBeNull();
  });
});
