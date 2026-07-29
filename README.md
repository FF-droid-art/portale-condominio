Portale di gestione condominiale, con Next.js (App Router) e Supabase (Postgres + Auth + RLS).

## Stack

- Next.js 16 (nota: `middleware.ts` è stato rinominato `proxy.ts` in questa versione — vedi `src/proxy.ts`)
- Supabase (`@supabase/ssr`, `@supabase/supabase-js`)
- Tailwind CSS

## 1. Crea il progetto Supabase

1. Vai su [supabase.com](https://supabase.com) e crea un nuovo progetto (hai già l'account via GitHub).
2. Attendi che il database sia pronto (1-2 minuti).
3. Apri **SQL Editor** nella dashboard, incolla il contenuto di `supabase/schema.sql` ed eseguilo. Questo crea tutte le tabelle, gli indici, il trigger che genera automaticamente la riga in `utenti` alla registrazione, e le policy RLS che separano i permessi tra `amministratore` e `condomino`.
4. Vai in **Project Settings > API** e copia:
   - `Project URL`
   - la chiave `anon` `public`

## 2. Configura le variabili d'ambiente

Copia `.env.local.example` in `.env.local` e incolla i due valori del punto precedente:

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## 3. Avvia il progetto

```bash
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000).

## 4. Crea il primo amministratore

Il form di registrazione pubblico (`/registrazione`) crea sempre utenti con ruolo `condomino` — è una scelta di sicurezza intenzionale, per evitare che chiunque possa auto-promuoversi ad amministratore. Per creare il primissimo amministratore:

1. Registrati normalmente da `/registrazione` e conferma l'email.
2. Nella dashboard Supabase, apri **Table Editor > utenti**, trova la tua riga e imposta `ruolo` su `amministratore` (oppure lancia da SQL Editor: `update utenti set ruolo = 'amministratore' where email = 'tua-email@esempio.it';`).
3. Da quel momento potrai promuovere altri utenti direttamente dal pannello `/admin/utenti` dell'app, senza toccare più SQL.

## Come sono divisi i permessi

- **Autenticazione**: gestita da Supabase Auth (email + password). Alla registrazione un trigger Postgres (`handle_new_user`) crea automaticamente la riga corrispondente in `public.utenti`.
- **Ruoli**: colonna `ruolo` su `utenti`, con valori `amministratore` / `condomino`. Un trigger (`blocca_cambio_ruolo_non_autorizzato`) impedisce che un condomino modifichi il proprio ruolo.
- **Autorizzazione**:
  - `src/proxy.ts` (l'equivalente di `middleware.ts`) rinfresca la sessione ad ogni richiesta e reindirizza gli utenti non autenticati verso `/login`.
  - Le route `/admin/*` sono ulteriormente protette lato server da `richiedeAmministratore()` (`src/lib/supabase/dal.ts`), le route `/area-riservata/*` da `richiedeUtente()`.
  - **Row Level Security** su Postgres è la barriera "vera": anche bypassando l'interfaccia, le query REST/PostgREST di un condomino sono limitate ai dati del proprio condominio dalle policy definite in `supabase/schema.sql`.

## Cosa manca (fuori dallo scope iniziale)

Lo schema copre anche assemblee, punti all'ordine del giorno, voti, presenze e deleghe (con relative policy RLS), ma le pagine UI per queste sezioni non sono ancora state costruite — solo condomini, unità, spese e gestione utenti/ruoli.
