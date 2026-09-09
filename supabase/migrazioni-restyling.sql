-- ============================================================
-- migrazioni-restyling.sql
-- Porta il database Supabase allo schema del branch `restyling`
-- (feature wave A + B + C). Estratto letterale da supabase/schema.sql,
-- righe 1917 -> fine.
--
-- COME USARLO: Supabase -> SQL Editor -> incolla tutto -> Run.
-- E' idempotente (usa "if not exists" / "drop ... if exists"):
-- puoi rieseguirlo senza creare doppioni.
-- ============================================================

-- ============================================================
-- Migrazione: assemblee (quorum live, documenti, firma leggera)
--             e sondaggi/consultazioni rapide
-- Da applicare manualmente su Supabase (SQL Editor). Idempotente.
--
-- Copre quattro funzionalità che condividono lo stesso dominio
-- "assemblee & governance":
--
--  1) QUORUM LIVE (art. 1136 c.c.). Le soglie dipendono dalla
--     convocazione, che finora non era registrata da nessuna parte:
--     si aggiunge "assemblee.convocazione". La tabella "presenze"
--     esisteva già in schema ma non era usata da nessuna pagina;
--     viene resa utilizzabile dall'amministratore anche per le unità
--     il cui proprietario non ha un account di login (utente_id
--     diventa opzionale, come già accaduto per unita_proprietari con
--     l'arrivo delle anagrafiche).
--     I conteggi per TESTA dei voti (non solo i millesimi) servono al
--     calcolo della "maggioranza degli intervenuti": si aggiungono le
--     colonne tally_n_* su punti_odg, mantenute dallo stesso trigger
--     che già aggiorna i tally in millesimi, così viaggiano anche
--     sugli eventi realtime già pubblicati per quella tabella.
--
--  2) DOCUMENTI GENERATI (convocazione e verbale). Serve solo il
--     luogo dell'assemblea: il resto dei dati esiste già. I PDF
--     generati finiscono nel bucket "documenti-condominio" sotto
--     "assemblee/{id}/...", già coperto dalle policy esistenti.
--
--  3) FIRMA LEGGERA DEL VERBALE: nuova tabella "firme_verbale".
--     NON è una firma elettronica con valore legale (vedi
--     IDEE-FUTURE.md): traccia solo che la persona indicata ha
--     confermato il documento digitando un codice usa-e-getta
--     ricevuto per email. Il codice non è mai in chiaro nel
--     database, se ne conserva solo l'impronta SHA-256.
--
--  4) SONDAGGI: consultazioni rapide fuori assemblea. La risposta è
--     per UNITÀ (una unità = una risposta) come i voti assembleari,
--     così il risultato può essere letto per teste o pesato per
--     millesimi.
--
-- Come per i voti, i dettagli individuali restano privati: le
-- funzioni *_risultati / *_riepilogo_* restituiscono solo aggregati e
-- sono richiamabili solo da chi appartiene al condominio o lo
-- amministra, sullo stesso modello di condominio_millesimi_totali.
-- ============================================================

-- 1) ASSEMBLEE: convocazione e luogo ---------------------------
alter table assemblee
  add column if not exists convocazione smallint not null default 1,
  add column if not exists luogo text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'assemblee_convocazione_check') then
    alter table assemblee
      add constraint assemblee_convocazione_check check (convocazione in (1, 2));
  end if;
end $$;

-- 2) PRESENZE: registrabili dall'amministratore anche senza account
--    collegato all'unità (proprietario presente solo in anagrafiche).
--    Le policy esistenti non cambiano: il ramo "amministratore" di
--    presenze_insert_condomino non guarda utente_id.
alter table presenze alter column utente_id drop not null;

alter table presenze
  add column if not exists registrata_da uuid references utenti(id),
  add column if not exists nota text;

-- 3) PUNTI_ODG: conteggio dei voti per testa, oltre ai millesimi.
alter table punti_odg
  add column if not exists tally_n_favorevole int not null default 0,
  add column if not exists tally_n_contrario int not null default 0,
  add column if not exists tally_n_astenuto int not null default 0;

-- Stesso trigger già esistente su "voti", esteso ai conteggi. Resta
-- security definer: chi vota non ha permesso di scrivere su punti_odg.
create or replace function aggiorna_tally_punto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_punto_id uuid := coalesce(new.punto_id, old.punto_id);
begin
  update punti_odg p
  set
    tally_favorevole = coalesce(s.favorevole, 0),
    tally_contrario = coalesce(s.contrario, 0),
    tally_astenuto = coalesce(s.astenuto, 0),
    tally_n_favorevole = coalesce(s.n_favorevole, 0),
    tally_n_contrario = coalesce(s.n_contrario, 0),
    tally_n_astenuto = coalesce(s.n_astenuto, 0)
  from (
    select
      sum(millesimi_rappresentati) filter (where scelta = 'favorevole') as favorevole,
      sum(millesimi_rappresentati) filter (where scelta = 'contrario') as contrario,
      sum(millesimi_rappresentati) filter (where scelta = 'astenuto') as astenuto,
      count(*) filter (where scelta = 'favorevole') as n_favorevole,
      count(*) filter (where scelta = 'contrario') as n_contrario,
      count(*) filter (where scelta = 'astenuto') as n_astenuto
    from voti
    where punto_id = v_punto_id
  ) s
  where p.id = v_punto_id;
  return null;
end;
$$;

-- Allineamento una tantum dei punti già votati prima di questa migrazione.
update punti_odg p
set
  tally_n_favorevole = coalesce(s.n_favorevole, 0),
  tally_n_contrario = coalesce(s.n_contrario, 0),
  tally_n_astenuto = coalesce(s.n_astenuto, 0)
from (
  select
    punto_id,
    count(*) filter (where scelta = 'favorevole') as n_favorevole,
    count(*) filter (where scelta = 'contrario') as n_contrario,
    count(*) filter (where scelta = 'astenuto') as n_astenuto
  from voti group by punto_id
) s
where p.id = s.punto_id;

