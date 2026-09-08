# Idee future (non ancora implementate)

Promemoria di funzionalità volutamente rimandate, per non perderle di vista.
Aggiornato: 2026-09-08.

## Firma digitale del verbale — versione legale vera

Nel giro di implementazione delle feature #1-14 (vedi conversazione del
2026-09-08) abbiamo scelto per il verbale d'assemblea una **conferma
leggera via OTP interno**, esplicitamente NON equivalente a una firma
elettronica con valore legale — solo tracciamento di approvazione.

La versione "vera" richiederebbe una firma **FEA/eIDAS** tramite un
provider certificato esterno (es. Namirial, InfoCert, Aruba): comporta un
account e probabilmente un costo ricorrente, da valutare passando dal
marketplace prima di scegliere il provider. Da rivalutare se/quando la
validità legale del verbale diventa un requisito reale per gli utenti
(es. contestazioni, uso in giudizio).

## Riconciliazione bancaria — open banking vero

Per la riconciliazione tra il conto corrente del condominio e le
ripartizioni pagate abbiamo scelto l'**import manuale di estratto conto
CSV + abbinamento automatico**, senza servizi esterni.

L'alternativa è un collegamento diretto **open banking (PSD2)** tramite
un aggregatore bancario esterno (a pagamento, da provisionare via
marketplace) — toglierebbe l'upload manuale del CSV. Per il mercato
DACH (Germania/Austria) l'equivalente tecnico di riferimento è **EBICS**,
usato da prodotti come andromeda.ONE/Immoware24, nel caso in futuro
serva un confronto.

## Altri spunti emersi ma non ancora pianificati

- **App mobile nativa o PWA con notifiche push** — oggi il portale è solo
  web responsive.
- **Assemblee interamente virtuali con voto legalmente vincolante** —
  in Germania/Austria è legge dal 2024 (riforma WEG, soglia 3/4 dei voti
  per abilitarle); da noi il link videoconferenza è solo di cortesia, il
  voto formale resta legato alla presenza/delega. Possibile evoluzione
  del punto #9 (quorum live).
- **Collegamento anagrafica → account utente al momento della
  registrazione**: oggi un condomino importato via wizard (riga in
  `anagrafiche`) che si registra su `/registrazione` non viene collegato
  automaticamente al proprio `unita_proprietari` — resta con
  `anagrafiche.utente_id` vuoto e l'area riservata gli appare vuota.
  Il campo esiste già in schema (pensato per un "reclama la tua
  anagrafica" futuro, vedi commento in `supabase/schema.sql` intorno alla
  riga 1575) ma il flusso di collegamento non è mai stato costruito. È
  probabilmente il gap più importante per l'esperienza self-service reale
  dei condomini, indipendente dal restyling e dalle 14 feature in corso.
