-- ============================================================
-- Schema database: portale di gestione condominiale
-- Target: PostgreSQL / Supabase
-- ============================================================

-- Estensione per generare UUID
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- CONDOMINI
-- ------------------------------------------------------------
create table condomini (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  indirizzo text not null,
  codice_fiscale text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- UTENTI
-- Estende auth.users di Supabase: l'id coincide con quello
-- generato automaticamente da Supabase Auth alla registrazione.
-- ------------------------------------------------------------
create table utenti (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  cognome text not null,
  email text not null unique,
  ruolo text not null check (ruolo in ('amministratore', 'condomino')),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- UNITA (unità immobiliari)
-- ------------------------------------------------------------
create table unita (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condomini(id) on delete cascade,
  identificativo text not null,        -- es. "Scala A - Interno 3"
  piano text,
  millesimi_proprieta numeric(6,3) not null check (millesimi_proprieta >= 0),
  created_at timestamptz not null default now()
);

create index idx_unita_condominio on unita(condominio_id);

-- ------------------------------------------------------------
-- UNITA_PROPRIETARI (join: un'unità può avere più comproprietari)
-- ------------------------------------------------------------
create table unita_proprietari (
  id uuid primary key default gen_random_uuid(),
  unita_id uuid not null references unita(id) on delete cascade,
  utente_id uuid not null references utenti(id) on delete cascade,
  quota_possesso numeric(5,2) not null default 100 check (quota_possesso > 0 and quota_possesso <= 100),
  created_at timestamptz not null default now(),
  unique (unita_id, utente_id)
);

create index idx_unita_proprietari_unita on unita_proprietari(unita_id);
create index idx_unita_proprietari_utente on unita_proprietari(utente_id);

-- ------------------------------------------------------------
-- ASSEMBLEE
-- ------------------------------------------------------------
create table assemblee (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condomini(id) on delete cascade,
  data_assemblea timestamptz not null,
  tipo text not null check (tipo in ('ordinaria', 'straordinaria')),
  stato text not null default 'convocata' check (stato in ('convocata', 'in_corso', 'conclusa')),
  verbale_url text,          -- percorso del PDF nello storage, valorizzato a fine assemblea
  created_at timestamptz not null default now()
);

create index idx_assemblee_condominio on assemblee(condominio_id);

-- ------------------------------------------------------------
-- PUNTI_ODG (punti all'ordine del giorno, votabili)
-- ------------------------------------------------------------
create table punti_odg (
  id uuid primary key default gen_random_uuid(),
  assemblea_id uuid not null references assemblee(id) on delete cascade,
  numero_punto int not null,
  descrizione text not null,
  tipo_maggioranza text not null default 'semplice',  -- es. semplice, qualificata_intervenuti, ecc.
  stato_votazione text not null default 'chiusa' check (stato_votazione in ('aperta', 'chiusa')),
  esito text check (esito in ('approvato', 'respinto', null)),
  created_at timestamptz not null default now(),
  unique (assemblea_id, numero_punto)
);

create index idx_punti_odg_assemblea on punti_odg(assemblea_id);

-- ------------------------------------------------------------
-- VOTI
-- Il voto è espresso per unità (i millesimi appartengono
-- all'unità), ma si registra anche chi lo ha materialmente
-- espresso. millesimi_rappresentati è uno SNAPSHOT preso al
-- momento del voto, per mantenere valido il verbale anche se
-- le tabelle millesimali cambiano in futuro.
-- ------------------------------------------------------------
create table voti (
  id uuid primary key default gen_random_uuid(),
  punto_id uuid not null references punti_odg(id) on delete cascade,
  unita_id uuid not null references unita(id) on delete cascade,
  utente_id uuid not null references utenti(id),
  scelta text not null check (scelta in ('favorevole', 'contrario', 'astenuto')),
  millesimi_rappresentati numeric(6,3) not null,
  data_voto timestamptz not null default now(),
  unique (punto_id, unita_id)   -- una sola unità = un solo voto per punto
);

create index idx_voti_punto on voti(punto_id);
create index idx_voti_unita on voti(unita_id);

-- ------------------------------------------------------------
-- SPESE
-- ------------------------------------------------------------
create table spese (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condomini(id) on delete cascade,
  descrizione text not null,
  importo_totale numeric(10,2) not null check (importo_totale >= 0),
  categoria text not null,        -- es. ordinaria, straordinaria, ascensore, riscaldamento
  data_spesa date not null,
  fornitore text,
  documento_url text,             -- fattura nello storage
  created_at timestamptz not null default now()
);

create index idx_spese_condominio on spese(condominio_id);

-- ------------------------------------------------------------
-- RIPARTIZIONI (come una spesa si divide tra le unità)
-- ------------------------------------------------------------
create table ripartizioni (
  id uuid primary key default gen_random_uuid(),
  spesa_id uuid not null references spese(id) on delete cascade,
  unita_id uuid not null references unita(id) on delete cascade,
  importo_dovuto numeric(10,2) not null check (importo_dovuto >= 0),
  stato_pagamento text not null default 'da_pagare' check (stato_pagamento in ('da_pagare', 'pagato', 'in_ritardo')),
  data_scadenza date,
  data_pagamento date,
  unique (spesa_id, unita_id)
);

create index idx_ripartizioni_spesa on ripartizioni(spesa_id);
create index idx_ripartizioni_unita on ripartizioni(unita_id);

-- ------------------------------------------------------------
-- PRESENZE (per il calcolo del quorum in tempo reale)
-- Il quorum si ottiene con:
--   SUM(millesimi_rappresentati) FROM presenze
--   WHERE assemblea_id = ? AND ora_uscita IS NULL
-- ------------------------------------------------------------
create table presenze (
  id uuid primary key default gen_random_uuid(),
  assemblea_id uuid not null references assemblee(id) on delete cascade,
  unita_id uuid not null references unita(id) on delete cascade,
  utente_id uuid not null references utenti(id),
  modalita text not null check (modalita in ('presenza', 'remoto', 'delega')),
  millesimi_rappresentati numeric(6,3) not null,  -- include eventuali millesimi delegati
  ora_ingresso timestamptz not null default now(),
  ora_uscita timestamptz,
  unique (assemblea_id, unita_id)
);

create index idx_presenze_assemblea on presenze(assemblea_id);

-- ------------------------------------------------------------
-- DELEGHE
-- Nota legale: l'art. 67 disp. att. c.c. pone un limite al
-- numero di deleghe cumulabili da una persona in base ai
-- millesimi complessivi dell'edificio: da gestire lato
-- applicazione, non è un vincolo esprimibile a livello di DB.
-- ------------------------------------------------------------
create table deleghe (
  id uuid primary key default gen_random_uuid(),
  assemblea_id uuid not null references assemblee(id) on delete cascade,
  unita_delegante_id uuid not null references unita(id) on delete cascade,
  unita_delegataria_id uuid not null references unita(id) on delete cascade,
  utente_delegato_id uuid not null references utenti(id),
  created_at timestamptz not null default now(),
  unique (assemblea_id, unita_delegante_id),
  check (unita_delegante_id <> unita_delegataria_id)
);

create index idx_deleghe_assemblea on deleghe(assemblea_id);

-- ============================================================
-- Provisioning automatico di "utenti" alla registrazione
-- Alla creazione di un auth.users, crea la riga corrispondente
-- in public.utenti leggendo nome/cognome/ruolo da
-- raw_user_meta_data (passati da supabase.auth.signUp({ options: { data } })).
-- Ruolo di default: 'condomino' se non specificato o non valido,
-- così un utente non può auto-promuoversi ad amministratore
-- passando un valore arbitrario in fase di registrazione.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ruolo_richiesto text := new.raw_user_meta_data->>'ruolo';
begin
  insert into public.utenti (id, nome, cognome, email, ruolo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', ''),
    coalesce(new.raw_user_meta_data->>'cognome', ''),
    new.email,
    case when ruolo_richiesto = 'amministratore' then 'amministratore' else 'condomino' end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table utenti enable row level security;
alter table condomini enable row level security;
alter table unita enable row level security;
alter table unita_proprietari enable row level security;
alter table assemblee enable row level security;
alter table punti_odg enable row level security;
alter table voti enable row level security;
alter table spese enable row level security;
alter table ripartizioni enable row level security;
alter table presenze enable row level security;
alter table deleghe enable row level security;

-- Funzione helper: ruolo dell'utente autenticato.
-- security definer + search_path fisso per evitare che le
-- policy che la richiamano vadano in ricorsione su "utenti".
create or replace function public.ruolo_corrente()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select ruolo from public.utenti where id = auth.uid();
$$;

-- Funzione helper: l'utente autenticato possiede (anche in
-- comproprietà) l'unità indicata.
create or replace function public.possiede_unita(unita uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.unita_proprietari up
    where up.unita_id = unita and up.utente_id = auth.uid()
  );
$$;

-- Funzione helper: l'utente autenticato ha (tramite una sua
-- unità) un legame con il condominio indicato.
create or replace function public.appartiene_condominio(condominio uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.unita_proprietari up
    join public.unita u on u.id = up.unita_id
    where u.condominio_id = condominio and up.utente_id = auth.uid()
  );
$$;

-- ---------------- UTENTI ----------------
create policy "utenti_select_self_or_admin" on utenti
  for select using (id = auth.uid() or ruolo_corrente() = 'amministratore');

create policy "utenti_update_self_or_admin" on utenti
  for update using (id = auth.uid() or ruolo_corrente() = 'amministratore');

-- niente insert/delete diretti: la riga nasce dal trigger on_auth_user_created

-- La policy sopra permette a un utente di aggiornare la propria riga,
-- ma RLS lavora a livello di riga, non di colonna: senza questo trigger
-- un condomino potrebbe auto-promuoversi ad amministratore includendo
-- ruolo='amministratore' nella propria UPDATE. Il trigger blocca ogni
-- cambio di ruolo che non sia eseguito da un amministratore.
create or replace function public.blocca_cambio_ruolo_non_autorizzato()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.ruolo is distinct from old.ruolo and ruolo_corrente() <> 'amministratore' then
    raise exception 'Solo un amministratore può modificare il ruolo di un utente';
  end if;
  return new;
end;
$$;

drop trigger if exists on_utenti_update_ruolo on utenti;
create trigger on_utenti_update_ruolo
  before update on utenti
  for each row execute function public.blocca_cambio_ruolo_non_autorizzato();

-- ---------------- CONDOMINI ----------------
create policy "condomini_select" on condomini
  for select using (
    ruolo_corrente() = 'amministratore' or appartiene_condominio(id)
  );

create policy "condomini_write_admin" on condomini
  for all using (ruolo_corrente() = 'amministratore')
  with check (ruolo_corrente() = 'amministratore');

-- ---------------- UNITA ----------------
create policy "unita_select" on unita
  for select using (
    ruolo_corrente() = 'amministratore' or possiede_unita(id)
  );

create policy "unita_write_admin" on unita
  for all using (ruolo_corrente() = 'amministratore')
  with check (ruolo_corrente() = 'amministratore');

-- ---------------- UNITA_PROPRIETARI ----------------
create policy "unita_proprietari_select" on unita_proprietari
  for select using (
    ruolo_corrente() = 'amministratore' or utente_id = auth.uid()
  );

create policy "unita_proprietari_write_admin" on unita_proprietari
  for all using (ruolo_corrente() = 'amministratore')
  with check (ruolo_corrente() = 'amministratore');

-- ---------------- ASSEMBLEE ----------------
create policy "assemblee_select" on assemblee
  for select using (
    ruolo_corrente() = 'amministratore' or appartiene_condominio(condominio_id)
  );

create policy "assemblee_write_admin" on assemblee
  for all using (ruolo_corrente() = 'amministratore')
  with check (ruolo_corrente() = 'amministratore');

-- ---------------- PUNTI_ODG ----------------
create policy "punti_odg_select" on punti_odg
  for select using (
    ruolo_corrente() = 'amministratore' or exists (
      select 1 from assemblee a
      where a.id = punti_odg.assemblea_id and appartiene_condominio(a.condominio_id)
    )
  );

create policy "punti_odg_write_admin" on punti_odg
  for all using (ruolo_corrente() = 'amministratore')
  with check (ruolo_corrente() = 'amministratore');

-- ---------------- VOTI ----------------
create policy "voti_select" on voti
  for select using (
    ruolo_corrente() = 'amministratore' or utente_id = auth.uid() or possiede_unita(unita_id)
  );

create policy "voti_insert_condomino" on voti
  for insert with check (
    ruolo_corrente() = 'amministratore' or (utente_id = auth.uid() and possiede_unita(unita_id))
  );

create policy "voti_update_admin" on voti
  for update using (ruolo_corrente() = 'amministratore')
  with check (ruolo_corrente() = 'amministratore');

create policy "voti_delete_admin" on voti
  for delete using (ruolo_corrente() = 'amministratore');

-- ---------------- SPESE ----------------
create policy "spese_select" on spese
  for select using (
    ruolo_corrente() = 'amministratore' or appartiene_condominio(condominio_id)
  );

create policy "spese_write_admin" on spese
  for all using (ruolo_corrente() = 'amministratore')
  with check (ruolo_corrente() = 'amministratore');

-- ---------------- RIPARTIZIONI ----------------
create policy "ripartizioni_select" on ripartizioni
  for select using (
    ruolo_corrente() = 'amministratore' or possiede_unita(unita_id)
  );

create policy "ripartizioni_write_admin" on ripartizioni
  for all using (ruolo_corrente() = 'amministratore')
  with check (ruolo_corrente() = 'amministratore');

-- ---------------- PRESENZE ----------------
create policy "presenze_select" on presenze
  for select using (
    ruolo_corrente() = 'amministratore' or utente_id = auth.uid() or possiede_unita(unita_id)
  );

create policy "presenze_insert_condomino" on presenze
  for insert with check (
    ruolo_corrente() = 'amministratore' or (utente_id = auth.uid() and possiede_unita(unita_id))
  );

create policy "presenze_update_admin" on presenze
  for update using (ruolo_corrente() = 'amministratore')
  with check (ruolo_corrente() = 'amministratore');

create policy "presenze_delete_admin" on presenze
  for delete using (ruolo_corrente() = 'amministratore');

-- ---------------- DELEGHE ----------------
create policy "deleghe_select" on deleghe
  for select using (
    ruolo_corrente() = 'amministratore'
    or possiede_unita(unita_delegante_id)
    or possiede_unita(unita_delegataria_id)
  );

create policy "deleghe_insert_condomino" on deleghe
  for insert with check (
    ruolo_corrente() = 'amministratore' or possiede_unita(unita_delegante_id)
  );

create policy "deleghe_write_admin" on deleghe
  for update using (ruolo_corrente() = 'amministratore')
  with check (ruolo_corrente() = 'amministratore');

create policy "deleghe_delete" on deleghe
  for delete using (
    ruolo_corrente() = 'amministratore' or possiede_unita(unita_delegante_id)
  );

-- ============================================================
-- Migrazione: votazione assemblee
-- Applicata manualmente su Supabase (SQL Editor) il 2026-07-15.
-- Questo file è solo un registro storico: modificarlo non ha
-- alcun effetto sul database reale.
--
-- 1) La policy di insert sui voti non controllava che il punto
--    all'ordine del giorno fosse ancora aperto: un condomino
--    poteva votare direttamente via API anche a votazione chiusa.
-- 2) Nessuna policy permetteva a un condomino di correggere il
--    proprio voto prima della chiusura.
-- 3) Colonne di riepilogo su punti_odg, così un condomino vede
--    l'esito aggregato (favorevoli/contrari/astenuti/quorum)
--    senza poter leggere il voto individuale dei vicini.
-- ============================================================

drop policy if exists "voti_insert_condomino" on voti;
create policy "voti_insert_condomino" on voti
  for insert with check (
    ruolo_corrente() = 'amministratore'
    or (
      utente_id = auth.uid()
      and possiede_unita(unita_id)
      and exists (
        select 1 from punti_odg p
        where p.id = voti.punto_id and p.stato_votazione = 'aperta'
      )
    )
  );

create policy "voti_update_condomino" on voti
  for update using (
    utente_id = auth.uid()
    and possiede_unita(unita_id)
    and exists (
      select 1 from punti_odg p
      where p.id = voti.punto_id and p.stato_votazione = 'aperta'
    )
  )
  with check (
    utente_id = auth.uid()
    and possiede_unita(unita_id)
    and exists (
      select 1 from punti_odg p
      where p.id = voti.punto_id and p.stato_votazione = 'aperta'
    )
  );

alter table punti_odg
  add column if not exists esito_favorevole numeric(6,3),
  add column if not exists esito_contrario numeric(6,3),
  add column if not exists esito_astenuto numeric(6,3),
  add column if not exists esito_quorum_totale numeric(6,3);

-- ============================================================
-- Migrazione: cerchio millesimi in tempo reale sui punti all'odg
-- Applicata manualmente su Supabase (SQL Editor) il 2026-07-20.
-- Questo file è solo un registro storico: modificarlo non ha
-- alcun effetto sul database reale.
--
-- 1) Colonne tally_* su punti_odg: totale millesimi per scelta di
--    voto, mantenuto aggiornato da un trigger su ogni insert/
--    update/delete su voti. Servono per mostrare un cerchio che si
--    colora in tempo reale senza esporre il voto individuale dei
--    singoli condòmini (le policy RLS su "voti" restano invariate:
--    un condomino continua a vedere solo il proprio voto).
-- 2) Trigger security definer: un condomino non ha permesso di
--    scrivere su punti_odg (riservato all'amministratore), quindi
--    l'aggiornamento del tally deve avvenire con i permessi della
--    funzione, non dell'utente che ha votato.
-- 3) punti_odg viene aggiunta alla pubblicazione realtime così i
--    client possono sottoscriversi via postgres_changes; la policy
--    "punti_odg_select" già esistente si applica automaticamente
--    anche agli eventi realtime.
-- 4) Funzione condominio_millesimi_totali: un condomino non può
--    leggere le unità altrui (policy "unita_select"), ma gli serve
--    il totale millesimi dell'edificio per calcolare le proporzioni
--    del cerchio. La funzione restituisce solo la somma aggregata,
--    mai le singole unità, ed è utilizzabile solo da chi appartiene
--    al condominio (o dall'amministratore).
-- ============================================================

alter table punti_odg
  add column if not exists tally_favorevole numeric(7,3) not null default 0,
  add column if not exists tally_contrario numeric(7,3) not null default 0,
  add column if not exists tally_astenuto numeric(7,3) not null default 0;

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
    tally_astenuto = coalesce(s.astenuto, 0)
  from (
    select
      sum(millesimi_rappresentati) filter (where scelta = 'favorevole') as favorevole,
      sum(millesimi_rappresentati) filter (where scelta = 'contrario') as contrario,
      sum(millesimi_rappresentati) filter (where scelta = 'astenuto') as astenuto
    from voti
    where punto_id = v_punto_id
  ) s
  where p.id = v_punto_id;
  return null;
end;
$$;

drop trigger if exists trg_voti_tally on voti;
create trigger trg_voti_tally
  after insert or update or delete on voti
  for each row execute function aggiorna_tally_punto();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'punti_odg'
  ) then
    alter publication supabase_realtime add table punti_odg;
  end if;
