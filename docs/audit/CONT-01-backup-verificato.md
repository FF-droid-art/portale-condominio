# CONT-01 — Backup e disaster recovery: verifica effettuata

Rilievo originale: `docs/audit/05-dipendenze-continuita-mercato.md`, CONT-01
("nessuna configurazione verificabile nel codice — va controllato nei
pannelli Supabase/Vercel"). Questo file registra l'esito della verifica,
fatta il 2026-10-29 insieme all'utente sul pannello reale del progetto.

## Supabase (database + storage documenti)

Verificato su: Project Settings → Database → Backups
(`https://supabase.com/dashboard/project/oidvnxcyxytxnbsrgcgh/settings/database`)

Testo esatto mostrato dal pannello:

> **Scheduled backups** — Projects are backed up daily around midnight of
> your project's region and can be restored at any time. **Free Plan does
> not include project backups.**
>
> **Point in Time Recovery** (Beta) — Roll back your database to a
> specific second. Point in Time Recovery is a Pro Plan add-on. Starts
> at $100/month. Pro Plan already includes daily backups at no extra cost.

**In chiaro**: il progetto è oggi su piano **Free**. Non esiste **nessun
backup automatico** del database, né giornaliero né di qualsiasi altra
cadenza. Un `DROP TABLE`, una `DELETE` senza `WHERE`, o la cancellazione
di un condominio tramite `elimina-condominio-button.tsx` (FEAT-11 /
l'`on delete cascade` diffuso già segnalato in Fase 3) sono **irreversibili
al 100%**: non c'è un pannello "ripristina a ieri" da nessuna parte.

Per avere almeno i backup giornalieri bisogna passare al **piano Pro**
(il PITR a secondo è un add-on ulteriore sopra il Pro, $100/mese, non
necessario per una prima rete di sicurezza — i backup giornalieri lo sono
già di default sul Pro).

**Storage documenti** (bucket `documenti-condominio`): segue la stessa
politica di backup del database del progetto — su piano Free, quindi,
nessuna copia di sicurezza nemmeno per fatture/verbali caricati.

## Vercel (hosting applicativo)

L'applicazione stessa non ha stato persistente lato Vercel (nessun
database lì): non c'è nulla da "perdere" lato hosting oltre al codice,
che vive comunque su GitHub con la sua history. Non rilevante per il
disaster recovery dei dati.

## Conseguenza pratica, aggiornata rispetto al rilievo originale

Il rilievo CONT-01 **non è più "da verificare"**: è confermato, ed è più
grave di quanto l'assenza di verifica suggerisse. Finché il progetto
resta su piano Free:

- **Non esiste alcuna rete di sicurezza** contro un errore umano
  (cancellazione sbagliata, migration SQL difettosa eseguita a mano nel
  SQL Editor — il modus operandi descritto in CLAUDE.md stesso) o un bug
  che corrompe dati.
- Dato che l'amministratore di condominio ha un **obbligo legale di
  conservazione decennale** della documentazione contabile
  (art. 1130-bis c.c., già approfondito in Fase 3 — FEAT-01/FEAT-03),
  l'assenza di backup non è solo un rischio tecnico ma rende il gestore
  del servizio esposto se quell'obbligo non può essere rispettato per
  colpa di una perdita dati evitabile.

## Raccomandazione (decisione dell'utente, non presa qui)

Due soglie diverse da considerare separatamente:
1. **Passare al piano Pro di Supabase** (backup giornalieri inclusi) prima
   di avere il primo condominio/cliente reale con dati che contano
   davvero — è la soglia minima ragionevole, non il PITR a pagamento
   extra.
2. Nel frattempo, e comunque anche dopo, **un export manuale periodico**
   (`pg_dump` schedulato a mano, o uno script che scarica le tabelle
   principali in CSV/JSON) costa zero e riduce il rischio nell'attesa.

Nessuna azione automatica presa su questo punto: è un costo ricorrente,
coerente con la scelta "niente budget per ora" già espressa — ma va
tenuto come primo upgrade a pagamento da fare quando il budget lo
permetterà, prima di qualunque altra spesa del piano.
