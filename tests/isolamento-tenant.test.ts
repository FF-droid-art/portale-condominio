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

  // COD-05: il contatore dei tentativi di autenticazione. Non è una
  // tabella multi-tenant (non ha un condominio_id), ma è una tabella che
  // nessun utente del portale deve poter leggere né scrivere: chi potesse
  // azzerarla aggirerebbe il rate limiter sul proprio login, chi potesse
  // leggerla saprebbe quali impronte hanno tentato di accedere. La RLS è
  // attiva senza nessuna policy e le funzioni sono concesse solo a
  // service_role: è esattamente quello che questo caso verifica, invece di
  // darlo per buono leggendo la migrazione.
  test("COD-05: il contatore dei tentativi non è leggibile, scrivibile né azzerabile da un utente", async () => {
    const chiave = `isolamento-${suffisso}`;

    // 1) Controllo positivo con la service role: la funzione esiste, conta
    //    e blocca. Se questo fallisce, la migrazione non è stata applicata
    //    sul progetto di test e i controlli negativi sotto passerebbero
    //    solo perché non c'è niente da proteggere.
    const registra = (massimo: number) =>
      service.rpc("registra_tentativo_autenticazione", {
        p_azione: "login",
        p_chiave: chiave,
        p_finestra_minuti: 10,
        p_massimo: massimo,
      });

    const { data: primo, error: errorePrimo } = await registra(2);
    expect(
      errorePrimo,
      "registra_tentativo_autenticazione non disponibile: applica la migrazione COD-05 di supabase/schema.sql sul progetto di test."
    ).toBeNull();
    expect(primo?.[0]?.bloccato).toBe(false);
    expect(primo?.[0]?.tentativi).toBe(1);

    const { data: secondo } = await registra(2);
    expect(secondo?.[0]?.bloccato).toBe(true);
    expect(secondo?.[0]?.tentativi).toBe(2);

    // Un terzo tentativo a blocco già attivo non si registra: il blocco non
    // si autoalimenta e la tabella non cresce a ogni clic.
    const { data: terzo } = await registra(2);
    expect(terzo?.[0]?.bloccato).toBe(true);
    expect(terzo?.[0]?.tentativi).toBe(2);

    // 2) Un condòmino autenticato non legge nulla e non scrive nulla.
    const { data: letti, error: erroreLettura } = await clienteCondominoA
      .from("tentativi_autenticazione")
      .select("id, azione, chiave");
    // Con RLS attiva e nessuna policy la select non è un errore: è vuota.
    expect(erroreLettura ? [] : (letti ?? [])).toEqual([]);

    const { error: erroreInserimento } = await clienteCondominoA
      .from("tentativi_autenticazione")
      .insert({ azione: "login", chiave });
    expect(erroreInserimento).not.toBeNull();

    // 3) Le funzioni non sono eseguibili da un utente qualunque, né da chi
    //    non è autenticato: altrimenti basterebbe conoscere la chiave per
    //    azzerare i propri tentativi.
    const { error: erroreAzzeraUtente } = await clienteCondominoA.rpc(
      "azzera_tentativi_autenticazione",
      { p_azione: "login", p_chiave: chiave }
    );
    expect(erroreAzzeraUtente).not.toBeNull();

    const { error: erroreRegistraUtente } = await clienteCondominoA.rpc(
      "registra_tentativo_autenticazione",
      { p_azione: "login", p_chiave: chiave, p_finestra_minuti: 10, p_massimo: 2 }
    );
    expect(erroreRegistraUtente).not.toBeNull();

    const anonimo = createClient(URL_TEST!, ANON_TEST!, { auth: { persistSession: false } });
    const { error: erroreAnonimo } = await anonimo.rpc("azzera_tentativi_autenticazione", {
      p_azione: "login",
      p_chiave: chiave,
    });
    expect(erroreAnonimo).not.toBeNull();

    // 4) Il blocco è ancora in piedi: nessuno dei tentativi sopra l'ha
    //    sciolto. Poi si azzera con la service role, come fa il login dopo
    //    un accesso riuscito, e si verifica che riparta da uno.
    const { data: dopoTentativi } = await registra(2);
    expect(dopoTentativi?.[0]?.bloccato).toBe(true);

    const { error: erroreAzzera } = await service.rpc("azzera_tentativi_autenticazione", {
      p_azione: "login",
      p_chiave: chiave,
    });
    expect(erroreAzzera).toBeNull();

    const { data: dopoAzzeramento } = await registra(2);
    expect(dopoAzzeramento?.[0]?.bloccato).toBe(false);
    expect(dopoAzzeramento?.[0]?.tentativi).toBe(1);

    await service.rpc("azzera_tentativi_autenticazione", {
      p_azione: "login",
      p_chiave: chiave,
    });
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

  /* ======================================================================
     Codici di invito per unità (`inviti_unita`).

     Il codice di invito è una credenziale: chi lo ha può collegare un
     account appena creato a quell'unità, e quindi vedere i dati di quel
     condominio. Deve essere leggibile dal solo amministratore che possiede
     il condominio dell'unità — non dai condòmini (nemmeno il proprio: sono
     già collegati, e un codice in mano a chi non deve distribuirlo è un
     codice che gira), non dagli altri amministratori, non da chi non è
     autenticato.

     L'unica via pubblica è `valida_codice_invito`, che restituisce due soli
     campi non sensibili e serve al riscontro nel form di registrazione.

     Se questi test segnalano che la tabella o le funzioni non esistono,
     manca l'ultimo blocco di supabase/schema.sql ("Migrazione: codice di
     invito per unità") sul progetto di test: va applicato a mano nel SQL
     Editor, come tutte le migrazioni di questo progetto.
     ====================================================================== */

  const ALFABETO_INVITO = /^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$/;

  async function codiceDiUnita(unitaId: string): Promise<string> {
    const { data, error } = await service
      .from("inviti_unita")
      .select("codice")
      .eq("unita_id", unitaId)
      .maybeSingle();
    expect(
      error,
      "Tabella inviti_unita non disponibile: applica il blocco «Migrazione: codice di invito per unità» di supabase/schema.sql sul progetto di test."
    ).toBeNull();
    expect(data?.codice, `Nessun codice di invito per l'unità ${unitaId}`).toBeTruthy();
    return data!.codice as string;
  }

  test("il trigger genera da sé il codice di invito di ogni unità, da qualunque percorso nasca", async () => {
    // Le unità del setup sono state create con la service role e nessuna
    // riga di `inviti_unita` è stata scritta dal test: se il codice c'è, è
    // il trigger `trg_unita_crea_invito` ad averlo messo.
    for (const unitaId of [unitaAId, unitaBId]) {
      const codice = await codiceDiUnita(unitaId);
      expect(codice).toMatch(ALFABETO_INVITO);
    }

    // Due unità diverse non condividono il codice: è l'intero senso di
    // avere un codice per unità invece di uno per condominio.
    expect(await codiceDiUnita(unitaAId)).not.toBe(await codiceDiUnita(unitaBId));

    // E un'unità creata adesso, senza che l'applicazione faccia nulla.
    const { data: nuova, error: erroreNuova } = await service
      .from("unita")
      .insert({
        condominio_id: condominioBId,
        identificativo: `Interno trigger ${suffisso}`,
        millesimi_proprieta: 1,
      })
      .select("id")
      .single();
    expect(erroreNuova).toBeNull();

    try {
      const codiceNuovo = await codiceDiUnita(nuova!.id);
      expect(codiceNuovo).toMatch(ALFABETO_INVITO);

      // La funzione pubblica lo riconosce, anche scritto come lo si
      // ricopia da un foglio: con il trattino e in minuscolo.
      const anonimo = createClient(URL_TEST!, ANON_TEST!, { auth: { persistSession: false } });
      const comeDigitato = `${codiceNuovo.slice(0, 4)}-${codiceNuovo.slice(4)}`.toLowerCase();
      const { data: validazione, error: erroreValidazione } = await anonimo.rpc(
        "valida_codice_invito",
        { p_codice: comeDigitato }
      );
      expect(erroreValidazione).toBeNull();
      expect(validazione?.[0]?.valido).toBe(true);
      expect(validazione?.[0]?.condominio_nome).toBe(`Condominio Test B ${suffisso}`);
      expect(validazione?.[0]?.unita_identificativo).toBe(`Interno trigger ${suffisso}`);
      // Nient'altro: nessun id, nessun indirizzo, nessun dato su chi abita lì.
      expect(Object.keys(validazione?.[0] ?? {}).sort()).toEqual([
        "condominio_nome",
        "unita_identificativo",
        "valido",
      ]);

      // Un codice inesistente non è un errore: è "non valido" e basta,
      // senza dire niente di più a chi sta provando.
      const { data: inesistente, error: erroreInesistente } = await anonimo.rpc(
        "valida_codice_invito",
        { p_codice: "ZZZZ-ZZZZ" }
      );
      expect(erroreInesistente).toBeNull();
      expect(inesistente?.[0]?.valido).toBe(false);
      expect(inesistente?.[0]?.condominio_nome).toBeNull();
    } finally {
      // L'unità di prova non deve restare: un altro caso di questa suite
      // conta le unità dei due condomìni.
      await service.from("unita").delete().eq("id", nuova!.id);
    }
  });

  test("un condòmino non può leggere i codici di invito, nemmeno quello della propria unità", async () => {
    const codiceA = await codiceDiUnita(unitaAId);

    // 1) Select diretta sulla tabella: niente, in nessuna forma. Con RLS
    //    attiva e nessuna policy per il condòmino la select non è un
    //    errore, è vuota — quindi si accettano entrambi gli esiti ma non
    //    una riga.
    const { data: tutti, error: erroreTutti } = await clienteCondominoA
      .from("inviti_unita")
      .select("codice, unita_id");
    expect(erroreTutti ? [] : (tutti ?? [])).toEqual([]);

    // 2) Nemmeno filtrando per la PROPRIA unità: il condòmino A possiede
    //    l'unità A, ma il codice non è un dato che gli serve.
    const { data: propria, error: errorePropria } = await clienteCondominoA
      .from("inviti_unita")
      .select("codice")
      .eq("unita_id", unitaAId);
    expect(errorePropria ? [] : (propria ?? [])).toEqual([]);

    // 3) Né per quella di un altro condominio.
    const { data: altrui, error: erroreAltrui } = await clienteCondominoA
      .from("inviti_unita")
      .select("codice")
      .eq("unita_id", unitaBId);
    expect(erroreAltrui ? [] : (altrui ?? [])).toEqual([]);

    // 4) Nemmeno conoscendo il codice: cercarlo per valore non lo
    //    conferma. È il filtro che un attaccante proverebbe avendo in mano
    //    un codice e volendo sapere a che unità appartiene.
    const { data: perCodice, error: errorePerCodice } = await clienteCondominoA
      .from("inviti_unita")
      .select("unita_id")
      .eq("codice", codiceA);
    expect(errorePerCodice ? [] : (perCodice ?? [])).toEqual([]);

    // 5) Chi non è autenticato, uguale.
    const anonimo = createClient(URL_TEST!, ANON_TEST!, { auth: { persistSession: false } });
    const { data: daAnonimo, error: erroreAnonimo } = await anonimo
      .from("inviti_unita")
      .select("codice");
    expect(erroreAnonimo ? [] : (daAnonimo ?? [])).toEqual([]);

    // 6) E non può scriverne uno: un condòmino che potesse inserire una
    //    riga si fabbricherebbe l'accesso a un'unità qualunque.
    const { error: erroreInserimento } = await clienteCondominoA
      .from("inviti_unita")
      .insert({ unita_id: unitaBId, codice: `ZZZZ${suffisso.slice(0, 4).toUpperCase()}` });
    expect(erroreInserimento).not.toBeNull();

    // 7) Controllo positivo: l'amministratore del condominio A lo legge
    //    davvero, altrimenti i sei controlli sopra passerebbero anche se la
    //    tabella fosse inaccessibile a tutti.
    const { data: perAdmin, error: errorePerAdmin } = await clienteAdminA
      .from("inviti_unita")
      .select("codice")
      .eq("unita_id", unitaAId)
      .maybeSingle();
    expect(errorePerAdmin).toBeNull();
    expect(perAdmin?.codice).toBe(codiceA);
  });

  test("un amministratore non può leggere né rigenerare il codice di un'unità che non è sua", async () => {
    const codiceA = await codiceDiUnita(unitaAId);

    // 1) Lettura dell'unità altrui: zero righe, anche conoscendone l'id.
    const { data: letti, error: erroreLettura } = await clienteAdminB
      .from("inviti_unita")
      .select("codice")
      .eq("unita_id", unitaAId);
    expect(erroreLettura ? [] : (letti ?? [])).toEqual([]);

    // 2) Rigenerazione dell'unità altrui: la funzione è `security definer`,
    //    quindi qui non basta che la RLS non restituisca righe — la
    //    verifica di appartenenza dentro la funzione deve alzare
    //    un'eccezione, altrimenti un amministratore qualunque potrebbe
    //    invalidare a comando i codici di uno stabile non suo.
    const { error: erroreRigenera } = await clienteAdminB.rpc("rigenera_codice_invito", {
      p_unita_id: unitaAId,
    });
    expect(erroreRigenera).not.toBeNull();

    // 3) Backfill di un condominio altrui: stesso discorso.
    const { error: erroreBackfill } = await clienteAdminB.rpc("genera_codici_invito_mancanti", {
      p_condominio_id: condominioAId,
    });
    expect(erroreBackfill).not.toBeNull();

    // 4) Il codice di A è rimasto quello di prima: nessuno dei tentativi
    //    sopra ha avuto effetto.
    expect(await codiceDiUnita(unitaAId)).toBe(codiceA);

    // 5) Un condòmino non può chiamare nessuna delle due funzioni.
    const { error: erroreRigeneraCondomino } = await clienteCondominoA.rpc(
      "rigenera_codice_invito",
      { p_unita_id: unitaAId }
    );
    expect(erroreRigeneraCondomino).not.toBeNull();

    // 6) Controllo positivo: l'amministratore giusto rigenera, ottiene un
    //    codice nuovo e il precedente smette di valere nello stesso
    //    istante — che è il motivo per cui si rigenera.
    const { data: nuovoCodice, error: erroreRigeneraA } = await clienteAdminA.rpc(
      "rigenera_codice_invito",
      { p_unita_id: unitaAId }
    );
    expect(erroreRigeneraA).toBeNull();
    expect(nuovoCodice).toMatch(ALFABETO_INVITO);
    expect(nuovoCodice).not.toBe(codiceA);

    const anonimo = createClient(URL_TEST!, ANON_TEST!, { auth: { persistSession: false } });
    const { data: vecchio } = await anonimo.rpc("valida_codice_invito", { p_codice: codiceA });
    expect(vecchio?.[0]?.valido).toBe(false);
    const { data: corrente } = await anonimo.rpc("valida_codice_invito", {
      p_codice: nuovoCodice,
    });
    expect(corrente?.[0]?.valido).toBe(true);
  });

  test("chi si registra con un codice di invito risulta collegato alla propria unità", async () => {
    // È il punto di tutta la funzionalità: il collegamento lo fa il trigger
    // `handle_new_user` lato database, perché con la conferma email
    // obbligatoria subito dopo signUp() non esiste ancora una sessione.
    const codiceB = await codiceDiUnita(unitaBId);
    const email = `test-invito-${suffisso}@example.com`;

    const { data: creato, error: erroreCreazione } = await service.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: {
        nome: "Nuovo",
        cognome: "Condòmino",
        ruolo: "condomino",
        // Come lo passa la server action di registrazione, ma scritto come
        // lo digita una persona: con il trattino e in minuscolo.
        codice_invito: `${codiceB.slice(0, 4)}-${codiceB.slice(4)}`.toLowerCase(),
      },
    });
    expect(erroreCreazione).toBeNull();
    const nuovoUtenteId = creato?.user?.id;
    expect(nuovoUtenteId).toBeTruthy();

    try {
      const { data: legami, error: erroreLegami } = await service
        .from("unita_proprietari")
        .select("unita_id, quota_possesso, tipo_soggetto")
        .eq("utente_id", nuovoUtenteId!);
      expect(erroreLegami).toBeNull();
      expect(legami?.length).toBe(1);
      expect(legami?.[0]?.unita_id).toBe(unitaBId);
      // Default esistenti, non toccati: il limite noto è che con più
      // comproprietari la somma delle quote va corretta a mano.
      expect(Number(legami?.[0]?.quota_possesso)).toBe(100);
      expect(legami?.[0]?.tipo_soggetto).toBe("proprietario");
    } finally {
      if (nuovoUtenteId) await service.auth.admin.deleteUser(nuovoUtenteId).catch(() => {});
    }
  });

  test("un codice inesistente non impedisce la registrazione, la lascia solo senza collegamento", async () => {
    // Il caso della lettera ricopiata male. L'account deve nascere comunque:
    // l'amministratore potrà collegare la persona a mano, come si faceva
    // prima dei codici.
    const email = `test-invito-ko-${suffisso}@example.com`;
    const { data: creato, error: erroreCreazione } = await service.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: {
        nome: "Codice",
        cognome: "Sbagliato",
        ruolo: "condomino",
        codice_invito: "ZZZZ-ZZZZ",
      },
    });
    expect(erroreCreazione).toBeNull();
    const utenteSenzaLegameId = creato?.user?.id;
    expect(utenteSenzaLegameId).toBeTruthy();

    try {
      const { data: utente } = await service
        .from("utenti")
        .select("ruolo")
        .eq("id", utenteSenzaLegameId!)
        .maybeSingle();
      expect(utente?.ruolo).toBe("condomino");

      const { data: legami } = await service
        .from("unita_proprietari")
        .select("id")
        .eq("utente_id", utenteSenzaLegameId!);
      expect(legami ?? []).toEqual([]);
    } finally {
      if (utenteSenzaLegameId) {
        await service.auth.admin.deleteUser(utenteSenzaLegameId).catch(() => {});
      }
    }
  });
});