end $$;

create or replace function condominio_millesimi_totali(p_condominio_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(millesimi_proprieta), 0)
  from unita
  where condominio_id = p_condominio_id
    and (ruolo_corrente() = 'amministratore' or appartiene_condominio(p_condominio_id));
$$;

grant execute on function condominio_millesimi_totali(uuid) to authenticated;

-- ============================================================
-- Migrazione: importazione massiva unità e spese storiche
-- Applicata manualmente su Supabase (SQL Editor) il 2026-07-21.
-- Questo file è solo un registro storico: modificarlo non ha
-- alcun effetto sul database reale.
--
-- 1) unique(condominio_id, identificativo) su "unita": prima non
--    esisteva alcun vincolo, quindi era possibile creare la stessa
--    unità due volte. Serve anche per abilitare l'upsert
--    (on_conflict) durante l'importazione massiva da file.
-- 2) Tabella import_batches: traccia ogni importazione massiva
--    (chi, quando, quante righe) così un'importazione sbagliata
--    può essere individuata ed annullata senza toccare le righe
--    inserite manualmente.
-- 3) Colonna import_batch_id (nullable) su "unita" e "spese": lega
--    ogni riga al batch che l'ha creata. "on delete set null" per
--    non perdere le unità/spese se il record di audit viene
--    ripulito: l'annullamento di un'importazione cancella
--    esplicitamente le righe (vedi azione applicativa
--    annullaImportazione), non si basa su un cascade dal batch.
-- 4) Funzione importa_spese_storiche: inserisce in un'unica
--    chiamata (quindi in un'unica transazione implicita) le spese
--    raggruppate (per descrizione, categoria, data_spesa,
--    fornitore) e le relative ripartizioni per unità, risolvendo
--    l'unità dal suo "identificativo" nel condominio indicato. Se
--    una riga fa riferimento a un'unità inesistente, la funzione
--    solleva un'eccezione e annulla tutto l'inserimento (niente
--    scritture parziali). Nessun security definer: gira con i
--    privilegi di chi la chiama, quindi le policy RLS
--    "spese_write_admin" e "ripartizioni_write_admin" restano
--    l'unico gate — solo un amministratore può eseguirla con
--    successo, coerente con l'assenza di un client service-role
--    in questo progetto.
-- ============================================================

alter table unita
  add constraint unita_condominio_identificativo_unique unique (condominio_id, identificativo);

create table import_batches (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condomini(id) on delete cascade,
  tipo text not null check (tipo in ('unita', 'spese')),
  nome_file text not null,
  righe_importate int not null default 0,
  creato_da uuid not null references utenti(id),
  created_at timestamptz not null default now()
);

create index idx_import_batches_condominio on import_batches(condominio_id);

alter table unita
  add column import_batch_id uuid references import_batches(id) on delete set null;

alter table spese
  add column import_batch_id uuid references import_batches(id) on delete set null;

alter table import_batches enable row level security;

create policy "import_batches_select" on import_batches
  for select using (
    ruolo_corrente() = 'amministratore' or appartiene_condominio(condominio_id)
  );

create policy "import_batches_write_admin" on import_batches
  for all using (ruolo_corrente() = 'amministratore')
  with check (ruolo_corrente() = 'amministratore');

-- Inserisce spese + ripartizioni in blocco a partire da righe "flat"
-- (una riga = una unità per una spesa). Raggruppa per
-- (descrizione, categoria, data_spesa, fornitore) e somma
-- importo_dovuto per calcolare importo_totale della spesa.
create or replace function public.importa_spese_storiche(
  p_condominio_id uuid,
  p_batch_id uuid,
  p_righe jsonb
)
returns table (spese_create int, ripartizioni_create int)
language plpgsql
as $$
begin
  if ruolo_corrente() <> 'amministratore' then
    raise exception 'Solo un amministratore può importare spese.';
  end if;

  create temporary table tmp_righe_import on commit drop as
  select
    trim(r->>'identificativoUnita') as identificativo_unita,
    r->>'descrizione' as descrizione,
    r->>'categoria' as categoria,
    (r->>'dataSpesa')::date as data_spesa,
    (r->>'importoDovuto')::numeric as importo_dovuto,
    nullif(r->>'fornitore', '') as fornitore,
    coalesce(nullif(r->>'statoPagamento', ''), 'da_pagare') as stato_pagamento,
    nullif(r->>'dataScadenza', '')::date as data_scadenza,
    nullif(r->>'dataPagamento', '')::date as data_pagamento
  from jsonb_array_elements(p_righe) r;

  alter table tmp_righe_import add column unita_id uuid;
  update tmp_righe_import t
  set unita_id = u.id
  from unita u
  where u.condominio_id = p_condominio_id and u.identificativo = t.identificativo_unita;

  if exists (select 1 from tmp_righe_import where unita_id is null) then
    raise exception 'Unità non trovate nel condominio selezionato: %', (
      select string_agg(distinct identificativo_unita, ', ')
      from tmp_righe_import where unita_id is null
    );
  end if;

  create temporary table tmp_spese_import on commit drop as
  select
    gen_random_uuid() as spesa_id,
    descrizione, categoria, data_spesa, fornitore,
    sum(importo_dovuto) as importo_totale
  from tmp_righe_import
  group by descrizione, categoria, data_spesa, fornitore;

  insert into spese (id, condominio_id, descrizione, categoria, data_spesa, importo_totale, fornitore, import_batch_id)
  select spesa_id, p_condominio_id, descrizione, categoria, data_spesa, importo_totale, fornitore, p_batch_id
  from tmp_spese_import;

  insert into ripartizioni (spesa_id, unita_id, importo_dovuto, stato_pagamento, data_scadenza, data_pagamento)
  select ts.spesa_id, tr.unita_id, tr.importo_dovuto, tr.stato_pagamento, tr.data_scadenza, tr.data_pagamento
  from tmp_righe_import tr
  join tmp_spese_import ts
    on ts.descrizione = tr.descrizione
    and ts.categoria = tr.categoria
    and ts.data_spesa = tr.data_spesa
    and coalesce(ts.fornitore, '') = coalesce(tr.fornitore, '');

  return query
    select (select count(*)::int from tmp_spese_import), (select count(*)::int from tmp_righe_import);
end;
$$;

grant execute on function importa_spese_storiche(uuid, uuid, jsonb) to authenticated;

-- ============================================================
-- Migrazione: importazione combinata condomini + unità
-- Applicata manualmente su Supabase (SQL Editor) il 2026-07-21.
-- Questo file è solo un registro storico: modificarlo non ha
-- alcun effetto sul database reale.
--
-- Motivo: con la sola importazione "unità per condominio già
-- esistente" un amministratore con 10 condomìni doveva comunque
-- creare a mano ciascun condominio prima di poter importare le sue
-- unità. Questo flusso lascia che sia il file stesso a contenere
-- più condomìni (una riga = una unità, con le colonne del
-- condominio ripetute su ogni riga); il server abbina i condomìni
-- già esistenti per (nome, indirizzo) e crea solo quelli mancanti.
--
-- 1) import_batches.condominio_id diventa nullable: un batch di
--    questo tipo copre più condomìni, non uno solo.
-- 2) Il check su "tipo" include il nuovo valore 'condomini_unita'.
-- 3) import_batch_id (nullable) anche su "condomini": serve per
--    annullare in sicurezza un'importazione. L'annullamento
--    cancella i condomìni CREATI da questo batch (quindi mai un
--    condominio preesistente a cui sono state solo aggiunte
--    unità) più, separatamente, le unità con questo batch_id
--    (che copre anche le unità aggiunte a condomìni preesistenti).
-- 4) Funzione importa_condomini_unita: stesso principio di
--    importa_spese_storiche (chiamata singola, transazionale,
--    niente security definer — le policy RLS restano il gate).
-- ============================================================

