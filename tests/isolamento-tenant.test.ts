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
});