-- 4) Riepilogo del quorum costitutivo -------------------------
-- Un condomino non può leggere le unità né le presenze altrui (policy
-- "unita_select" / "presenze_select"), quindi il conteggio degli
-- intervenuti va calcolato qui e restituito come solo aggregato.
--
-- Un'unità è "intervenuta" se ha una presenza ancora aperta (ora_uscita
-- nulla) oppure se ha delegato il proprio voto a un'unità a sua volta
-- presente: così i millesimi delegati sono contati una volta sola, senza
-- dipendere da come è stato riempito presenze.millesimi_rappresentati.
create or replace function public.assemblea_riepilogo_quorum(p_assemblea_id uuid)
returns table (
  unita_totali int,
  millesimi_totali numeric,
  unita_intervenute int,
  millesimi_intervenuti numeric,
  unita_presenti int,
  unita_rappresentate int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_condominio_id uuid;
begin
  select a.condominio_id into v_condominio_id from assemblee a where a.id = p_assemblea_id;
  if v_condominio_id is null then
    return;
  end if;
  if not (admin_possiede_condominio(v_condominio_id) or appartiene_condominio(v_condominio_id)) then
    raise exception 'Non autorizzato a leggere il quorum di questa assemblea.';
  end if;

  return query
  with presenti as (
    select distinct pr.unita_id
    from presenze pr
    where pr.assemblea_id = p_assemblea_id and pr.ora_uscita is null
  ),
  rappresentate as (
    select distinct d.unita_delegante_id as unita_id
    from deleghe d
    where d.assemblea_id = p_assemblea_id
      and d.unita_delegataria_id in (select unita_id from presenti)
      and d.unita_delegante_id not in (select unita_id from presenti)
  ),
  intervenute as (
    select unita_id from presenti
    union
    select unita_id from rappresentate
  )
  select
    (select count(*)::int from unita u where u.condominio_id = v_condominio_id),
    (select coalesce(sum(u.millesimi_proprieta), 0) from unita u where u.condominio_id = v_condominio_id),
    (select count(*)::int from intervenute),
    (select coalesce(sum(u.millesimi_proprieta), 0)
       from unita u join intervenute i on i.unita_id = u.id),
    (select count(*)::int from presenti),
    (select count(*)::int from rappresentate);
end;
$$;

grant execute on function assemblea_riepilogo_quorum(uuid) to authenticated;

-- 5) FIRME DEL VERBALE ----------------------------------------
create table if not exists firme_verbale (
  id uuid primary key default gen_random_uuid(),
  assemblea_id uuid not null references assemblee(id) on delete cascade,
  nominativo text not null,
  email text not null,
  ruolo text not null default 'altro'
    check (ruolo in ('presidente', 'segretario', 'amministratore', 'altro')),
  -- token opaco nel link di conferma inviato per email
  token text not null unique,
  -- impronta SHA-256 di "token:codice": il codice non è mai in chiaro
  otp_hash text,
  otp_scadenza timestamptz,
  otp_tentativi int not null default 0,
  otp_inviato_il timestamptz,
  richiesta_inviata_il timestamptz,
  confermato_il timestamptz,
  -- percorso del file effettivamente confermato: se il verbale viene
  -- sostituito, si vede che la conferma riguardava un'altra versione
  verbale_url_confermato text,
  created_at timestamptz not null default now(),
  unique (assemblea_id, email)
);

create index if not exists idx_firme_verbale_assemblea on firme_verbale(assemblea_id);

alter table firme_verbale enable row level security;

-- Solo l'amministratore dell'assemblea: la riga contiene il token e
-- l'impronta del codice, che un condomino non deve poter leggere.
-- I condòmini vedono chi ha confermato tramite firme_verbale_pubbliche.
-- Il flusso pubblico di conferma (chi riceve l'email può non avere un
-- account) passa dal client service-role lato server, come il webhook Stripe.
drop policy if exists "firme_verbale_admin" on firme_verbale;
create policy "firme_verbale_admin" on firme_verbale
  for all using (ruolo_corrente() = 'amministratore' and admin_gestisce_assemblea(assemblea_id))
  with check (ruolo_corrente() = 'amministratore' and admin_gestisce_assemblea(assemblea_id));