alter table import_batches alter column condominio_id drop not null;

alter table import_batches drop constraint import_batches_tipo_check;
alter table import_batches
  add constraint import_batches_tipo_check check (tipo in ('unita', 'spese', 'condomini_unita'));

alter table condomini
  add column import_batch_id uuid references import_batches(id) on delete set null;

create or replace function public.importa_condomini_unita(
  p_batch_id uuid,
  p_righe jsonb
)
returns table (condomini_creati int, condomini_riusati int, unita_create int)
language plpgsql
as $$
begin
  if ruolo_corrente() <> 'amministratore' then
    raise exception 'Solo un amministratore può importare condomini e unità.';
  end if;

  create temporary table tmp_righe_import on commit drop as
  select
    trim(r->>'nomeCondominio') as nome_condominio,
    trim(r->>'indirizzoCondominio') as indirizzo_condominio,
    nullif(r->>'codiceFiscaleCondominio', '') as codice_fiscale_condominio,
    trim(r->>'identificativo') as identificativo,
    nullif(r->>'piano', '') as piano,
    (r->>'millesimiProprieta')::numeric as millesimi_proprieta
  from jsonb_array_elements(p_righe) r;

  create temporary table tmp_condomini_import on commit drop as
  select distinct on (nome_condominio, indirizzo_condominio)
    nome_condominio, indirizzo_condominio, codice_fiscale_condominio as codice_fiscale
  from tmp_righe_import
  order by nome_condominio, indirizzo_condominio, codice_fiscale_condominio nulls last;

  alter table tmp_condomini_import add column condominio_id uuid;
  alter table tmp_condomini_import add column era_nuovo boolean not null default false;

  update tmp_condomini_import t
  set condominio_id = c.id
  from condomini c
  where c.nome = t.nome_condominio and c.indirizzo = t.indirizzo_condominio;

  with nuovi as (
    insert into condomini (id, nome, indirizzo, codice_fiscale, import_batch_id)
    select gen_random_uuid(), nome_condominio, indirizzo_condominio, codice_fiscale, p_batch_id
    from tmp_condomini_import
    where condominio_id is null
    returning id, nome, indirizzo
  )
  update tmp_condomini_import t
  set condominio_id = n.id, era_nuovo = true
  from nuovi n
  where n.nome = t.nome_condominio and n.indirizzo = t.indirizzo_condominio;

  alter table tmp_righe_import add column condominio_id uuid;
  update tmp_righe_import t
  set condominio_id = tc.condominio_id
  from tmp_condomini_import tc
  where tc.nome_condominio = t.nome_condominio and tc.indirizzo_condominio = t.indirizzo_condominio;

  insert into unita (condominio_id, identificativo, piano, millesimi_proprieta, import_batch_id)
  select condominio_id, identificativo, piano, millesimi_proprieta, p_batch_id
  from tmp_righe_import
  on conflict (condominio_id, identificativo) do update
  set piano = excluded.piano,
      millesimi_proprieta = excluded.millesimi_proprieta,
      import_batch_id = excluded.import_batch_id;

  return query
    select
      (select count(*)::int from tmp_condomini_import where era_nuovo),
      (select count(*)::int from tmp_condomini_import where not era_nuovo),
      (select count(*)::int from tmp_righe_import);
