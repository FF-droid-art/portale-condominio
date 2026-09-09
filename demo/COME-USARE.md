# Dati di prova per il portale

Tre passaggi, in quest'ordine.

## 1. Aggiorna il database (risolve gli errori attuali)

Gli errori che vedi ora —

- `Could not find the table 'public.segnalazioni' in the schema cache`
- «pagina non trovata» quando apri un'assemblea

— hanno **la stessa causa**: il database su Supabase è indietro rispetto
al codice. Mancano le tabelle e le colonne aggiunte dalle ultime
funzionalità (segnalazioni, spazi, documenti, notifiche, e — per le
assemblee — la colonna `convocazione`, la tabella `firme_verbale` e la
funzione del quorum). La pagina dell'assemblea prova a leggerle, non le
trova e finisce sul «non trovata».

**Come si aggiorna:** apri Supabase → **SQL Editor** → **New query** →
incolla tutto il contenuto di **`supabase/migrazioni-restyling.sql`** →
**Run**. Si può rieseguire senza rischi.

Dopo questo, le assemblee si aprono e la sezione Segnalazioni funziona.

## 2. Popola con dati finti (facoltativo ma consigliato)

Sempre nel **SQL Editor**, incolla ed esegui **`supabase/seed-demo.sql`**.

Crea un condominio **«Condominio Demo — Via Verdi 10»** con:

- 6 unità e 6 nominativi in anagrafica;
- 3 spese con le relative quote — una già pagata, due **in ritardo**
  (così la sezione **Morosità** ha qualcosa da mostrare), una con
  scadenza futura (per il **Calendario**);
- un'assemblea con 3 punti all'ordine del giorno;
- 2 fornitori e 3 manutenzioni programmate (una già scaduta);
- 3 segnalazioni (aperta / in corso / chiusa) con una nota;
- 3 documenti in archivio *(solo la riga: il file vero non c'è, quindi
  l'elenco si vede ma il download dà errore — carica un PDF vero
  dall'interfaccia per provarlo)*;
- 2 spazi comuni prenotabili con una prenotazione.

Va eseguito **una volta sola**: se il condominio demo esiste già non fa
nulla. Per rifarlo da capo, in fondo al file c'è la riga di `delete`
pronta (commentata).

> I nominativi del demo sono in **anagrafica**, senza account di login:
> nell'area amministratore vedi tutto, l'area riservata del condòmino
> resta vuota finché non colleghi un utente vero.

## 3. Prova la riconciliazione bancaria

Nella sezione **Riconciliazione** scegli il Condominio Demo e carica uno
dei due CSV in questa cartella (sono due tracciati di home banking
diversi: uno con colonna «Importo» all'italiana e `;`, l'altro con
colonne «Dare/Avere» all'inglese e `,`):

| File | Cosa contiene | Cosa aspettarsi dopo il caricamento |
|---|---|---|
| **`estratto-conto-1-semestre.csv`** | pagamenti delle quote della 1ª spesa + due addebiti (utenze, spese conto) | **5 abbinamenti proposti** (2 ad alta affidabilità perché la causale cita il codice avviso, 3 media perché cita solo il nominativo), 2 addebiti ignorati |
| **`estratto-conto-2-facciata.csv`** | pagamenti della spesa straordinaria facciata + un pagamento a fornitore + un **versamento cumulativo** | **4 abbinamenti proposti**, 2 addebiti, **1 accredito senza riscontro**: è il bonifico unico da 3.360 € con cui «Gallo» salda più rate insieme — l'abbinamento è uno-a-uno e questo caso va sistemato a mano (vedi `IDEE-FUTURE.md`) |

Gli abbinamenti proposti **non toccano nulla** finché non li confermi tu.
Dopo la conferma, le quote passano a «pagato» e spariscono da Morosità e
Calendario.