create or replace function public.firme_verbale_pubbliche(p_assemblea_id uuid)
returns table (
  nominativo text,
  ruolo text,
  richiesta_inviata boolean,
  confermato_il timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select f.nominativo, f.ruolo, f.richiesta_inviata_il is not null, f.confermato_il
  from firme_verbale f
  join assemblee a on a.id = f.assemblea_id
  where f.assemblea_id = p_assemblea_id
    and (admin_possiede_condominio(a.condominio_id) or appartiene_condominio(a.condominio_id))
  order by f.created_at;
$$;

grant execute on function firme_verbale_pubbliche(uuid) to authenticated;

-- 6) SONDAGGI --------------------------------------------------
create table if not exists sondaggi (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condomini(id) on delete cascade,
  domanda text not null,
  descrizione text,
  scadenza timestamptz,
  -- true: il risultato "in testa" si legge sui millesimi invece che sulle teste
  ponderato boolean not null default false,
  stato text not null default 'aperto' check (stato in ('aperto', 'chiuso')),
  creato_da uuid not null references utenti(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_sondaggi_condominio on sondaggi(condominio_id);

create table if not exists sondaggio_opzioni (
  id uuid primary key default gen_random_uuid(),
  sondaggio_id uuid not null references sondaggi(id) on delete cascade,
  testo text not null,
  ordine int not null default 1
);

create index if not exists idx_sondaggio_opzioni_sondaggio on sondaggio_opzioni(sondaggio_id);

create table if not exists sondaggio_risposte (
  id uuid primary key default gen_random_uuid(),
  sondaggio_id uuid not null references sondaggi(id) on delete cascade,
  opzione_id uuid not null references sondaggio_opzioni(id) on delete cascade,
  unita_id uuid not null references unita(id) on delete cascade,
  utente_id uuid not null references utenti(id) on delete cascade,
  -- snapshot dei millesimi al momento della risposta, come per "voti"
  millesimi_rappresentati numeric(7,3) not null default 0,
  created_at timestamptz not null default now(),
  -- una unità = una risposta, modificabile finché il sondaggio è aperto
  unique (sondaggio_id, unita_id)
);

create index if not exists idx_sondaggio_risposte_sondaggio on sondaggio_risposte(sondaggio_id);

alter table sondaggi enable row level security;
alter table sondaggio_opzioni enable row level security;
alter table sondaggio_risposte enable row level security;

-- Helper sullo stile di admin_gestisce_* già presenti in questo file.
create or replace function public.admin_gestisce_sondaggio(sondaggio uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.sondaggi s
    where s.id = sondaggio and admin_possiede_condominio(s.condominio_id)
  );
$$;

create or replace function public.sondaggio_visibile(sondaggio uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.sondaggi s
    where s.id = sondaggio
      and (admin_possiede_condominio(s.condominio_id) or appartiene_condominio(s.condominio_id))
  );
$$;

-- Una risposta è ammessa solo se il sondaggio è ancora aperto (e non
-- scaduto), l'opzione appartiene a quel sondaggio e l'unità appartiene al
-- condominio del sondaggio: controlli che non si possono esprimere con un
-- vincolo di tabella e che devono valere anche per le chiamate dirette
-- all'API, non solo per quelle che passano dall'interfaccia.
create or replace function public.sondaggio_risposta_ammessa(
  p_sondaggio_id uuid,
  p_opzione_id uuid,
  p_unita_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sondaggi s
    join public.sondaggio_opzioni o on o.sondaggio_id = s.id and o.id = p_opzione_id
    join public.unita u on u.condominio_id = s.condominio_id and u.id = p_unita_id
    where s.id = p_sondaggio_id
      and s.stato = 'aperto'
      and (s.scadenza is null or s.scadenza > now())
  );
$$;

grant execute on function admin_gestisce_sondaggio(uuid) to authenticated;
grant execute on function sondaggio_visibile(uuid) to authenticated;
grant execute on function sondaggio_risposta_ammessa(uuid, uuid, uuid) to authenticated;

drop policy if exists "sondaggi_select" on sondaggi;
create policy "sondaggi_select" on sondaggi
  for select using (
    admin_possiede_condominio(condominio_id) or appartiene_condominio(condominio_id)
  );

drop policy if exists "sondaggi_write_admin" on sondaggi;
create policy "sondaggi_write_admin" on sondaggi
  for all using (ruolo_corrente() = 'amministratore' and admin_possiede_condominio(condominio_id))
  with check (ruolo_corrente() = 'amministratore' and admin_possiede_condominio(condominio_id));

drop policy if exists "sondaggio_opzioni_select" on sondaggio_opzioni;
create policy "sondaggio_opzioni_select" on sondaggio_opzioni
  for select using (sondaggio_visibile(sondaggio_id));

drop policy if exists "sondaggio_opzioni_write_admin" on sondaggio_opzioni;
create policy "sondaggio_opzioni_write_admin" on sondaggio_opzioni
  for all using (ruolo_corrente() = 'amministratore' and admin_gestisce_sondaggio(sondaggio_id))
  with check (ruolo_corrente() = 'amministratore' and admin_gestisce_sondaggio(sondaggio_id));

-- Come per i voti, un condomino vede solo la propria risposta: il dato
-- aggregato passa da sondaggio_risultati.
drop policy if exists "sondaggio_risposte_select" on sondaggio_risposte;
create policy "sondaggio_risposte_select" on sondaggio_risposte
  for select using (
    utente_id = auth.uid()
    or possiede_unita(unita_id)
    or admin_gestisce_sondaggio(sondaggio_id)
  );

drop policy if exists "sondaggio_risposte_insert" on sondaggio_risposte;
create policy "sondaggio_risposte_insert" on sondaggio_risposte
  for insert with check (
    utente_id = auth.uid()
    and possiede_unita(unita_id)
    and sondaggio_risposta_ammessa(sondaggio_id, opzione_id, unita_id)
  );

drop policy if exists "sondaggio_risposte_update" on sondaggio_risposte;
create policy "sondaggio_risposte_update" on sondaggio_risposte
  for update using (
    utente_id = auth.uid()
    and possiede_unita(unita_id)
    and sondaggio_risposta_ammessa(sondaggio_id, opzione_id, unita_id)
  )
  with check (
    utente_id = auth.uid()
    and possiede_unita(unita_id)
    and sondaggio_risposta_ammessa(sondaggio_id, opzione_id, unita_id)
  );

drop policy if exists "sondaggio_risposte_delete" on sondaggio_risposte;
create policy "sondaggio_risposte_delete" on sondaggio_risposte
  for delete using (
    (utente_id = auth.uid() and sondaggio_risposta_ammessa(sondaggio_id, opzione_id, unita_id))
    or (ruolo_corrente() = 'amministratore' and admin_gestisce_sondaggio(sondaggio_id))
  );

create or replace function public.sondaggio_risultati(p_sondaggio_id uuid)
returns table (opzione_id uuid, risposte int, millesimi numeric)
language sql
stable
security definer
set search_path = public
as $$
  select r.opzione_id, count(*)::int, coalesce(sum(r.millesimi_rappresentati), 0)
  from sondaggio_risposte r
  join sondaggi s on s.id = r.sondaggio_id
  where r.sondaggio_id = p_sondaggio_id
    and (admin_possiede_condominio(s.condominio_id) or appartiene_condominio(s.condominio_id))
  group by r.opzione_id;
$$;

grant execute on function sondaggio_risultati(uuid) to authenticated;

-- ============================================================
-- Migrazione: manutenzione, fornitori, archivio documenti,
--             spazi comuni prenotabili
-- Da applicare manualmente su Supabase (SQL Editor). Idempotente.
--
-- Copre quattro funzionalità del dominio "amministrazione &
-- manutenzione", che condividono lo stesso perimetro (il condominio e
-- le sue unità) e quindi le stesse funzioni helper RLS già presenti in
-- questo file (admin_possiede_condominio, appartiene_condominio,
-- possiede_unita, admin_gestisce_unita).
--
--  1) FORNITORI + MANUTENZIONI PROGRAMMATE. L'anagrafica dei fornitori
--     è per condominio (lo stesso ascensorista di due condomìni è due
--     righe): è il perimetro su cui è costruita tutta la RLS del
--     progetto, e un'anagrafica "di studio" condivisa tra condomìni
--     richiederebbe un modello di proprietà diverso (per
--     amministratore) che oggi non esiste da nessuna parte.
--     Le manutenzioni programmate sono la scadenza successiva di un
--     contratto/intervento ricorrente: si collegano facoltativamente a
--     un fornitore e a una spesa già registrata (quando l'intervento è
--     stato fatturato).
--
--  2) SEGNALAZIONI di manutenzione, aperte dal condòmino sulla propria
--     unità o sulle parti comuni, con note di avanzamento e una foto
--     facoltativa nel bucket "documenti-condominio" già esistente.
--     Visibilità: le segnalazioni sulle PARTI COMUNI sono visibili a
--     tutto il condominio (evita i doppioni: se l'ascensore è già
--     segnalato si vede), quelle su una singola unità solo a chi la
--     possiede e all'amministratore.
--
--  3) ARCHIVIO DOCUMENTI del condominio (regolamento, planimetrie,
--     polizze, bilanci): caricabile solo dall'amministratore, visibile
--     a tutti i condòmini di quel condominio. Stesso bucket privato dei
--     documenti già presenti, sotto il prefisso "condomini/{id}/".
--
--  4) SPAZI COMUNI prenotabili. Il controllo di sovrapposizione è un
--     trigger e non un vincolo applicativo: dev'essere valido anche per
--     le chiamate diritte all'API, non solo per quelle che passano dal
--     modulo di prenotazione. "posti" è quante prenotazioni possono
--     coesistere nella stessa fascia (1 = sala condominiale, N = posti
--     auto ospiti).
-- ============================================================