end;
$$;

grant execute on function importa_condomini_unita(uuid, jsonb) to authenticated;

-- ============================================================
-- Migrazione: link videoconferenza sulle assemblee
-- Applicata manualmente su Supabase (SQL Editor) il 2026-07-21.
-- Questo file è solo un registro storico: modificarlo non ha
-- alcun effetto sul database reale.
--
-- Solo il campo e la sua visualizzazione: l'amministratore incolla
-- un link Zoom/Meet/Webex già creato altrove, mostrato come
-- pulsante "Partecipa online" sia lato admin che ai condòmini.
-- Nessun invio email automatico (richiederebbe un provider email,
-- non presente in questo progetto): resta una scelta successiva
-- separata.
-- ============================================================

alter table assemblee
  add column link_videoconferenza text;

-- ============================================================
-- Migrazione: multi-tenancy tra amministratori
-- Da applicare manualmente su Supabase (SQL Editor).
--
-- Finora qualunque utente con ruolo 'amministratore' vedeva e
-- gestiva TUTTI i condomini della piattaforma: non esisteva
-- separazione tra amministratori diversi. Con più amministratori
-- sulla stessa installazione serve isolare i dati: ogni condominio
-- ha ora un proprietario (amministratore_id) e le policy RLS che
-- prima usavano "ruolo_corrente() = 'amministratore'" come lasciapassare
-- totale vengono ristrette al solo amministratore proprietario del
-- condominio coinvolto. Le policy lato condomino (appartiene_condominio,
-- possiede_unita) non cambiano: un condomino ha sempre visto solo i
-- propri dati tramite unita_proprietari, non serviva alcun isolamento lì.
--
-- Un amministratore appena registrato (o promosso) parte così con zero
-- condomini assegnati e non vede nulla degli altri amministratori.
-- ============================================================

-- 1) Proprietario del condominio, con backfill sui condomini esistenti
--    (assegnati al più "anziano" amministratore, presumibilmente l'unico
--    esistente finora) prima di rendere la colonna obbligatoria.
alter table condomini add column amministratore_id uuid references utenti(id);

update condomini
set amministratore_id = (
  select id from utenti where ruolo = 'amministratore' order by created_at asc limit 1
)
where amministratore_id is null;

alter table condomini alter column amministratore_id set not null;

-- 2) Funzioni helper RLS, sullo stesso modello di ruolo_corrente() /
--    appartiene_condominio() già presenti in questo file.
create or replace function public.admin_possiede_condominio(condominio uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.condomini c
    where c.id = condominio and c.amministratore_id = auth.uid()
  );
$$;

create or replace function public.admin_gestisce_unita(unita uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.unita u
    where u.id = unita and admin_possiede_condominio(u.condominio_id)
  );
$$;

create or replace function public.admin_gestisce_assemblea(assemblea uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.assemblee a
    where a.id = assemblea and admin_possiede_condominio(a.condominio_id)
  );
$$;

create or replace function public.admin_gestisce_spesa(spesa uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.spese s
    where s.id = spesa and admin_possiede_condominio(s.condominio_id)
  );
$$;

create or replace function public.admin_gestisce_utente(utente uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.unita_proprietari up
    join public.unita u on u.id = up.unita_id
    join public.condomini c on c.id = u.condominio_id
    where up.utente_id = utente and c.amministratore_id = auth.uid()
  );
$$;

-- 3) Riscrittura delle policy: ovunque "ruolo_corrente() = 'amministratore'"
--    fosse un lasciapassare totale, diventa scoped al proprio condominio.

-- ---- UTENTI ----
drop policy "utenti_select_self_or_admin" on utenti;
create policy "utenti_select_self_or_admin" on utenti
  for select using (id = auth.uid() or admin_gestisce_utente(id));

drop policy "utenti_update_self_or_admin" on utenti;
create policy "utenti_update_self_or_admin" on utenti
  for update using (id = auth.uid() or admin_gestisce_utente(id));

-- ---- CONDOMINI ----
drop policy "condomini_select" on condomini;
create policy "condomini_select" on condomini
  for select using (amministratore_id = auth.uid() or appartiene_condominio(id));

drop policy "condomini_write_admin" on condomini;
create policy "condomini_write_admin" on condomini
  for all using (ruolo_corrente() = 'amministratore' and amministratore_id = auth.uid())
  with check (ruolo_corrente() = 'amministratore' and amministratore_id = auth.uid());

-- ---- UNITA ----
drop policy "unita_select" on unita;
create policy "unita_select" on unita
  for select using (admin_possiede_condominio(condominio_id) or possiede_unita(id));

drop policy "unita_write_admin" on unita;
create policy "unita_write_admin" on unita
  for all using (ruolo_corrente() = 'amministratore' and admin_possiede_condominio(condominio_id))
  with check (ruolo_corrente() = 'amministratore' and admin_possiede_condominio(condominio_id));

-- ---- UNITA_PROPRIETARI ----
drop policy "unita_proprietari_select" on unita_proprietari;
create policy "unita_proprietari_select" on unita_proprietari
  for select using (admin_gestisce_unita(unita_id) or utente_id = auth.uid());

drop policy "unita_proprietari_write_admin" on unita_proprietari;
create policy "unita_proprietari_write_admin" on unita_proprietari
  for all using (ruolo_corrente() = 'amministratore' and admin_gestisce_unita(unita_id))
  with check (ruolo_corrente() = 'amministratore' and admin_gestisce_unita(unita_id));

-- ---- ASSEMBLEE ----
drop policy "assemblee_select" on assemblee;
create policy "assemblee_select" on assemblee
  for select using (admin_possiede_condominio(condominio_id) or appartiene_condominio(condominio_id));

drop policy "assemblee_write_admin" on assemblee;
create policy "assemblee_write_admin" on assemblee
  for all using (ruolo_corrente() = 'amministratore' and admin_possiede_condominio(condominio_id))
  with check (ruolo_corrente() = 'amministratore' and admin_possiede_condominio(condominio_id));

-- ---- PUNTI_ODG ----
drop policy "punti_odg_select" on punti_odg;
create policy "punti_odg_select" on punti_odg
  for select using (
    admin_gestisce_assemblea(assemblea_id) or exists (
      select 1 from assemblee a
      where a.id = punti_odg.assemblea_id and appartiene_condominio(a.condominio_id)
    )
  );

drop policy "punti_odg_write_admin" on punti_odg;
create policy "punti_odg_write_admin" on punti_odg
  for all using (ruolo_corrente() = 'amministratore' and admin_gestisce_assemblea(assemblea_id))
  with check (ruolo_corrente() = 'amministratore' and admin_gestisce_assemblea(assemblea_id));

-- ---- VOTI ----
drop policy "voti_select" on voti;
create policy "voti_select" on voti
  for select using (
    admin_gestisce_unita(unita_id) or utente_id = auth.uid() or possiede_unita(unita_id)
  );

drop policy "voti_insert_condomino" on voti;
create policy "voti_insert_condomino" on voti
  for insert with check (
    (ruolo_corrente() = 'amministratore' and admin_gestisce_unita(unita_id))
    or (
      utente_id = auth.uid()
      and possiede_unita(unita_id)
      and exists (
        select 1 from punti_odg p
        where p.id = voti.punto_id and p.stato_votazione = 'aperta'
      )
    )
  );

drop policy "voti_update_admin" on voti;
create policy "voti_update_admin" on voti
  for update using (ruolo_corrente() = 'amministratore' and admin_gestisce_unita(unita_id))
  with check (ruolo_corrente() = 'amministratore' and admin_gestisce_unita(unita_id));

drop policy "voti_delete_admin" on voti;
create policy "voti_delete_admin" on voti
  for delete using (ruolo_corrente() = 'amministratore' and admin_gestisce_unita(unita_id));

-- ---- SPESE ----
drop policy "spese_select" on spese;
create policy "spese_select" on spese
  for select using (admin_possiede_condominio(condominio_id) or appartiene_condominio(condominio_id));

