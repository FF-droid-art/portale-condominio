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

### Limite emerso implementando la funzione (2026-09-09)

L'abbinamento è **uno a uno**: un movimento bancario salda una e una sola
ripartizione, di importo identico al centesimo. Restano quindi da
sistemare a mano due casi che nella pratica capitano spesso:

- il **versamento cumulativo**, con cui un condomino salda in un colpo
  due o tre rate arretrate (l'importo non corrisponde a nessuna singola
  quota, quindi nessuna proposta scatta);
- il **pagamento parziale o in acconto**, che oggi non ha modo di essere
  registrato: una quota è pagata o non lo è, non esiste un residuo.

Il secondo è il più serio, e non è un limite del CSV: è il modello dati
delle `ripartizioni`, che non prevede pagamenti parziali. Sistemarlo
significherebbe introdurre una tabella di incassi collegati alla quota
(molti a uno) e ricalcolare lo stato del pagamento dalla somma degli
incassi — un cambiamento che tocca stato patrimoniale, solleciti,
rendiconto e pagamento online, quindi da pianificare a parte. L'open
banking non lo risolverebbe: cambierebbe solo da dove arrivano i
movimenti.

## Altri spunti emersi ma non ancora pianificati

- **App mobile nativa o PWA con notifiche push** — oggi il portale è solo
  web responsive.
- **Assemblee interamente virtuali con voto legalmente vincolante** —
  in Germania/Austria è legge dal 2024 (riforma WEG, soglia 3/4 dei voti
  per abilitarle); da noi il link videoconferenza è solo di cortesia, il
  voto formale resta legato alla presenza/delega. Possibile evoluzione
  del punto #9 (quorum live).
- ~~**Collegamento anagrafica → account utente al momento della
  registrazione**~~ — **fatto** con i codici di invito per unità: ogni
  unità ha un codice generato dal database (trigger `trg_unita_crea_invito`
  su `inviti_unita`), l'amministratore lo distribuisce dal foglio stampabile
  `/admin/condomini/[id]/inviti` (anche come QR verso
  `/registrazione?codice=...`) e chi lo inserisce in fase di registrazione
  viene collegato al proprio `unita_proprietari` dal trigger
  `handle_new_user`. Se l'anagrafica di quella persona esiste già su
  quell'unità con la stessa email, l'account viene agganciato a quella
  invece di creare un secondo legame.

  Quello che resta aperto di questo tema: se più comproprietari della stessa
  unità si registrano separatamente con lo stesso codice, ciascuno riceve la
  `quota_possesso` di default (100) e la somma va corretta a mano dalla
  scheda dell'unità — non è automatizzabile senza sapere in anticipo quante
  persone si registreranno.