-- 1) FORNITORI -------------------------------------------------
create table if not exists fornitori (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condomini(id) on delete cascade,
  nome text not null,
  categoria text not null default 'altro'
    check (categoria in (
      'ascensore', 'caldaia_riscaldamento', 'idraulico', 'elettricista',
      'pulizie', 'giardinaggio', 'antincendio', 'assicurazione',
      'edile', 'altro'
    )),
  referente text,
  email text,
  telefono text,
  partita_iva text,
  note text,
  attivo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_fornitori_condominio on fornitori(condominio_id);

-- 2) MANUTENZIONI PROGRAMMATE ----------------------------------
create table if not exists manutenzioni_programmate (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condomini(id) on delete cascade,
  fornitore_id uuid references fornitori(id) on delete set null,
  -- collegamento facoltativo alla spesa che ha fatturato l'intervento
  spesa_id uuid references spese(id) on delete set null,
  titolo text not null,
  descrizione text,
  data_prossima date not null,
  periodicita text not null default 'nessuna'
    check (periodicita in (
      'nessuna', 'mensile', 'trimestrale', 'semestrale', 'annuale', 'biennale'
    )),
  stato text not null default 'programmata'
    check (stato in ('programmata', 'completata', 'annullata')),
  data_completamento date,
  costo_previsto numeric(10,2) check (costo_previsto is null or costo_previsto >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_manutenzioni_condominio on manutenzioni_programmate(condominio_id);
create index if not exists idx_manutenzioni_data on manutenzioni_programmate(data_prossima);

-- 3) SEGNALAZIONI ----------------------------------------------
create table if not exists segnalazioni (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condomini(id) on delete cascade,
  -- null = parti comuni (visibile a tutto il condominio)
  unita_id uuid references unita(id) on delete set null,
  titolo text not null,
  descrizione text not null,
  categoria text not null default 'altro'
    check (categoria in (
      'ascensore', 'riscaldamento', 'idraulico', 'elettrico',
      'pulizie', 'parti_comuni', 'infiltrazioni', 'altro'
    )),
  priorita text not null default 'normale' check (priorita in ('bassa', 'normale', 'alta')),
  stato text not null default 'aperta' check (stato in ('aperta', 'in_corso', 'chiusa')),
  fornitore_id uuid references fornitori(id) on delete set null,
  aperta_da uuid not null references utenti(id),
  -- percorso della foto nello storage: "segnalazioni/{id}/..."
  foto_url text,
  chiusa_il timestamptz,
  created_at timestamptz not null default now(),
  aggiornata_il timestamptz not null default now()
);

create index if not exists idx_segnalazioni_condominio on segnalazioni(condominio_id);
create index if not exists idx_segnalazioni_stato on segnalazioni(stato);

create table if not exists segnalazione_note (
  id uuid primary key default gen_random_uuid(),
  segnalazione_id uuid not null references segnalazioni(id) on delete cascade,
  autore_id uuid not null references utenti(id),
  testo text not null,
  -- nota di servizio dell'amministratore: non visibile al condòmino
  interna boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_segnalazione_note_segnalazione
  on segnalazione_note(segnalazione_id);

-- 4) ARCHIVIO DOCUMENTI ----------------------------------------
create table if not exists documenti_condominio (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condomini(id) on delete cascade,
  titolo text not null,
  descrizione text,
  categoria text not null default 'altro'
    check (categoria in (
      'regolamento', 'planimetria', 'polizza', 'bilancio',
      'contratto', 'certificazione', 'altro'
    )),
  -- percorso nello storage: "condomini/{condominio_id}/..."
  percorso text not null,
  nome_file text not null,
  dimensione_byte bigint,
  mime_type text,
  caricato_da uuid not null references utenti(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_documenti_condominio on documenti_condominio(condominio_id);

-- 5) SPAZI COMUNI E PRENOTAZIONI -------------------------------
create table if not exists spazi_comuni (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condomini(id) on delete cascade,
  nome text not null,
  descrizione text,
  -- quante prenotazioni possono coesistere nella stessa fascia oraria
  posti int not null default 1 check (posti >= 1),
  ora_apertura time not null default '08:00',
  ora_chiusura time not null default '22:00',
  durata_massima_ore int check (durata_massima_ore is null or durata_massima_ore > 0),
  attivo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_spazi_comuni_condominio on spazi_comuni(condominio_id);

create table if not exists prenotazioni_spazi (
  id uuid primary key default gen_random_uuid(),
  spazio_id uuid not null references spazi_comuni(id) on delete cascade,
  unita_id uuid not null references unita(id) on delete cascade,
  utente_id uuid not null references utenti(id) on delete cascade,
  inizio timestamptz not null,
  fine timestamptz not null,
  note text,
  stato text not null default 'confermata' check (stato in ('confermata', 'annullata')),
  created_at timestamptz not null default now(),
  check (fine > inizio)
);

create index if not exists idx_prenotazioni_spazio on prenotazioni_spazi(spazio_id, inizio);
create index if not exists idx_prenotazioni_unita on prenotazioni_spazi(unita_id);

-- 6) FUNZIONI HELPER RLS ---------------------------------------
-- Stesso stile di admin_gestisce_unita / admin_gestisce_assemblea già
-- presenti in questo file: security definer + search_path fisso, così le
-- policy che le richiamano non ricadono nella RLS della tabella letta.

create or replace function public.admin_gestisce_fornitore(fornitore uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.fornitori f
    where f.id = fornitore and admin_possiede_condominio(f.condominio_id)
  );
$$;

create or replace function public.admin_gestisce_segnalazione(segnalazione uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.segnalazioni s
    where s.id = segnalazione and admin_possiede_condominio(s.condominio_id)
  );
$$;

-- Un condòmino vede: le segnalazioni che ha aperto, quelle sulle sue
-- unità e quelle sulle parti comuni del suo condominio.
create or replace function public.segnalazione_visibile(segnalazione uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.segnalazioni s
    where s.id = segnalazione
      and (
        admin_possiede_condominio(s.condominio_id)
        or s.aperta_da = auth.uid()
        or (s.unita_id is not null and possiede_unita(s.unita_id))
        or (s.unita_id is null and appartiene_condominio(s.condominio_id))
      )
  );
$$;

-- Chi può allegare/rimuovere la foto: l'autore della segnalazione o
-- l'amministratore del condominio.
create or replace function public.segnalazione_gestibile(segnalazione uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.segnalazioni s
    where s.id = segnalazione
      and (admin_possiede_condominio(s.condominio_id) or s.aperta_da = auth.uid())
  );
$$;

create or replace function public.admin_gestisce_spazio(spazio uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.spazi_comuni sp
    where sp.id = spazio and admin_possiede_condominio(sp.condominio_id)
  );
$$;

create or replace function public.spazio_visibile(spazio uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.spazi_comuni sp
    where sp.id = spazio
      and (admin_possiede_condominio(sp.condominio_id) or appartiene_condominio(sp.condominio_id))
  );
$$;

-- Una prenotazione è ammessa solo su uno spazio attivo e per un'unità
-- dello stesso condominio: vincoli che non si possono esprimere con un
-- check di tabella e che devono valere anche fuori dall'interfaccia.
create or replace function public.prenotazione_ammessa(p_spazio_id uuid, p_unita_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.spazi_comuni sp
    join public.unita u on u.condominio_id = sp.condominio_id and u.id = p_unita_id
    where sp.id = p_spazio_id and sp.attivo = true
  );
$$;

grant execute on function admin_gestisce_fornitore(uuid) to authenticated;
grant execute on function admin_gestisce_segnalazione(uuid) to authenticated;
grant execute on function segnalazione_visibile(uuid) to authenticated;
grant execute on function segnalazione_gestibile(uuid) to authenticated;
grant execute on function admin_gestisce_spazio(uuid) to authenticated;
grant execute on function spazio_visibile(uuid) to authenticated;
grant execute on function prenotazione_ammessa(uuid, uuid) to authenticated;

-- 7) RLS -------------------------------------------------------
alter table fornitori enable row level security;
alter table manutenzioni_programmate enable row level security;
alter table segnalazioni enable row level security;
alter table segnalazione_note enable row level security;
alter table documenti_condominio enable row level security;
alter table spazi_comuni enable row level security;
alter table prenotazioni_spazi enable row level security;

-- ---- FORNITORI ----
-- In lettura anche ai condòmini: sapere chi ha in carico l'ascensore o la
-- caldaia è informazione condominiale, e serve a mostrare "assegnata a…"
-- sulle segnalazioni senza dover duplicare il nome del fornitore.
drop policy if exists "fornitori_select" on fornitori;
create policy "fornitori_select" on fornitori
  for select using (
    admin_possiede_condominio(condominio_id) or appartiene_condominio(condominio_id)
  );

drop policy if exists "fornitori_write_admin" on fornitori;
create policy "fornitori_write_admin" on fornitori
  for all using (ruolo_corrente() = 'amministratore' and admin_possiede_condominio(condominio_id))
  with check (ruolo_corrente() = 'amministratore' and admin_possiede_condominio(condominio_id));

-- ---- MANUTENZIONI PROGRAMMATE ----
drop policy if exists "manutenzioni_select" on manutenzioni_programmate;
create policy "manutenzioni_select" on manutenzioni_programmate
  for select using (
    admin_possiede_condominio(condominio_id) or appartiene_condominio(condominio_id)
  );

drop policy if exists "manutenzioni_write_admin" on manutenzioni_programmate;
create policy "manutenzioni_write_admin" on manutenzioni_programmate
  for all using (ruolo_corrente() = 'amministratore' and admin_possiede_condominio(condominio_id))
  with check (ruolo_corrente() = 'amministratore' and admin_possiede_condominio(condominio_id));

-- ---- SEGNALAZIONI ----
drop policy if exists "segnalazioni_select" on segnalazioni;
create policy "segnalazioni_select" on segnalazioni
  for select using (
    admin_possiede_condominio(condominio_id)
    or aperta_da = auth.uid()
    or (unita_id is not null and possiede_unita(unita_id))
    or (unita_id is null and appartiene_condominio(condominio_id))
  );

-- Il condòmino apre una segnalazione a proprio nome, sul proprio
-- condominio, e solo su una unità che possiede (o sulle parti comuni).
drop policy if exists "segnalazioni_insert" on segnalazioni;
create policy "segnalazioni_insert" on segnalazioni
  for insert with check (
    (ruolo_corrente() = 'amministratore' and admin_possiede_condominio(condominio_id))
    or (
      aperta_da = auth.uid()
      and appartiene_condominio(condominio_id)
      and (unita_id is null or possiede_unita(unita_id))
    )
  );

-- Stato, priorità e assegnazione al fornitore sono responsabilità
-- dell'amministratore: il condòmino segue l'avanzamento e commenta.
drop policy if exists "segnalazioni_update_admin" on segnalazioni;
create policy "segnalazioni_update_admin" on segnalazioni
  for update using (ruolo_corrente() = 'amministratore' and admin_possiede_condominio(condominio_id))
  with check (ruolo_corrente() = 'amministratore' and admin_possiede_condominio(condominio_id));

-- L'autore può ritirare una segnalazione finché nessuno l'ha presa in
-- carico; dopo resta traccia e la chiude l'amministratore.
drop policy if exists "segnalazioni_delete" on segnalazioni;
create policy "segnalazioni_delete" on segnalazioni
  for delete using (
    (ruolo_corrente() = 'amministratore' and admin_possiede_condominio(condominio_id))
    or (aperta_da = auth.uid() and stato = 'aperta')
  );

-- ---- NOTE DELLE SEGNALAZIONI ----
drop policy if exists "segnalazione_note_select" on segnalazione_note;
create policy "segnalazione_note_select" on segnalazione_note
  for select using (
    admin_gestisce_segnalazione(segnalazione_id)
    or (interna = false and segnalazione_visibile(segnalazione_id))
  );

drop policy if exists "segnalazione_note_insert" on segnalazione_note;
create policy "segnalazione_note_insert" on segnalazione_note
  for insert with check (
    autore_id = auth.uid()
    and (
      admin_gestisce_segnalazione(segnalazione_id)
      or (interna = false and segnalazione_visibile(segnalazione_id))
    )
  );

drop policy if exists "segnalazione_note_delete" on segnalazione_note;
create policy "segnalazione_note_delete" on segnalazione_note
  for delete using (
    admin_gestisce_segnalazione(segnalazione_id) or autore_id = auth.uid()
  );

-- Ogni movimento su una segnalazione (nota o cambio di stato) ne
-- aggiorna il timestamp: l'elenco può così ordinare per "ultimo
-- aggiornamento" senza che l'applicazione se ne debba ricordare.
create or replace function public.tocca_segnalazione()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update segnalazioni set aggiornata_il = now()
  where id = coalesce(new.segnalazione_id, old.segnalazione_id);
  return null;
end;
$$;

drop trigger if exists trg_segnalazione_note_tocca on segnalazione_note;
create trigger trg_segnalazione_note_tocca
  after insert or delete on segnalazione_note
  for each row execute function public.tocca_segnalazione();

create or replace function public.tocca_segnalazione_su_update()
returns trigger
language plpgsql
as $$
begin
  new.aggiornata_il := now();
  if new.stato = 'chiusa' and old.stato <> 'chiusa' then
    new.chiusa_il := now();
  elsif new.stato <> 'chiusa' then
    new.chiusa_il := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_segnalazioni_update on segnalazioni;
create trigger trg_segnalazioni_update
  before update on segnalazioni
  for each row execute function public.tocca_segnalazione_su_update();

-- ---- ARCHIVIO DOCUMENTI ----
drop policy if exists "documenti_condominio_select" on documenti_condominio;
create policy "documenti_condominio_select" on documenti_condominio
  for select using (
    admin_possiede_condominio(condominio_id) or appartiene_condominio(condominio_id)
  );

drop policy if exists "documenti_condominio_write_admin" on documenti_condominio;
create policy "documenti_condominio_write_admin" on documenti_condominio
  for all using (ruolo_corrente() = 'amministratore' and admin_possiede_condominio(condominio_id))
  with check (ruolo_corrente() = 'amministratore' and admin_possiede_condominio(condominio_id));

-- ---- SPAZI COMUNI ----
drop policy if exists "spazi_comuni_select" on spazi_comuni;
create policy "spazi_comuni_select" on spazi_comuni
  for select using (
    admin_possiede_condominio(condominio_id) or appartiene_condominio(condominio_id)
  );

drop policy if exists "spazi_comuni_write_admin" on spazi_comuni;
create policy "spazi_comuni_write_admin" on spazi_comuni
  for all using (ruolo_corrente() = 'amministratore' and admin_possiede_condominio(condominio_id))
  with check (ruolo_corrente() = 'amministratore' and admin_possiede_condominio(condominio_id));

-- ---- PRENOTAZIONI ----
-- Il calendario di uno spazio è condiviso: chi vede lo spazio vede anche
-- le fasce già occupate (altrimenti non potrebbe sapere quando prenotare).
drop policy if exists "prenotazioni_select" on prenotazioni_spazi;
create policy "prenotazioni_select" on prenotazioni_spazi
  for select using (spazio_visibile(spazio_id));

drop policy if exists "prenotazioni_insert" on prenotazioni_spazi;
create policy "prenotazioni_insert" on prenotazioni_spazi
  for insert with check (
    prenotazione_ammessa(spazio_id, unita_id)
    and (
      (ruolo_corrente() = 'amministratore' and admin_gestisce_spazio(spazio_id))
      or (utente_id = auth.uid() and possiede_unita(unita_id))
    )
  );

drop policy if exists "prenotazioni_update" on prenotazioni_spazi;
create policy "prenotazioni_update" on prenotazioni_spazi
  for update using (
    (ruolo_corrente() = 'amministratore' and admin_gestisce_spazio(spazio_id))
    or utente_id = auth.uid()
  )
  with check (
    (ruolo_corrente() = 'amministratore' and admin_gestisce_spazio(spazio_id))
    or (utente_id = auth.uid() and possiede_unita(unita_id))
  );

drop policy if exists "prenotazioni_delete" on prenotazioni_spazi;
create policy "prenotazioni_delete" on prenotazioni_spazi
  for delete using (
    (ruolo_corrente() = 'amministratore' and admin_gestisce_spazio(spazio_id))
    or utente_id = auth.uid()
  );

-- Sovrapposizioni: contate qui e non nell'applicazione, così il vincolo
-- vale anche per una POST diretta all'API. security definer perché il
-- chiamante deve poter "vedere" le prenotazioni altrui solo ai fini del
-- conteggio, non leggerle.
create or replace function public.verifica_disponibilita_spazio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_posti int;
  v_occupati int;
begin
  if new.stato <> 'confermata' then
    return new;
  end if;

  select posti into v_posti from spazi_comuni where id = new.spazio_id;
  if v_posti is null then
    raise exception 'Spazio comune inesistente.';
  end if;

  select count(*) into v_occupati
  from prenotazioni_spazi p
  where p.spazio_id = new.spazio_id
    and p.stato = 'confermata'
    and p.id <> new.id
    and p.inizio < new.fine
    and p.fine > new.inizio;

  if v_occupati >= v_posti then
    raise exception 'Lo spazio risulta già prenotato in questa fascia oraria.'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prenotazioni_disponibilita on prenotazioni_spazi;
create trigger trg_prenotazioni_disponibilita
  before insert or update on prenotazioni_spazi
  for each row execute function public.verifica_disponibilita_spazio();

-- 8) STORAGE ---------------------------------------------------
-- Le policy del bucket "documenti-condominio" coprivano solo i prefissi
-- "spese/" e "assemblee/". Vengono riscritte (drop + create, come già
-- fatto altrove in questo file) aggiungendo i due nuovi prefissi:
--   condomini/{condominio_id}/...   archivio documenti (scrive l'admin)
--   segnalazioni/{segnalazione_id}/... foto delle segnalazioni
-- Il resto della logica preesistente resta identico.
drop policy if exists "documenti_select" on storage.objects;
create policy "documenti_select" on storage.objects for select using (
  bucket_id = 'documenti-condominio' and (
    ((storage.foldername(name))[1] = 'spese' and (
      admin_gestisce_spesa(((storage.foldername(name))[2])::uuid)
      or exists (select 1 from spese s where s.id = ((storage.foldername(name))[2])::uuid and appartiene_condominio(s.condominio_id))
    ))
    or
    ((storage.foldername(name))[1] = 'assemblee' and (
      admin_gestisce_assemblea(((storage.foldername(name))[2])::uuid)
      or exists (select 1 from assemblee a where a.id = ((storage.foldername(name))[2])::uuid and appartiene_condominio(a.condominio_id))
    ))
    or
    ((storage.foldername(name))[1] = 'condomini' and (
      admin_possiede_condominio(((storage.foldername(name))[2])::uuid)
      or appartiene_condominio(((storage.foldername(name))[2])::uuid)
    ))
    or
    ((storage.foldername(name))[1] = 'segnalazioni'
      and segnalazione_visibile(((storage.foldername(name))[2])::uuid))
  )
);

drop policy if exists "documenti_insert_admin" on storage.objects;
create policy "documenti_insert_admin" on storage.objects for insert with check (
  bucket_id = 'documenti-condominio' and (
    (ruolo_corrente() = 'amministratore' and (
      ((storage.foldername(name))[1] = 'spese' and admin_gestisce_spesa(((storage.foldername(name))[2])::uuid))
      or ((storage.foldername(name))[1] = 'assemblee' and admin_gestisce_assemblea(((storage.foldername(name))[2])::uuid))
      or ((storage.foldername(name))[1] = 'condomini' and admin_possiede_condominio(((storage.foldername(name))[2])::uuid))
    ))
    -- la foto la carica chi apre la segnalazione, non solo l'amministratore
    or ((storage.foldername(name))[1] = 'segnalazioni'
      and segnalazione_gestibile(((storage.foldername(name))[2])::uuid))
  )
);

drop policy if exists "documenti_delete_admin" on storage.objects;
create policy "documenti_delete_admin" on storage.objects for delete using (
  bucket_id = 'documenti-condominio' and (
    (ruolo_corrente() = 'amministratore' and (
      ((storage.foldername(name))[1] = 'spese' and admin_gestisce_spesa(((storage.foldername(name))[2])::uuid))
      or ((storage.foldername(name))[1] = 'assemblee' and admin_gestisce_assemblea(((storage.foldername(name))[2])::uuid))
      or ((storage.foldername(name))[1] = 'condomini' and admin_possiede_condominio(((storage.foldername(name))[2])::uuid))
    ))
    or ((storage.foldername(name))[1] = 'segnalazioni'
      and segnalazione_gestibile(((storage.foldername(name))[2])::uuid))
  )
);

-- ============================================================
-- Migrazione: notifiche granulari, solleciti di morosità,
--             riconciliazione bancaria
-- Da applicare manualmente su Supabase (SQL Editor). Idempotente.
--
-- Tre funzionalità con perimetri di visibilità diversi, che è la
-- ragione per cui le policy qui sotto non si somigliano tra loro:
--
--  1) PREFERENZE DI NOTIFICA. Righe personali: ognuno vede e scrive
--     soltanto le proprie, nemmeno l'amministratore le legge. Il
--     modello è a OPT-OUT (vedi `src/lib/notifiche.ts`): l'assenza di
--     una riga vale "attiva", quindi la tabella parte vuota e chi non
--     tocca nulla continua a ricevere gli avvisi come prima.
--     `tipo_evento` è `text` e non un enum: aggiungere un evento deve
--     restare una modifica di codice, non una migrazione del database.
--
--  2) SOLLECITI. Storico delle lettere di sollecito inviate a una
--     unità. Lo scrive l'amministratore; il condòmino può LEGGERE i
--     solleciti che riguardano le proprie unità — sapere che cosa
--     risulta a proprio carico è informazione sua, e nasconderla
--     genererebbe solo telefonate. `livello` 1/2/3 = promemoria,
--     sollecito, diffida.
--
--  3) MOVIMENTI BANCARI. Le righe dell'estratto conto importato in CSV,
--     con l'eventuale ripartizione a cui sono state abbinate. Qui la
--     visibilità è del solo amministratore: l'estratto conto contiene i
--     movimenti di tutti, e mostrarlo a un condòmino significherebbe
--     fargli vedere chi ha pagato e chi no.
--     L'unicità su (condominio_id, import_hash) è ciò che rende
--     l'importazione ripetibile: ricaricare lo stesso file non crea
--     doppioni, e caricare il mese successivo che si sovrappone di
--     qualche giorno reimporta solo le righe nuove.
-- ============================================================