drop policy "spese_write_admin" on spese;
create policy "spese_write_admin" on spese
  for all using (ruolo_corrente() = 'amministratore' and admin_possiede_condominio(condominio_id))
  with check (ruolo_corrente() = 'amministratore' and admin_possiede_condominio(condominio_id));

-- ---- RIPARTIZIONI ----
drop policy "ripartizioni_select" on ripartizioni;
create policy "ripartizioni_select" on ripartizioni
  for select using (admin_gestisce_unita(unita_id) or possiede_unita(unita_id));

drop policy "ripartizioni_write_admin" on ripartizioni;
create policy "ripartizioni_write_admin" on ripartizioni
  for all using (ruolo_corrente() = 'amministratore' and admin_gestisce_unita(unita_id))
  with check (ruolo_corrente() = 'amministratore' and admin_gestisce_unita(unita_id));

-- ---- PRESENZE ----
drop policy "presenze_select" on presenze;
create policy "presenze_select" on presenze
  for select using (
    admin_gestisce_unita(unita_id) or utente_id = auth.uid() or possiede_unita(unita_id)
  );

drop policy "presenze_insert_condomino" on presenze;
create policy "presenze_insert_condomino" on presenze
  for insert with check (
    (ruolo_corrente() = 'amministratore' and admin_gestisce_unita(unita_id))
    or (utente_id = auth.uid() and possiede_unita(unita_id))
  );

drop policy "presenze_update_admin" on presenze;
create policy "presenze_update_admin" on presenze
  for update using (ruolo_corrente() = 'amministratore' and admin_gestisce_unita(unita_id))
  with check (ruolo_corrente() = 'amministratore' and admin_gestisce_unita(unita_id));

drop policy "presenze_delete_admin" on presenze;
create policy "presenze_delete_admin" on presenze
  for delete using (ruolo_corrente() = 'amministratore' and admin_gestisce_unita(unita_id));

-- ---- DELEGHE ----
drop policy "deleghe_select" on deleghe;
create policy "deleghe_select" on deleghe
  for select using (
    admin_gestisce_unita(unita_delegante_id)
    or admin_gestisce_unita(unita_delegataria_id)
    or possiede_unita(unita_delegante_id)
    or possiede_unita(unita_delegataria_id)
  );

drop policy "deleghe_insert_condomino" on deleghe;
create policy "deleghe_insert_condomino" on deleghe
  for insert with check (
    (ruolo_corrente() = 'amministratore' and admin_gestisce_unita(unita_delegante_id))
    or possiede_unita(unita_delegante_id)
  );

drop policy "deleghe_write_admin" on deleghe;
create policy "deleghe_write_admin" on deleghe
  for update using (ruolo_corrente() = 'amministratore' and admin_gestisce_unita(unita_delegante_id))
  with check (ruolo_corrente() = 'amministratore' and admin_gestisce_unita(unita_delegante_id));

drop policy "deleghe_delete" on deleghe;
create policy "deleghe_delete" on deleghe
  for delete using (
    (ruolo_corrente() = 'amministratore' and admin_gestisce_unita(unita_delegante_id))
    or possiede_unita(unita_delegante_id)
  );

-- ---- IMPORT_BATCHES ----
-- Scoping su creato_da (non sul condominio): il tipo 'condomini_unita'
-- ha condominio_id nullable perché copre più condomini in un solo batch.
drop policy "import_batches_select" on import_batches;
create policy "import_batches_select" on import_batches
  for select using (
    (ruolo_corrente() = 'amministratore' and creato_da = auth.uid())
    or appartiene_condominio(condominio_id)
  );

drop policy "import_batches_write_admin" on import_batches;
create policy "import_batches_write_admin" on import_batches
  for all using (ruolo_corrente() = 'amministratore' and creato_da = auth.uid())
  with check (ruolo_corrente() = 'amministratore' and creato_da = auth.uid());

-- 4) importa_condomini_unita abbinava i condomini esistenti solo per
--    (nome, indirizzo), ignorando il proprietario: un amministratore che
--    importa un file con nome/indirizzo uguali a un condominio di un
--    ALTRO amministratore finirebbe per scrivere unità nel condominio
--    altrui. Va abbinato solo tra i condomini del chiamante, e i nuovi
--    condomini creati vanno assegnati a lui.
create or replace function public.importa_condomini_unita(
  p_batch_id uuid,
  p_righe jsonb
)
returns table (condomini_creati int, condomini_riusati int, unita_create int)
language plpgsql
as $$
begin
  if ruolo_corrente() <> 'amministratore' then
    raise exception 'Solo un amministratore può importare condomini e unità.';
  end if;

  create temporary table tmp_righe_import on commit drop as
  select
    trim(r->>'nomeCondominio') as nome_condominio,
    trim(r->>'indirizzoCondominio') as indirizzo_condominio,
    nullif(r->>'codiceFiscaleCondominio', '') as codice_fiscale_condominio,
    trim(r->>'identificativo') as identificativo,
    nullif(r->>'piano', '') as piano,
    (r->>'millesimiProprieta')::numeric as millesimi_proprieta
  from jsonb_array_elements(p_righe) r;

  create temporary table tmp_condomini_import on commit drop as
  select distinct on (nome_condominio, indirizzo_condominio)
    nome_condominio, indirizzo_condominio, codice_fiscale_condominio as codice_fiscale
  from tmp_righe_import
  order by nome_condominio, indirizzo_condominio, codice_fiscale_condominio nulls last;

  alter table tmp_condomini_import add column condominio_id uuid;
  alter table tmp_condomini_import add column era_nuovo boolean not null default false;

  update tmp_condomini_import t
  set condominio_id = c.id
  from condomini c
  where c.nome = t.nome_condominio
    and c.indirizzo = t.indirizzo_condominio
    and c.amministratore_id = auth.uid();

  with nuovi as (
    insert into condomini (id, nome, indirizzo, codice_fiscale, import_batch_id, amministratore_id)
    select gen_random_uuid(), nome_condominio, indirizzo_condominio, codice_fiscale, p_batch_id, auth.uid()
    from tmp_condomini_import
    where condominio_id is null
    returning id, nome, indirizzo
  )
  update tmp_condomini_import t
  set condominio_id = n.id, era_nuovo = true
  from nuovi n
  where n.nome = t.nome_condominio and n.indirizzo = t.indirizzo_condominio;

  alter table tmp_righe_import add column condominio_id uuid;
  update tmp_righe_import t
  set condominio_id = tc.condominio_id
  from tmp_condomini_import tc
  where tc.nome_condominio = t.nome_condominio and tc.indirizzo_condominio = t.indirizzo_condominio;

  insert into unita (condominio_id, identificativo, piano, millesimi_proprieta, import_batch_id)
  select condominio_id, identificativo, piano, millesimi_proprieta, p_batch_id
  from tmp_righe_import
  on conflict (condominio_id, identificativo) do update
  set piano = excluded.piano,
      millesimi_proprieta = excluded.millesimi_proprieta,
      import_batch_id = excluded.import_batch_id;

  return query
    select
      (select count(*)::int from tmp_condomini_import where era_nuovo),
      (select count(*)::int from tmp_condomini_import where not era_nuovo),
      (select count(*)::int from tmp_righe_import);
end;
$$;

-- ============================================================
-- Migrazione: collegamento condomini-unità + storage documenti
-- Da applicare manualmente su Supabase (SQL Editor).
--
-- 1) utenti_select_self_or_admin non permetteva a un amministratore di
--    "trovare" un condomino non ancora collegato a nessuna unità per
--    poterlo assegnare (admin_gestisce_utente richiede che sia già
--    collegato a un SUO condominio: circolare). Si aggiunge una terza
--    clausola che rende visibili (solo nome/cognome/email) i condomini
--    non ancora collegati a nessuna unità, indipendentemente da chi li
--    vede: una volta assegnati spariscono automaticamente dalla vista
--    degli altri amministratori (non sono più "non collegati").
-- 2) Bucket storage privato "documenti-condominio" per fatture spese e
--    verbali assemblea, con RLS sullo stesso modello delle tabelle:
--    path "spese/{spesa_id}/..." e "assemblee/{assemblea_id}/...".
-- ============================================================

drop policy "utenti_select_self_or_admin" on utenti;
create policy "utenti_select_self_or_admin" on utenti
  for select using (
    id = auth.uid()
    or admin_gestisce_utente(id)
    or (
      ruolo_corrente() = 'amministratore'
      and ruolo = 'condomino'
      and not exists (select 1 from unita_proprietari up where up.utente_id = utenti.id)
    )
  );

insert into storage.buckets (id, name, public)
values ('documenti-condominio', 'documenti-condominio', false)
on conflict (id) do nothing;

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
  )
);

create policy "documenti_insert_admin" on storage.objects for insert with check (
  bucket_id = 'documenti-condominio' and ruolo_corrente() = 'amministratore' and (
    ((storage.foldername(name))[1] = 'spese' and admin_gestisce_spesa(((storage.foldername(name))[2])::uuid))
    or ((storage.foldername(name))[1] = 'assemblee' and admin_gestisce_assemblea(((storage.foldername(name))[2])::uuid))
  )
);

create policy "documenti_delete_admin" on storage.objects for delete using (
  bucket_id = 'documenti-condominio' and ruolo_corrente() = 'amministratore' and (
    ((storage.foldername(name))[1] = 'spese' and admin_gestisce_spesa(((storage.foldername(name))[2])::uuid))
    or ((storage.foldername(name))[1] = 'assemblee' and admin_gestisce_assemblea(((storage.foldername(name))[2])::uuid))
  )
);

