// Traduce la "qualifica / titolo" grezza del file (es. "Proprietario",
// "Ex proprietario", "Proprietario, Conduttore, Assegnatario") nei valori
// che il database accetta per unita_proprietari.tipo_soggetto, più un flag
// "attivo" per distinguere i legami correnti da quelli storici ("ex ...").

export type TipoSoggetto =
  | "proprietario"
  | "nudo_proprietario"
  | "usufruttuario"
  | "conduttore"
  | "comodatario"
  | "assegnatario";

// Coppie [frammento da cercare, tipo]. "nudo proprieta" va prima di
// "propriet" per non essere scavalcato.
const RUOLI: [string, TipoSoggetto][] = [
  ["nudo proprieta", "nudo_proprietario"],
  ["usufrutt", "usufruttuario"],
  ["conduttore", "conduttore"],
  ["comodatar", "comodatario"],
  ["assegnatar", "assegnatario"],
  ["propriet", "proprietario"],
];

export function normalizzaQualifica(raw: string | null): {
  tipoSoggetto: TipoSoggetto;
  attivo: boolean;
} {
  const s = (raw ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

  // "ex ..." → legame storico, non più attivo (ma lo conserviamo).
  const attivo = !/^ex\b/.test(s);

  // Per i ruoli combinati ("Proprietario, Conduttore, ...") si prende quello
  // che compare per primo nel testo: è il ruolo principale del soggetto.
  let scelto: TipoSoggetto = "proprietario";
  let minIdx = Infinity;
  for (const [frammento, tipo] of RUOLI) {
    const i = s.indexOf(frammento);
    if (i >= 0 && i < minIdx) {
      minIdx = i;
      scelto = tipo;
    }
  }

  return { tipoSoggetto: scelto, attivo };
}