-- 1) PREFERENZE DI NOTIFICA -----------------------------------
create table if not exists preferenze_notifiche (
  id uuid primary key default gen_random_uuid(),
  utente_id uuid not null references utenti(id) on delete cascade,
  tipo_evento text not null,
  email_attiva boolean not null default true,
  created_at timestamptz not null default now(),
  unique (utente_id, tipo_evento)
);

create index if not exists idx_preferenze_notifiche_utente
  on preferenze_notifiche(utente_id);

-- 2) SOLLECITI ------------------------------------------------
create table if not exists solleciti (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condomini(id) on delete cascade,
  unita_id uuid not null references unita(id) on delete cascade,
  livello int not null check (livello in (1, 2, 3)),
  importo_totale numeric(10,2) not null check (importo_totale >= 0),
  data_invio date not null default current_date,
  inviato_da uuid not null references utenti(id),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_solleciti_condominio on solleciti(condominio_id);
create index if not exists idx_solleciti_unita on solleciti(unita_id, data_invio desc);

-- 3) MOVIMENTI BANCARI ----------------------------------------
create table if not exists movimenti_bancari (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condomini(id) on delete cascade,
  data date not null,
  -- segnato: positivo = accredito (soldi entrati), negativo = addebito
  importo numeric(12,2) not null,
  descrizione text not null default '',
  -- CRO/TRN o altro riferimento dell'operazione, quando la banca lo esporta
  riferimento text,
  ripartizione_id uuid references ripartizioni(id) on delete set null,
  stato text not null default 'da_abbinare'
    check (stato in ('da_abbinare', 'abbinato', 'ignorato')),
  -- impronta della riga del CSV: rende l'importazione idempotente
  import_hash text not null,
  created_at timestamptz not null default now(),
  unique (condominio_id, import_hash)
);