-- ============================================================
-- Migrazione: conto corrente del condominio
-- Da applicare manualmente su Supabase (SQL Editor).
--
-- Solo dati anagrafici del conto (IBAN, banca, intestatario): nessuna
-- integrazione bancaria, sono campi informativi mostrati in bacheca
-- e nei documenti (es. avvisi di pagamento) così i condòmini sanno
-- dove versare le quote. Nessuna nuova policy: coperti dalle policy
-- "condomini_select" / "condomini_write_admin" già esistenti, che si
-- applicano a livello di riga e quindi a tutte le colonne.
-- ============================================================

alter table condomini
  add column if not exists iban text,
  add column if not exists banca text,
  add column if not exists intestatario_conto text;

-- ============================================================
-- Migrazione: tipo di soggetto collegato a un'unità
-- Da applicare manualmente su Supabase (SQL Editor).
--
-- "unita_proprietari" finora trattava ogni riga come un proprietario
-- pieno. In realtà più figure possono essere collegate a un'unità
-- (nudo proprietario, usufruttuario, conduttore, comodatario), con
-- diritti diversi (es. il conduttore partecipa alle assemblee ma di
-- norma non vota sulle delibere che non lo riguardano). Si estende
-- la tabella esistente invece di crearne una nuova per non toccare
-- le policy RLS e la logica di voto già basate su "possiede_unita" /
-- "unita_proprietari": ogni soggetto collegato continua ad avere
-- accesso ai dati della propria unità come oggi, cambia solo
-- l'etichetta e, se l'amministratore lo imposta, il diritto di voto.
--
-- "diritto_voto" di default true per non rompere nulla di esistente:
-- nessuna logica automatica in base al tipo (la casistica reale
-- dipende dal tipo di delibera ed è compito dell'amministratore),
-- solo un interruttore esplicito che l'app potrà rispettare in fasi
-- successive (es. nascondere il pulsante di voto se false).
-- ============================================================

alter table unita_proprietari
  add column if not exists tipo_soggetto text not null default 'proprietario'
    check (tipo_soggetto in ('proprietario', 'nudo_proprietario', 'usufruttuario', 'conduttore', 'comodatario')),
  add column if not exists diritto_voto boolean not null default true;

-- ============================================================
-- Migrazione: tabelle millesimali multiple (ascensore, riscaldamento, ecc.)
-- Da applicare manualmente su Supabase (SQL Editor).
--
-- "unita.millesimi_proprieta" resta invariato ed è la tabella
-- "Generale" implicita: non viene toccato per non impattare la
-- logica di voto/quorum/ripartizione esistente, che continua a
-- funzionare esattamente come oggi. Le nuove tabelle sono additive e
-- servono per i casi in cui una spesa va ripartita su una proporzione
-- diversa dai millesimi generali (es. l'ascensore, a cui i piani
-- terra spesso non partecipano).
-- ============================================================

create table if not exists tabelle_millesimali (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condomini(id) on delete cascade,
  nome text not null,
  created_at timestamptz not null default now(),
  unique (condominio_id, nome)
);

create index if not exists idx_tabelle_millesimali_condominio on tabelle_millesimali(condominio_id);

create table if not exists valori_millesimali (
  id uuid primary key default gen_random_uuid(),
  tabella_id uuid not null references tabelle_millesimali(id) on delete cascade,
  unita_id uuid not null references unita(id) on delete cascade,
  valore numeric(6,3) not null default 0 check (valore >= 0),
  unique (tabella_id, unita_id)
);

create index if not exists idx_valori_millesimali_tabella on valori_millesimali(tabella_id);
create index if not exists idx_valori_millesimali_unita on valori_millesimali(unita_id);

alter table tabelle_millesimali enable row level security;
alter table valori_millesimali enable row level security;

create policy "tabelle_millesimali_select" on tabelle_millesimali
  for select using (
    admin_possiede_condominio(condominio_id) or appartiene_condominio(condominio_id)
  );

create policy "tabelle_millesimali_write_admin" on tabelle_millesimali
  for all using (ruolo_corrente() = 'amministratore' and admin_possiede_condominio(condominio_id))
  with check (ruolo_corrente() = 'amministratore' and admin_possiede_condominio(condominio_id));

create policy "valori_millesimali_select" on valori_millesimali
  for select using (admin_gestisce_unita(unita_id) or possiede_unita(unita_id));

create policy "valori_millesimali_write_admin" on valori_millesimali
  for all using (ruolo_corrente() = 'amministratore' and admin_gestisce_unita(unita_id))
  with check (ruolo_corrente() = 'amministratore' and admin_gestisce_unita(unita_id));

-- ============================================================
-- Migrazione: delega digitale in assemblea
-- Da applicare manualmente su Supabase (SQL Editor).
--
-- La tabella "deleghe" esisteva già ma non era usata da nessuna
-- pagina dell'app. Questa migrazione aggiunge quanto serve perché un
-- condomino possa votare anche per un'unità che gli è stata delegata:
--
-- 1) condominio_conteggio_unita: come condominio_millesimi_totali già
--    esistente, ma restituisce il NUMERO di unità invece della somma
--    millesimi. Serve lato applicazione per verificare il limite di
--    legge (art. 67 disp. att. c.c.) sul numero massimo di deleghe
--    cumulabili da uno stesso delegato: un condomino normale non può
--    leggere le unità altrui (policy "unita_select"), quindi senza
--    questa funzione non potrebbe calcolare il totale.
-- 2) deleghe_riepilogo_delegato: quante deleghe (e quanti millesimi)
--    ha già ricevuto un certo delegato per una certa assemblea.
--    Restituisce solo un aggregato (mai le singole deleghe altrui),
--    e resta ristretta a chi appartiene al condominio dell'assemblea
--    o la amministra — stesso principio di condominio_millesimi_totali.
-- 3) Le policy di insert/update sui voti permettevano di votare solo
--    al proprietario dell'unità (possiede_unita). Si aggiunge la
--    possibilità di votare anche a chi ha ricevuto una delega per
--    quella specifica unità in quella specifica assemblea.
-- ============================================================

create or replace function public.condominio_conteggio_unita(p_condominio_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from unita
  where condominio_id = p_condominio_id
    and (ruolo_corrente() = 'amministratore' or appartiene_condominio(p_condominio_id));
$$;

grant execute on function condominio_conteggio_unita(uuid) to authenticated;

create or replace function public.deleghe_riepilogo_delegato(
  p_assemblea_id uuid,
  p_utente_delegato_id uuid
)
returns table (numero_deleghe int, millesimi_totali numeric)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*)::int,
    coalesce(sum(u.millesimi_proprieta), 0)
  from deleghe d
  join unita u on u.id = d.unita_delegante_id
  join assemblee a on a.id = d.assemblea_id
  where d.assemblea_id = p_assemblea_id
    and d.utente_delegato_id = p_utente_delegato_id
    and (ruolo_corrente() = 'amministratore' or appartiene_condominio(a.condominio_id));
$$;

grant execute on function deleghe_riepilogo_delegato(uuid, uuid) to authenticated;

-- 4) candidati_delega: elenco dei condòmini (con diritto di voto) a cui
--    un condomino può delegare il proprio voto in un'assemblea. La
--    policy "unita_proprietari_select" limita ogni condomino a vedere
--    solo le proprie righe, quindi senza questa funzione non potrebbe
--    scoprire chi altro appartiene al condominio.
create or replace function public.candidati_delega(p_condominio_id uuid)
returns table (utente_id uuid, nome text, cognome text, unita_id uuid, identificativo text)
language sql
stable
security definer
set search_path = public
as $$
  select up.utente_id, ut.nome, ut.cognome, u.id, u.identificativo
  from unita_proprietari up
  join unita u on u.id = up.unita_id
  join utenti ut on ut.id = up.utente_id
  where u.condominio_id = p_condominio_id
    and up.diritto_voto = true
    and up.utente_id <> auth.uid()
    and (ruolo_corrente() = 'amministratore' or appartiene_condominio(p_condominio_id));
$$;

grant execute on function candidati_delega(uuid) to authenticated;

drop policy "voti_insert_condomino" on voti;
create policy "voti_insert_condomino" on voti
  for insert with check (
    (ruolo_corrente() = 'amministratore' and admin_gestisce_unita(unita_id))
    or (
      exists (
        select 1 from punti_odg p
        where p.id = voti.punto_id and p.stato_votazione = 'aperta'
      )
      and (
        (utente_id = auth.uid() and possiede_unita(unita_id))
        or (
          utente_id = auth.uid()
          and exists (
            select 1 from deleghe d
            join punti_odg p on p.id = voti.punto_id
            where d.assemblea_id = p.assemblea_id
              and d.unita_delegante_id = voti.unita_id
              and d.utente_delegato_id = auth.uid()
          )
        )
      )
    )
  );

drop policy "voti_update_condomino" on voti;
create policy "voti_update_condomino" on voti
  for update using (
    utente_id = auth.uid()
    and exists (
      select 1 from punti_odg p
      where p.id = voti.punto_id and p.stato_votazione = 'aperta'
    )
    and (
      possiede_unita(unita_id)
      or exists (
        select 1 from deleghe d
        join punti_odg p on p.id = voti.punto_id
        where d.assemblea_id = p.assemblea_id
          and d.unita_delegante_id = voti.unita_id
          and d.utente_delegato_id = auth.uid()
      )
    )
  )
  with check (
    utente_id = auth.uid()
    and exists (
      select 1 from punti_odg p
      where p.id = voti.punto_id and p.stato_votazione = 'aperta'
    )
    and (
      possiede_unita(unita_id)
      or exists (
        select 1 from deleghe d
        join punti_odg p on p.id = voti.punto_id
        where d.assemblea_id = p.assemblea_id
          and d.unita_delegante_id = voti.unita_id
          and d.utente_delegato_id = auth.uid()
      )
    )
  );

