/**
 * Rendiconto annuale del condominio.
 *
 * DUE PIANI, TENUTI SEPARATI APPOSTA. Il rendiconto condominiale (art. 1130-bis
 * c.c.) mette insieme due cose che rispondono a domande diverse, e confonderle
 * è il modo più rapido per far tornare i conti sbagliati:
 *
 *  - la CASSA dell'anno: quanto è uscito (spese datate nell'anno) e quanto è
 *    entrato (quote effettivamente versate nell'anno, indipendentemente da
 *    quale anno riguardassero). La differenza è il saldo del periodo.
 *  - la COMPETENZA per unità: quanto è stato addebitato a ciascuna unità per
 *    l'anno, quanto di quello ha versato e quanto resta scoperto. Un versamento
 *    fatto quest'anno su una rata dell'anno scorso entra nella cassa di
 *    quest'anno ma nella competenza di quello scorso.
 *
 * L'anno di competenza di una quota è quello della sua scadenza; se manca, si
 * usa la data della spesa — la stessa regola dello stato patrimoniale, così le
 * due stampe non possono raccontare storie diverse sulla stessa unità.
 *
 * Il documento è una fotografia dei dati registrati nel portale, non il
 * rendiconto approvato dall'assemblea: manca il registro di contabilità, la
 * nota sintetica e lo stato patrimoniale del condominio, che l'amministratore
 * redige a parte.
 */

import { formatDataOra, formatValuta } from "@/lib/format";
import {
  segmentoNomeFile,
  type Blocco,
  type DatiAmministratore,
  type DatiCondominio,
  type Documento,
} from "./modello";

export type UscitaRendiconto = {
  dataSpesa: string;
  categoria: string;
  descrizione: string;
  importo: number;
};

export type QuotaRendiconto = {
  /** Identificativo dell'unità: è la chiave con cui si raggruppa. */
  unita: string;
  /** Anno di competenza della quota: scadenza se c'è, altrimenti data spesa. */
  dataCompetenza: string;
  importo: number;
  statoPagamento: string;
  dataPagamento: string | null;
};

export type VoceCategoria = { categoria: string; totale: number; numero: number };

export type SituazioneUnita = {
  identificativo: string;
  dovuto: number;
  versato: number;
  residuo: number;
};

export type RiepilogoRendiconto = {
  anno: number;
  /** Uscite dell'anno raggruppate per categoria, dalla più pesante. */
  uscitePerCategoria: VoceCategoria[];
  totaleUscite: number;
  /** Quote incassate nell'anno, qualunque sia l'anno di competenza. */
  totaleEntrate: number;
  saldo: number;
  /** Competenza dell'anno, unità per unità, in ordine alfabetico. */
  unita: SituazioneUnita[];
  totaleDovuto: number;
  totaleVersato: number;
  totaleResiduo: number;
};

function annoDi(data: string | null): number | null {
  if (!data) return null;
  const anno = Number(data.slice(0, 4));
  return Number.isInteger(anno) && anno > 1900 ? anno : null;
}

export function riepilogaRendiconto(input: {
  anno: number;
  uscite: UscitaRendiconto[];
  quote: QuotaRendiconto[];
}): RiepilogoRendiconto {
  const { anno } = input;

  const perCategoria = new Map<string, VoceCategoria>();
  let totaleUscite = 0;
  for (const uscita of input.uscite) {
    if (annoDi(uscita.dataSpesa) !== anno) continue;
    const categoria = uscita.categoria?.trim() || "Senza categoria";
    const voce = perCategoria.get(categoria) ?? { categoria, totale: 0, numero: 0 };
    voce.totale += uscita.importo;
    voce.numero += 1;
    perCategoria.set(categoria, voce);
    totaleUscite += uscita.importo;
  }

  const uscitePerCategoria = [...perCategoria.values()].sort(
    (a, b) => b.totale - a.totale || a.categoria.localeCompare(b.categoria, "it")
  );

  let totaleEntrate = 0;
  const perUnita = new Map<string, SituazioneUnita>();

  for (const quota of input.quote) {
    const pagata = quota.statoPagamento === "pagato";

    // Cassa: conta l'anno in cui il denaro è arrivato.
    if (pagata && annoDi(quota.dataPagamento) === anno) totaleEntrate += quota.importo;

    // Competenza: conta l'anno a cui la quota si riferisce.
    if (annoDi(quota.dataCompetenza) !== anno) continue;

    const identificativo = quota.unita?.trim() || "Unità non indicata";
    const riga =
      perUnita.get(identificativo) ?? { identificativo, dovuto: 0, versato: 0, residuo: 0 };
    riga.dovuto += quota.importo;
    if (pagata) riga.versato += quota.importo;
    perUnita.set(identificativo, riga);
  }

  const unita = [...perUnita.values()]
    .map((u) => ({ ...u, residuo: u.dovuto - u.versato }))
    .sort((a, b) => a.identificativo.localeCompare(b.identificativo, "it", { numeric: true }));

  const totaleDovuto = unita.reduce((s, u) => s + u.dovuto, 0);
  const totaleVersato = unita.reduce((s, u) => s + u.versato, 0);

  return {
    anno,
    uscitePerCategoria,
    totaleUscite,
    totaleEntrate,
    saldo: totaleEntrate - totaleUscite,
    unita,
    totaleDovuto,
    totaleVersato,
    totaleResiduo: totaleDovuto - totaleVersato,
  };
}