create index if not exists idx_movimenti_condominio on movimenti_bancari(condominio_id, data);
create index if not exists idx_movimenti_stato on movimenti_bancari(stato);
create index if not exists idx_movimenti_ripartizione on movimenti_bancari(ripartizione_id);

-- 4) RLS ------------------------------------------------------
alter table preferenze_notifiche enable row level security;
alter table solleciti enable row level security;
alter table movimenti_bancari enable row level security;

-- ---- PREFERENZE DI NOTIFICA ----
-- Nessun riferimento al ruolo: queste righe sono personali e basta.
drop policy if exists "preferenze_notifiche_select" on preferenze_notifiche;
create policy "preferenze_notifiche_select" on preferenze_notifiche
  for select using (utente_id = auth.uid());

drop policy if exists "preferenze_notifiche_write" on preferenze_notifiche;
create policy "preferenze_notifiche_write" on preferenze_notifiche
  for all using (utente_id = auth.uid())
  with check (utente_id = auth.uid());

-- ---- SOLLECITI ----
drop policy if exists "solleciti_select" on solleciti;
create policy "solleciti_select" on solleciti
  for select using (
    admin_possiede_condominio(condominio_id) or possiede_unita(unita_id)
  );

drop policy if exists "solleciti_write_admin" on solleciti;
create policy "solleciti_write_admin" on solleciti
  for all using (ruolo_corrente() = 'amministratore' and admin_possiede_condominio(condominio_id))
  with check (ruolo_corrente() = 'amministratore' and admin_possiede_condominio(condominio_id));