-- ============================================================
-- Migrazione: pagamento online con codice di riferimento (Stripe)
-- Da applicare manualmente su Supabase (SQL Editor).
--
-- "codice_avviso" è il numero di riferimento leggibile mostrato al
-- condomino (come un numero d'ordine/avviso di pagamento). Viene
-- generato automaticamente da una sequenza al momento dell'insert,
-- così sia le ripartizioni create dall'app sia quelle create dalla
-- funzione "importa_spese_storiche" lo ottengono senza bisogno di
-- modificare quella funzione. "stripe_checkout_session_id" collega
-- la rata alla sessione di pagamento Stripe che l'ha generata; il
-- webhook lo usa per correlare l'evento "checkout.session.completed"
-- alla riga da aggiornare.
-- ============================================================

create sequence if not exists ripartizioni_codice_seq;

alter table ripartizioni
  add column if not exists codice_avviso text unique
    default (
      'RIP-' || to_char(now(), 'YYYY') || '-' ||
      lpad(nextval('ripartizioni_codice_seq')::text, 6, '0')
    ),
  add column if not exists stripe_checkout_session_id text;


-- ============================================================
-- Migrazione: anagrafiche persone + import legami (Fase 3)
-- Da applicare su Supabase (SQL Editor). Idempotente.
--
-- Introduce le PERSONE del condominio come registro SLEGATO dal login:
-- una persona che non accede mai al portale (società, ex proprietario,
-- ecc.) esiste comunque in "anagrafiche". Il collegamento a un account
-- di login è opzionale (anagrafiche.utente_id) e avviene solo quando la
-- persona si registra.
-- ============================================================

-- 1) ANAGRAFICHE ------------------------------------------------
create table if not exists anagrafiche (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condomini(id) on delete cascade,
  nominativo text not null,
  email text,
  telefono text,
  tipo text not null default 'persona' check (tipo in ('persona', 'societa')),
  -- collegamento facoltativo a un account di login (valorizzato in futuro
  -- quando la persona si registra e "reclama" la sua anagrafica).
  utente_id uuid references utenti(id) on delete set null,
  import_batch_id uuid references import_batches(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_anagrafiche_condominio on anagrafiche(condominio_id);
create index if not exists idx_anagrafiche_utente on anagrafiche(utente_id);

-- 2) UNITA_PROPRIETARI: ora può riferire un'anagrafica ----------
-- utente_id diventa opzionale: un legame importato punta a un'anagrafica
-- (persona senza login), non a un utente. "attivo" distingue i legami
-- correnti da quelli storici (es. "ex proprietario") senza perdere il dato.
alter table unita_proprietari
  add column if not exists anagrafica_id uuid references anagrafiche(id) on delete cascade,
  add column if not exists attivo boolean not null default true;

alter table unita_proprietari alter column utente_id drop not null;

-- almeno uno tra utente_id e anagrafica_id dev'essere presente
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'unita_proprietari_ref_check') then
    alter table unita_proprietari
      add constraint unita_proprietari_ref_check
      check (utente_id is not null or anagrafica_id is not null);
  end if;
end $$;

-- una stessa anagrafica compare una sola volta per unità (permette il
-- re-import idempotente); i legami "vecchio stile" con utente_id null
-- non collidono perché l'indice è parziale.
create unique index if not exists uq_unita_proprietari_anagrafica
  on unita_proprietari (unita_id, anagrafica_id) where anagrafica_id is not null;

-- 3) tipo_soggetto: aggiungo 'assegnatario' ai valori ammessi ---
alter table unita_proprietari drop constraint if exists unita_proprietari_tipo_soggetto_check;
alter table unita_proprietari
  add constraint unita_proprietari_tipo_soggetto_check
  check (tipo_soggetto in ('proprietario', 'nudo_proprietario', 'usufruttuario', 'conduttore', 'comodatario', 'assegnatario'));

-- 4) RLS su anagrafiche -----------------------------------------
alter table anagrafiche enable row level security;

drop policy if exists "anagrafiche_select" on anagrafiche;
create policy "anagrafiche_select" on anagrafiche
  for select using (admin_possiede_condominio(condominio_id) or utente_id = auth.uid());

drop policy if exists "anagrafiche_write_admin" on anagrafiche;
create policy "anagrafiche_write_admin" on anagrafiche
  for all using (ruolo_corrente() = 'amministratore' and admin_possiede_condominio(condominio_id))
  with check (ruolo_corrente() = 'amministratore' and admin_possiede_condominio(condominio_id));

-- 5) Funzione di import: condominio + unità + PERSONE -----------
-- Riceve le righe "per persona" (una riga per occupante). Crea/riusa i
-- condomìni (per nome+indirizzo), le unità (per identificativo, millesimi
-- = valore valido più alto), le anagrafiche (per email o nominativo nello
-- stesso condominio) e i legami unita_proprietari. Idempotente.
create or replace function public.importa_condomini_unita_persone(
  p_batch_id uuid,
  p_righe jsonb
)
returns table (condomini_creati int, condomini_riusati int, unita_create int, persone_create int)
language plpgsql
as $$
begin
  if ruolo_corrente() <> 'amministratore' then
    raise exception 'Solo un amministratore può importare condomini, unità e persone.';
  end if;

  create temporary table tmp_righe on commit drop as
  select
    trim(r->>'nomeCondominio') as nome_condominio,
    trim(r->>'indirizzoCondominio') as indirizzo_condominio,
    nullif(r->>'codiceFiscaleCondominio', '') as codice_fiscale,
    trim(r->>'identificativo') as identificativo,
    nullif(r->>'piano', '') as piano,
    nullif(r->>'millesimiProprieta', '')::numeric as millesimi_proprieta,
    nullif(trim(r->>'nominativo'), '') as nominativo,
    nullif(trim(r->>'email'), '') as email,
    coalesce(nullif(r->>'tipoSoggetto', ''), 'proprietario') as tipo_soggetto,
    coalesce(nullif(r->>'quota', '')::numeric, 100) as quota,
    coalesce((r->>'attivo')::boolean, true) as attivo
  from jsonb_array_elements(p_righe) r;

  -- chiave anagrafica (email se presente, altrimenti nominativo)
  alter table tmp_righe add column chiave_anag text;
  update tmp_righe set chiave_anag = coalesce(email, lower(nominativo));

  -- ---- condomìni ----
  create temporary table tmp_cond on commit drop as
  select nome_condominio, indirizzo_condominio,
    (array_agg(codice_fiscale) filter (where codice_fiscale is not null))[1] as codice_fiscale
  from tmp_righe group by nome_condominio, indirizzo_condominio;
  alter table tmp_cond add column condominio_id uuid;
  alter table tmp_cond add column era_nuovo boolean not null default false;

  update tmp_cond t set condominio_id = c.id
  from condomini c
  where c.nome = t.nome_condominio and c.indirizzo = t.indirizzo_condominio
    and c.amministratore_id = auth.uid();

  with nuovi as (
    insert into condomini (id, nome, indirizzo, codice_fiscale, import_batch_id, amministratore_id)
    select gen_random_uuid(), nome_condominio, indirizzo_condominio, codice_fiscale, p_batch_id, auth.uid()
    from tmp_cond where condominio_id is null
    returning id, nome, indirizzo
  )
  update tmp_cond t set condominio_id = n.id, era_nuovo = true
  from nuovi n where n.nome = t.nome_condominio and n.indirizzo = t.indirizzo_condominio;

  alter table tmp_righe add column condominio_id uuid;
  update tmp_righe t set condominio_id = c.condominio_id
  from tmp_cond c
  where c.nome_condominio = t.nome_condominio and c.indirizzo_condominio = t.indirizzo_condominio;

  -- ---- unità ----
  create temporary table tmp_unita on commit drop as
  select condominio_id, identificativo,
    (array_agg(piano) filter (where piano is not null))[1] as piano,
    max(millesimi_proprieta) as millesimi_proprieta
  from tmp_righe where identificativo <> '' group by condominio_id, identificativo;

  insert into unita (condominio_id, identificativo, piano, millesimi_proprieta, import_batch_id)
  select condominio_id, identificativo, piano, coalesce(millesimi_proprieta, 0), p_batch_id
  from tmp_unita
  on conflict (condominio_id, identificativo) do update
  set piano = excluded.piano,
      millesimi_proprieta = excluded.millesimi_proprieta,
      import_batch_id = excluded.import_batch_id;

  -- ---- anagrafiche ----
  create temporary table tmp_anag on commit drop as
  select condominio_id, chiave_anag,
    (array_agg(nominativo))[1] as nominativo,
    (array_agg(email) filter (where email is not null))[1] as email
  from tmp_righe where nominativo is not null
  group by condominio_id, chiave_anag;
  alter table tmp_anag add column anagrafica_id uuid;

  -- riusa anagrafiche già esistenti (stessa email, stesso condominio)
  update tmp_anag t set anagrafica_id = a.id
  from anagrafiche a
  where a.condominio_id = t.condominio_id and t.email is not null and a.email = t.email;

  with nuove as (
    insert into anagrafiche (condominio_id, nominativo, email, import_batch_id)
    select condominio_id, nominativo, email, p_batch_id
    from tmp_anag where anagrafica_id is null
    returning id, condominio_id, coalesce(email, lower(nominativo)) as chiave
  )
  update tmp_anag t set anagrafica_id = n.id
  from nuove n
  where n.condominio_id = t.condominio_id and n.chiave = t.chiave_anag;

  -- ---- legami unita_proprietari ----
  -- distinct on (unità, anagrafica): la stessa persona può comparire su più
  -- righe della stessa unità (ruoli combinati o righe duplicate); un legame
  -- dev'essere unico. A parità, si preferisce il legame attivo.
  insert into unita_proprietari (unita_id, anagrafica_id, quota_possesso, tipo_soggetto, attivo, utente_id)
  select distinct on (u.id, ta.anagrafica_id)
    u.id, ta.anagrafica_id, r.quota, r.tipo_soggetto, r.attivo, null
  from tmp_righe r
  join unita u on u.condominio_id = r.condominio_id and u.identificativo = r.identificativo
  join tmp_anag ta on ta.condominio_id = r.condominio_id and ta.chiave_anag = r.chiave_anag
  where r.nominativo is not null and r.identificativo <> ''
  order by u.id, ta.anagrafica_id, r.attivo desc
  on conflict (unita_id, anagrafica_id) where anagrafica_id is not null do update
  set quota_possesso = excluded.quota_possesso,
      tipo_soggetto = excluded.tipo_soggetto,
      attivo = excluded.attivo;

  return query select
    (select count(*)::int from tmp_cond where era_nuovo),
    (select count(*)::int from tmp_cond where not era_nuovo),
    (select count(*)::int from tmp_unita),
    (select count(*)::int from tmp_anag);
