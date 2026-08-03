import type { CampoImport } from "./tipi";

export const CAMPI_UNITA: CampoImport[] = [
  {
    chiave: "identificativo",
    etichetta: "Identificativo",
    obbligatorio: true,
    tipo: "testo",
    sinonimi: ["identificativo", "unita", "unità", "interno", "scala"],
  },
  {
    chiave: "piano",
    etichetta: "Piano",
    obbligatorio: false,
    tipo: "testo",
    sinonimi: ["piano"],
  },
  {
    chiave: "millesimi_proprieta",
    etichetta: "Millesimi di proprietà",
    obbligatorio: true,
    tipo: "numero",
    sinonimi: ["millesimi", "mill", "quota"],
  },
];

export const CAMPI_CONDOMINI_UNITA: CampoImport[] = [
  // Nota: l'indirizzo è elencato prima del nome di proposito. La mappatura
  // automatica è greedy in ordine di campo; così la colonna "Indirizzo
  // condominio" viene assegnata all'indirizzo e non catturata dal sinonimo
  // "condominio" del nome.
  {
    chiave: "indirizzoCondominio",
    etichetta: "Indirizzo condominio",
    obbligatorio: true,
    tipo: "testo",
    sinonimi: ["indirizzo", "via"],
  },
  {
    chiave: "nomeCondominio",
    etichetta: "Nome condominio",
    // Opzionale: molti export hanno solo l'indirizzo. Se non mappato, il
    // nome del condominio viene derivato dall'indirizzo (vedi preparaRighe).
    obbligatorio: false,
    tipo: "testo",
    sinonimi: ["nome condominio", "condominio", "stabile", "edificio"],
  },
  {
    chiave: "codiceFiscaleCondominio",
    etichetta: "Codice fiscale condominio",
    obbligatorio: false,
    tipo: "testo",
    sinonimi: ["codice fiscale", "c f", "cf"],
  },
  {
    chiave: "identificativo",
    etichetta: "Identificativo unità",
    obbligatorio: true,
    tipo: "testo",
    sinonimi: ["identificativo", "unita", "unità", "interno", "scala"],
  },
  {
    chiave: "piano",
    etichetta: "Piano",
    obbligatorio: false,
    tipo: "testo",
    sinonimi: ["piano"],
  },
  {
    chiave: "millesimiProprieta",
    etichetta: "Millesimi di proprietà",
    obbligatorio: true,
    tipo: "numero",
    sinonimi: ["millesimi", "mill", "quota"],
  },
];

export const CAMPI_SPESE: CampoImport[] = [
  {
    chiave: "identificativoUnita",
    etichetta: "Identificativo unità",
    obbligatorio: true,
    tipo: "testo",
    sinonimi: ["identificativo", "unita", "unità", "interno", "scala"],
  },
  {
    chiave: "descrizione",
    etichetta: "Descrizione",
    obbligatorio: true,
    tipo: "testo",
    sinonimi: ["descrizione", "causale", "voce"],
  },
  {
    chiave: "categoria",
    etichetta: "Categoria",
    obbligatorio: true,
    tipo: "testo",
    sinonimi: ["categoria", "tipo spesa", "capitolo"],
  },
  {
    chiave: "dataSpesa",
    etichetta: "Data spesa",
    obbligatorio: true,
    tipo: "data",
    sinonimi: ["data spesa", "data fattura", "data"],
  },
  {
    chiave: "importoDovuto",
    etichetta: "Importo dovuto (per unità)",
    obbligatorio: true,
    tipo: "numero",
    sinonimi: ["importo dovuto", "quota dovuta", "importo", "totale"],
  },
  {
    chiave: "fornitore",
    etichetta: "Fornitore",
    obbligatorio: false,
    tipo: "testo",
    sinonimi: ["fornitore", "ditta"],
  },
  {
    chiave: "statoPagamento",
    etichetta: "Stato pagamento",
    obbligatorio: false,
    tipo: "testo",
    sinonimi: ["stato pagamento", "stato", "pagato"],
  },
  {
    chiave: "dataScadenza",
    etichetta: "Data scadenza",
    obbligatorio: false,
    tipo: "data",
    sinonimi: ["scadenza", "data scadenza"],
  },
  {
    chiave: "dataPagamento",
    etichetta: "Data pagamento",
    obbligatorio: false,
    tipo: "data",
    sinonimi: ["data pagamento", "pagato il"],
  },
];