-- ---- MOVIMENTI BANCARI ----
-- Solo l'amministratore, anche in lettura: vedi il commento in testa.
drop policy if exists "movimenti_bancari_admin" on movimenti_bancari;
create policy "movimenti_bancari_admin" on movimenti_bancari
  for all using (ruolo_corrente() = 'amministratore' and admin_possiede_condominio(condominio_id))
  with check (ruolo_corrente() = 'amministratore' and admin_possiede_condominio(condominio_id));

-- Una riga abbinata deve puntare a una ripartizione dello stesso
-- condominio: un movimento del condominio A non può saldare una quota
-- del condominio B. Il vincolo non è esprimibile con un check di
-- tabella (serve una join), quindi è un trigger, e come per le
-- prenotazioni vale anche per le chiamate dirette all'API.
create or replace function public.verifica_abbinamento_movimento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_condominio uuid;
begin
  if new.ripartizione_id is null then
    return new;
  end if;

  select s.condominio_id into v_condominio
  from ripartizioni r
  join spese s on s.id = r.spesa_id
  where r.id = new.ripartizione_id;

  if v_condominio is distinct from new.condominio_id then
    raise exception 'La quota abbinata appartiene a un altro condominio.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_movimenti_abbinamento on movimenti_bancari;
create trigger trg_movimenti_abbinamento
  before insert or update on movimenti_bancari
  for each row execute function public.verifica_abbinamento_movimento();