end;
$$;

grant execute on function importa_condomini_unita_persone(uuid, jsonb) to authenticated;


-- ============================================================
-- Fase 4: import dei millesimi multipli
-- La funzione di import accetta ora un terzo parametro p_millesimi:
--   [{ nomeCondominio, indirizzoCondominio, identificativo, nomeTabella, valore }]
-- e popola tabelle_millesimali + valori_millesimali (una tabella per tipo
-- di millesimi presente nel file, es. Generali, Ascensore, Garage, Scala A).
-- Idempotente. Da applicare su Supabase (SQL Editor).
-- ============================================================

drop function if exists public.importa_condomini_unita_persone(uuid, jsonb);

create or replace function public.importa_condomini_unita_persone(
  p_batch_id uuid,
  p_righe jsonb,
  p_millesimi jsonb default '[]'::jsonb
)
returns table (condomini_creati int, condomini_riusati int, unita_create int, persone_create int)
language plpgsql
as $$
begin
  if ruolo_corrente() <> 'amministratore' then
    raise exception 'Solo un amministratore può importare condomini, unità e persone.';
  end if;

  create temporary table tmp_righe on commit drop as
  select
    trim(r->>'nomeCondominio') as nome_condominio,
    trim(r->>'indirizzoCondominio') as indirizzo_condominio,
    nullif(r->>'codiceFiscaleCondominio', '') as codice_fiscale,
    trim(r->>'identificativo') as identificativo,
    nullif(r->>'piano', '') as piano,
    nullif(r->>'millesimiProprieta', '')::numeric as millesimi_proprieta,
    nullif(trim(r->>'nominativo'), '') as nominativo,
    nullif(trim(r->>'email'), '') as email,
    coalesce(nullif(r->>'tipoSoggetto', ''), 'proprietario') as tipo_soggetto,
    coalesce(nullif(r->>'quota', '')::numeric, 100) as quota,
    coalesce((r->>'attivo')::boolean, true) as attivo
  from jsonb_array_elements(p_righe) r;

  alter table tmp_righe add column chiave_anag text;
  update tmp_righe set chiave_anag = coalesce(email, lower(nominativo));

  -- ---- condomìni ----
  create temporary table tmp_cond on commit drop as
  select nome_condominio, indirizzo_condominio,
    (array_agg(codice_fiscale) filter (where codice_fiscale is not null))[1] as codice_fiscale
  from tmp_righe group by nome_condominio, indirizzo_condominio;
  alter table tmp_cond add column condominio_id uuid;
  alter table tmp_cond add column era_nuovo boolean not null default false;

  update tmp_cond t set condominio_id = c.id
  from condomini c
  where c.nome = t.nome_condominio and c.indirizzo = t.indirizzo_condominio
    and c.amministratore_id = auth.uid();

  with nuovi as (
    insert into condomini (id, nome, indirizzo, codice_fiscale, import_batch_id, amministratore_id)
    select gen_random_uuid(), nome_condominio, indirizzo_condominio, codice_fiscale, p_batch_id, auth.uid()
    from tmp_cond where condominio_id is null
    returning id, nome, indirizzo
  )
  update tmp_cond t set condominio_id = n.id, era_nuovo = true
  from nuovi n where n.nome = t.nome_condominio and n.indirizzo = t.indirizzo_condominio;

  alter table tmp_righe add column condominio_id uuid;
  update tmp_righe t set condominio_id = c.condominio_id
  from tmp_cond c
  where c.nome_condominio = t.nome_condominio and c.indirizzo_condominio = t.indirizzo_condominio;

  -- ---- unità ----
  create temporary table tmp_unita on commit drop as
  select condominio_id, identificativo,
    (array_agg(piano) filter (where piano is not null))[1] as piano,
    max(millesimi_proprieta) as millesimi_proprieta
  from tmp_righe where identificativo <> '' group by condominio_id, identificativo;

  insert into unita (condominio_id, identificativo, piano, millesimi_proprieta, import_batch_id)
  select condominio_id, identificativo, piano, coalesce(millesimi_proprieta, 0), p_batch_id
  from tmp_unita
  on conflict (condominio_id, identificativo) do update
  set piano = excluded.piano,
      millesimi_proprieta = excluded.millesimi_proprieta,
      import_batch_id = excluded.import_batch_id;

  -- ---- anagrafiche ----
  create temporary table tmp_anag on commit drop as
  select condominio_id, chiave_anag,
    (array_agg(nominativo))[1] as nominativo,
    (array_agg(email) filter (where email is not null))[1] as email
  from tmp_righe where nominativo is not null
  group by condominio_id, chiave_anag;
  alter table tmp_anag add column anagrafica_id uuid;

  update tmp_anag t set anagrafica_id = a.id
  from anagrafiche a
  where a.condominio_id = t.condominio_id and t.email is not null and a.email = t.email;

  with nuove as (
    insert into anagrafiche (condominio_id, nominativo, email, import_batch_id)
    select condominio_id, nominativo, email, p_batch_id
    from tmp_anag where anagrafica_id is null
    returning id, condominio_id, coalesce(email, lower(nominativo)) as chiave
  )
  update tmp_anag t set anagrafica_id = n.id
  from nuove n
  where n.condominio_id = t.condominio_id and n.chiave = t.chiave_anag;

  -- ---- legami unita_proprietari ----
  insert into unita_proprietari (unita_id, anagrafica_id, quota_possesso, tipo_soggetto, attivo, utente_id)
  select distinct on (u.id, ta.anagrafica_id)
    u.id, ta.anagrafica_id, r.quota, r.tipo_soggetto, r.attivo, null
  from tmp_righe r
  join unita u on u.condominio_id = r.condominio_id and u.identificativo = r.identificativo
  join tmp_anag ta on ta.condominio_id = r.condominio_id and ta.chiave_anag = r.chiave_anag
  where r.nominativo is not null and r.identificativo <> ''
  order by u.id, ta.anagrafica_id, r.attivo desc
  on conflict (unita_id, anagrafica_id) where anagrafica_id is not null do update
  set quota_possesso = excluded.quota_possesso,
      tipo_soggetto = excluded.tipo_soggetto,
      attivo = excluded.attivo;

  -- ---- millesimi multipli ----
  if jsonb_array_length(coalesce(p_millesimi, '[]'::jsonb)) > 0 then
    create temporary table tmp_mill on commit drop as
    select
      trim(m->>'nomeCondominio') as nome_condominio,
      trim(m->>'indirizzoCondominio') as indirizzo_condominio,
      trim(m->>'identificativo') as identificativo,
      trim(m->>'nomeTabella') as nome_tabella,
      (m->>'valore')::numeric as valore
    from jsonb_array_elements(p_millesimi) m
    where nullif(m->>'valore', '') is not null and nullif(trim(m->>'nomeTabella'), '') is not null;

    alter table tmp_mill add column condominio_id uuid;
    update tmp_mill t set condominio_id = c.condominio_id
    from tmp_cond c
    where c.nome_condominio = t.nome_condominio and c.indirizzo_condominio = t.indirizzo_condominio;

    insert into tabelle_millesimali (condominio_id, nome)
    select distinct condominio_id, nome_tabella
    from tmp_mill where condominio_id is not null
    on conflict (condominio_id, nome) do nothing;

    insert into valori_millesimali (tabella_id, unita_id, valore)
    select tm.id, u.id, max(t.valore)
    from tmp_mill t
    join tabelle_millesimali tm on tm.condominio_id = t.condominio_id and tm.nome = t.nome_tabella
    join unita u on u.condominio_id = t.condominio_id and u.identificativo = t.identificativo
    group by tm.id, u.id
    on conflict (tabella_id, unita_id) do update set valore = excluded.valore;
  end if;

  return query select
    (select count(*)::int from tmp_cond where era_nuovo),
    (select count(*)::int from tmp_cond where not era_nuovo),
    (select count(*)::int from tmp_unita),
    (select count(*)::int from tmp_anag);
end;
$$;

grant execute on function importa_condomini_unita_persone(uuid, jsonb, jsonb) to authenticated;