export type DatiRendiconto = {
  condominio: DatiCondominio;
  anno: number;
  uscite: UscitaRendiconto[];
  quote: QuotaRendiconto[];
  amministratore: DatiAmministratore;
  generatoIl: string;
};

export function costruisciRendiconto(dati: DatiRendiconto): Documento {
  const { condominio, anno, amministratore } = dati;
  const riepilogo = riepilogaRendiconto({ anno, uscite: dati.uscite, quote: dati.quote });

  const blocchi: Blocco[] = [
    { tipo: "sottotitolo", testo: `Condominio ${condominio.nome}` },
    { tipo: "paragrafo", testo: condominio.indirizzo },
  ];

  if (condominio.codiceFiscale) {
    blocchi.push({ tipo: "paragrafo", testo: `Codice fiscale ${condominio.codiceFiscale}` });
  }

  blocchi.push(
    { tipo: "spazio" },
    { tipo: "titolo", testo: `Rendiconto ${anno}` },
    { tipo: "spazio" },
    {
      tipo: "paragrafo",
      testo:
        `Riepilogo della gestione dal 1° gennaio al 31 dicembre ${anno}, ricavato dalle spese ` +
        "e dalle ripartizioni registrate nel portale.",
    },
    { tipo: "spazio" },
    { tipo: "sottotitolo", testo: "Movimenti di cassa del periodo" },
    { tipo: "campo", etichetta: "Totale uscite", valore: formatValuta(riepilogo.totaleUscite) },
    {
      tipo: "campo",
      etichetta: "Totale entrate (quote versate nell'anno)",
      valore: formatValuta(riepilogo.totaleEntrate),
    },
    {
      tipo: "campo",
      etichetta: "Saldo del periodo",
      valore: formatValuta(riepilogo.saldo),
    },
    {
      tipo: "paragrafo",
      testo:
        "Le entrate contano i versamenti ricevuti nell'anno, anche quando riguardano quote di " +
        "anni precedenti: è la cassa, non la competenza.",
    },
    { tipo: "spazio" },
    { tipo: "sottotitolo", testo: "Uscite per categoria" }
  );

  if (riepilogo.uscitePerCategoria.length) {
    blocchi.push({
      tipo: "elenco",
      voci: riepilogo.uscitePerCategoria.map(
        (v) =>
          `${v.categoria} — ${formatValuta(v.totale)} (${v.numero} ${
            v.numero === 1 ? "spesa" : "spese"
          })`
      ),
    });
  } else {
    blocchi.push({ tipo: "paragrafo", testo: `Nessuna spesa registrata nel ${anno}.` });
  }

  blocchi.push(
    { tipo: "spazio" },
    { tipo: "sottotitolo", testo: `Situazione delle unità — competenza ${anno}` }
  );

  if (riepilogo.unita.length) {
    blocchi.push(
      {
        tipo: "elenco",
        voci: riepilogo.unita.map(
          (u) =>
            `${u.identificativo} — dovuto ${formatValuta(u.dovuto)} — versato ${formatValuta(
              u.versato
            )} — residuo ${formatValuta(u.residuo)}`
        ),
      },
      { tipo: "spazio" },
      { tipo: "campo", etichetta: "Totale dovuto", valore: formatValuta(riepilogo.totaleDovuto) },
      { tipo: "campo", etichetta: "Totale versato", valore: formatValuta(riepilogo.totaleVersato) },
      {
        tipo: "campo",
        etichetta: "Totale ancora da incassare",
        valore: formatValuta(riepilogo.totaleResiduo),
      }
    );
  } else {
    blocchi.push({
      tipo: "paragrafo",
      testo: `Nessuna quota di competenza ${anno} risulta ripartita tra le unità.`,
    });
  }

  blocchi.push(
    ...(amministratore
      ? ([
          { tipo: "spazio" },
          {
            tipo: "paragrafo",
            testo: `L'amministratore\n${amministratore.nome} ${amministratore.cognome}`,
          },
        ] as Blocco[])
      : []),
    { tipo: "spazio" },
    {
      tipo: "nota",
      testo:
        `Prospetto generato automaticamente dal portale il ${formatDataOra(dati.generatoIl)}. ` +
        "Riporta i movimenti registrati e non sostituisce il rendiconto condominiale da " +
        "sottoporre all'assemblea (art. 1130-bis c.c.), che comprende anche il registro di " +
        "contabilità, la nota sintetica esplicativa e lo stato patrimoniale del condominio.",
    }
  );

  return {
    titolo: `Rendiconto ${anno} — ${condominio.nome}`,
    nomeFile: `rendiconto-${anno}-${segmentoNomeFile(condominio.nome)}`,
    blocchi,
  };
}
