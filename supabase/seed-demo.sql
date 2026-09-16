-- ============================================================
-- seed-demo.sql — dati di prova per il portale condominio
-- ============================================================
-- COSA FA: crea un condominio finto ("Condominio Demo — Via Verdi 10")
-- con 6 unità, 6 persone in anagrafica, spese e quote (alcune pagate,
-- alcune scadute), un'assemblea con ordine del giorno, fornitori e
-- manutenzioni programmate, segnalazioni, documenti e spazi comuni
-- prenotabili. Serve per vedere il sito popolato senza inserire tutto
-- a mano.
--
-- PRIMA DI QUESTO: esegui `supabase/migrazioni-restyling.sql`, altrimenti
-- le tabelle nuove (segnalazioni, ecc.) non esistono ancora.
--
-- COME USARLO: Supabase -> SQL Editor -> incolla tutto -> Run.
-- Va eseguito UNA VOLTA: se rilanci e il condominio demo c'è già, non
-- fa nulla. Per rifarlo da capo, prima cancella il condominio demo
-- (in fondo al file c'è la riga pronta, commentata).
--
-- NOTE:
--  * le persone del demo sono in ANAGRAFICA, senza account di login:
--    per vederle nell'area riservata servirebbe un utente vero
--    collegato. L'area amministratore invece mostra tutto.
--  * i documenti demo hanno una riga in tabella ma NON un file vero
--    nello storage: l'elenco si vede, il download dà errore. È
--    normale, carica un PDF vero dall'interfaccia per provarlo.
--  * i campi che richiedono un utente reale (chi ha aperto una
--    segnalazione, chi ha caricato un documento, ecc.) sono attribuiti
--    al tuo utente amministratore.
-- ============================================================

do $$
declare
  -- ====================================================================
  -- SCRIVI QUI L'EMAIL DELL'ACCOUNT CON CUI FAI LOGIN NEL PORTALE.
  -- Il condominio demo viene intestato a quell'amministratore: se lo
  -- intesti a un altro account, tu non lo vedi (l'RLS lo nasconde) e le
  -- sue pagine rispondono "404 pagina non trovata".
  -- Lasciando la stringa vuota usa il primo amministratore registrato,
  -- che con più account admin è quasi sempre quello sbagliato.
  -- ====================================================================
  v_email_admin text := '';

  v_admin uuid;
  v_cond  uuid;
  u1 uuid; u2 uuid; u3 uuid; u4 uuid; u5 uuid; u6 uuid;
  a1 uuid; a2 uuid; a3 uuid; a4 uuid; a5 uuid; a6 uuid;
  s1 uuid; s2 uuid; s3 uuid;
  v_ass uuid;
  f1 uuid; f2 uuid;
  sp1 uuid; sp2 uuid;
  seg1 uuid;
begin
  -- Utente amministratore a cui intestare il condominio demo.
  if v_email_admin <> '' then
    select id into v_admin from utenti
      where lower(email) = lower(v_email_admin) and ruolo = 'amministratore';
    if v_admin is null then
      raise exception 'Nessun amministratore con email "%". Controlla la mail in cima al file.', v_email_admin;
    end if;
  else
    select id into v_admin from utenti where ruolo = 'amministratore'
      order by created_at limit 1;
    if v_admin is null then
      raise exception 'Nessun utente amministratore: registrane uno dal portale e riprova.';
    end if;
  end if;

  if exists (select 1 from condomini where nome = 'Condominio Demo — Via Verdi 10') then
    raise notice 'Il condominio demo esiste già: non faccio nulla.';
    return;
  end if;

  -- ---- CONDOMINIO + CONTO CORRENTE ----------------------------------
  insert into condomini (nome, indirizzo, codice_fiscale, iban, banca, intestatario_conto, amministratore_id)
  values ('Condominio Demo — Via Verdi 10', 'Via Giuseppe Verdi 10, 20121 Milano',
          '97012345678', 'IT60X0542811101000000123456', 'Banca Demo S.p.A.',
          'Condominio Via Verdi 10', v_admin)
  returning id into v_cond;

  -- ---- UNITÀ (millesimi: 180+155+210+165+140+150 = 1000) -----------
  insert into unita (condominio_id, identificativo, piano, millesimi_proprieta)
    values (v_cond, 'Scala A - Interno 1', 'Piano terra', 180) returning id into u1;
  insert into unita (condominio_id, identificativo, piano, millesimi_proprieta)
    values (v_cond, 'Scala A - Interno 2', 'Primo piano', 155) returning id into u2;
  insert into unita (condominio_id, identificativo, piano, millesimi_proprieta)
    values (v_cond, 'Scala A - Interno 3', 'Secondo piano', 210) returning id into u3;
  insert into unita (condominio_id, identificativo, piano, millesimi_proprieta)
    values (v_cond, 'Scala B - Interno 4', 'Piano terra', 165) returning id into u4;
  insert into unita (condominio_id, identificativo, piano, millesimi_proprieta)
    values (v_cond, 'Scala B - Interno 5', 'Primo piano', 140) returning id into u5;
  insert into unita (condominio_id, identificativo, piano, millesimi_proprieta)
    values (v_cond, 'Scala B - Interno 6', 'Secondo piano', 150) returning id into u6;

  -- ---- ANAGRAFICHE (persone senza login) --------------------------
  insert into anagrafiche (condominio_id, nominativo, email, telefono, tipo)
    values (v_cond, 'Mario Rossi', 'mario.rossi@example.com', '333 1110001', 'persona') returning id into a1;
  insert into anagrafiche (condominio_id, nominativo, email, telefono, tipo)
    values (v_cond, 'Giulia Bianchi', 'giulia.bianchi@example.com', '333 1110002', 'persona') returning id into a2;
  insert into anagrafiche (condominio_id, nominativo, email, telefono, tipo)
    values (v_cond, 'Luca Verdi', 'luca.verdi@example.com', '333 1110003', 'persona') returning id into a3;
  insert into anagrafiche (condominio_id, nominativo, email, telefono, tipo)
    values (v_cond, 'Anna Neri', 'anna.neri@example.com', '333 1110004', 'persona') returning id into a4;
  insert into anagrafiche (condominio_id, nominativo, email, telefono, tipo)
    values (v_cond, 'Paolo Gallo', 'paolo.gallo@example.com', '333 1110005', 'persona') returning id into a5;
  insert into anagrafiche (condominio_id, nominativo, email, telefono, tipo)
    values (v_cond, 'Immobiliare Sole S.r.l.', 'amministrazione@immobiliaresole.it', '02 5550006', 'societa') returning id into a6;

  -- ---- LEGAMI UNITÀ <-> PERSONE -----------------------------------
  insert into unita_proprietari (unita_id, anagrafica_id) values
    (u1, a1), (u2, a2), (u3, a3), (u4, a4), (u5, a5), (u6, a6);

  -- ---- SPESE ------------------------------------------------------
  insert into spese (condominio_id, descrizione, importo_totale, categoria, data_spesa, fornitore)
    values (v_cond, 'Gestione ordinaria 1° semestre 2026', 3000.00, 'ordinaria', '2026-01-15', 'Vari')
    returning id into s1;
  insert into spese (condominio_id, descrizione, importo_totale, categoria, data_spesa, fornitore)
    values (v_cond, 'Rifacimento facciata (lavori straordinari)', 12000.00, 'straordinaria', '2026-03-01', 'Edilizia Rossi S.r.l.')
    returning id into s2;
  insert into spese (condominio_id, descrizione, importo_totale, categoria, data_spesa, fornitore)
    values (v_cond, 'Gestione ordinaria 2° semestre 2026', 2400.00, 'ordinaria', '2026-07-01', 'Vari')
    returning id into s3;

  -- ---- RIPARTIZIONI (quote per unità) ----------------------------
  -- s1: scadenza 28/02/2026 — Interno 4 già pagata, le altre no.
  insert into ripartizioni (spesa_id, unita_id, importo_dovuto, stato_pagamento, data_scadenza, data_pagamento, codice_avviso) values
    (s1, u1, 540.00, 'da_pagare',  '2026-02-28', null,         'DEMO-2026-000001'),
    (s1, u2, 465.00, 'da_pagare',  '2026-02-28', null,         'DEMO-2026-000002'),
    (s1, u3, 630.00, 'da_pagare',  '2026-02-28', null,         'DEMO-2026-000003'),
    (s1, u4, 495.00, 'pagato',     '2026-02-28', '2026-02-20', 'DEMO-2026-000004'),
    (s1, u5, 420.00, 'da_pagare',  '2026-02-28', null,         'DEMO-2026-000005'),
    (s1, u6, 450.00, 'da_pagare',  '2026-02-28', null,         'DEMO-2026-000006');

  -- s2: scadenza 30/06/2026 — due quote già in ritardo.
  insert into ripartizioni (spesa_id, unita_id, importo_dovuto, stato_pagamento, data_scadenza, data_pagamento, codice_avviso) values
    (s2, u1, 2160.00, 'da_pagare',  '2026-06-30', null, 'DEMO-2026-000101'),
    (s2, u2, 1860.00, 'da_pagare',  '2026-06-30', null, 'DEMO-2026-000102'),
    (s2, u3, 2520.00, 'in_ritardo', '2026-06-30', null, 'DEMO-2026-000103'),
    (s2, u4, 1980.00, 'da_pagare',  '2026-06-30', null, 'DEMO-2026-000104'),
    (s2, u5, 1680.00, 'in_ritardo', '2026-06-30', null, 'DEMO-2026-000105'),
    (s2, u6, 1800.00, 'da_pagare',  '2026-06-30', null, 'DEMO-2026-000106');

  -- s3: scadenza 31/10/2026 — tutte ancora da pagare (scadenza futura).
  insert into ripartizioni (spesa_id, unita_id, importo_dovuto, stato_pagamento, data_scadenza, data_pagamento, codice_avviso) values
    (s3, u1, 432.00, 'da_pagare', '2026-10-31', null, 'DEMO-2026-000201'),
    (s3, u2, 372.00, 'da_pagare', '2026-10-31', null, 'DEMO-2026-000202'),
    (s3, u3, 504.00, 'da_pagare', '2026-10-31', null, 'DEMO-2026-000203'),
    (s3, u4, 396.00, 'da_pagare', '2026-10-31', null, 'DEMO-2026-000204'),
    (s3, u5, 336.00, 'da_pagare', '2026-10-31', null, 'DEMO-2026-000205'),
    (s3, u6, 360.00, 'da_pagare', '2026-10-31', null, 'DEMO-2026-000206');

  -- ---- ASSEMBLEA + ORDINE DEL GIORNO ----------------------------
  insert into assemblee (condominio_id, data_assemblea, tipo, stato, convocazione, luogo)
    values (v_cond, '2026-09-25 18:00:00+02', 'ordinaria', 'convocata', 1,
            'Sala riunioni, Via Verdi 10 — Milano')
    returning id into v_ass;

  insert into punti_odg (assemblea_id, numero_punto, descrizione, tipo_maggioranza) values
    (v_ass, 1, 'Approvazione del rendiconto consuntivo 2025', 'semplice'),
    (v_ass, 2, 'Approvazione del preventivo 2026 e riparto delle quote', 'semplice'),
    (v_ass, 3, 'Lavori di rifacimento facciata: affidamento e modalità di finanziamento', 'qualificata');

  -- ---- FORNITORI + MANUTENZIONI PROGRAMMATE ---------------------
  insert into fornitori (condominio_id, nome, categoria, referente, email, telefono, partita_iva)
    values (v_cond, 'Ascensori Milano S.r.l.', 'ascensore', 'Ing. Fabio Testa',
            'assistenza@ascensorimilano.it', '02 1234567', '01234567890')
    returning id into f1;
  insert into fornitori (condominio_id, nome, categoria, referente, email, telefono, partita_iva)
    values (v_cond, 'Verde & Pulizie S.n.c.', 'pulizie', 'Laura Sala',
            'info@verdepulizie.it', '333 9988776', '09876543210')
    returning id into f2;

  insert into manutenzioni_programmate
    (condominio_id, fornitore_id, titolo, descrizione, data_prossima, periodicita, stato, costo_previsto) values
    (v_cond, f1, 'Verifica periodica ascensore',
     'Controllo semestrale obbligatorio con rilascio del verbale.', '2026-08-15', 'semestrale', 'programmata', 180.00),
    (v_cond, f1, 'Manutenzione fune e quadro di manovra ascensore',
     'Intervento annuale programmato dal contratto di manutenzione.', '2026-09-20', 'annuale', 'programmata', 350.00),
    (v_cond, f2, 'Pulizia straordinaria vetri e parti comuni',
     'Pulizia a fondo di androne, scale e vetrate.', '2026-11-30', 'trimestrale', 'programmata', 220.00);

  -- ---- SEGNALAZIONI --------------------------------------------
  insert into segnalazioni
    (condominio_id, unita_id, titolo, descrizione, categoria, priorita, stato, aperta_da) values
    (v_cond, null, 'Luce guasta nell''androne',
     'La plafoniera all''ingresso non si accende da lunedì, la sera si entra al buio.',
     'elettrico', 'alta', 'aperta', v_admin)
    returning id into seg1;
  insert into segnalazioni
    (condominio_id, unita_id, titolo, descrizione, categoria, priorita, stato, aperta_da) values
    (v_cond, u3, 'Infiltrazione dal soffitto della cantina',
     'Dopo le piogge della settimana scorsa c''è una macchia di umidità che si allarga.',
     'infiltrazioni', 'normale', 'in_corso', v_admin);
  insert into segnalazioni
    (condominio_id, unita_id, titolo, descrizione, categoria, priorita, stato, fornitore_id, aperta_da, chiusa_il) values
    (v_cond, null, 'Ascensore fermo al piano terra',
     'L''ascensore non risponde alle chiamate, resta bloccato al piano terra con le porte aperte.',
     'ascensore', 'alta', 'chiusa', f1, v_admin, '2026-08-30 09:30:00+02');

  insert into segnalazione_note (segnalazione_id, autore_id, testo, interna) values
    (seg1, v_admin, 'Ho sentito l''elettricista: passa giovedì mattina a sostituire il corpo illuminante.', false);

  -- ---- ARCHIVIO DOCUMENTI (righe senza file reale nello storage) -
  insert into documenti_condominio
    (condominio_id, titolo, descrizione, categoria, percorso, nome_file, dimensione_byte, mime_type, caricato_da) values
    (v_cond, 'Regolamento condominiale', 'Regolamento vigente, approvato in assemblea.',
     'regolamento', 'condomini/' || v_cond || '/regolamento-condominiale.pdf',
     'regolamento-condominiale.pdf', 248000, 'application/pdf', v_admin),
    (v_cond, 'Polizza globale fabbricati 2026', 'Copia della polizza assicurativa in corso.',
     'polizza', 'condomini/' || v_cond || '/polizza-fabbricati-2026.pdf',
     'polizza-fabbricati-2026.pdf', 512000, 'application/pdf', v_admin),
    (v_cond, 'Planimetria piano terra', 'Planimetria delle parti comuni al piano terra.',
     'planimetria', 'condomini/' || v_cond || '/planimetria-piano-terra.pdf',
     'planimetria-piano-terra.pdf', 1340000, 'application/pdf', v_admin);

  -- ---- SPAZI COMUNI + UNA PRENOTAZIONE -------------------------
  insert into spazi_comuni (condominio_id, nome, descrizione, posti, ora_apertura, ora_chiusura, durata_massima_ore)
    values (v_cond, 'Sala riunioni', 'Sala al piano terra, capienza 20 persone.', 1, '08:00', '22:00', 4)
    returning id into sp1;
  insert into spazi_comuni (condominio_id, nome, descrizione, posti, ora_apertura, ora_chiusura, durata_massima_ore)
    values (v_cond, 'Posti auto ospiti', 'Due stalli nel cortile riservati agli ospiti.', 2, '00:00', '23:59', 24)
    returning id into sp2;

  insert into prenotazioni_spazi (spazio_id, unita_id, utente_id, inizio, fine, note, stato)
    values (sp1, u2, v_admin, '2026-09-14 15:00:00+02', '2026-09-14 18:00:00+02',
            'Riunione informale tra i condòmini di scala A.', 'confermata');

  -- ---- PREFERENZE NOTIFICHE (esempio) --------------------------
  insert into preferenze_notifiche (utente_id, tipo_evento, email_attiva) values
    (v_admin, 'sollecito_pagamento', true),
    (v_admin, 'nuovo_documento', false)
  on conflict (utente_id, tipo_evento) do nothing;

  raise notice 'Dati demo creati. Condominio % intestato a %',
    v_cond, (select email from utenti where id = v_admin);
end $$;

-- ============================================================
-- A CHI È INTESTATO? Se le pagine del condominio demo rispondono
-- "404 pagina non trovata", quasi sempre è intestato a un account
-- diverso da quello con cui hai fatto login. Per vederlo:
--
-- select c.nome, u.email as intestato_a
-- from condomini c left join utenti u on u.id = c.amministratore_id;
--
-- Per riassegnarlo all'account giusto (metti la TUA email di login):
--
-- update condomini
-- set amministratore_id = (select id from utenti where email = 'tua@email.it')
-- where nome like 'Condominio Demo%';
--
-- ------------------------------------------------------------
-- Per cancellare tutti i dati demo e ripartire da zero, togli il
-- commento dalla riga qui sotto ed eseguila (il ON DELETE CASCADE
-- porta via unità, spese, quote, assemblea, segnalazioni, ecc.):
--
-- delete from condomini where nome = 'Condominio Demo — Via Verdi 10';
-- ============================================================
