import type { RigaImportCondominioUnita } from "./tipi";

/**
 * Prepara le righe "condomini + unità" prima di validazione e import.
 * Due passaggi, entrambi pensati per gli export gestionali reali:
 *
 *  1. Nome condominio opzionale: se assente si usa l'indirizzo come nome
 *     (molti export non hanno una colonna "Nome condominio" separata).
 *  2. Collasso delle unità ripetute: nei file reali la stessa unità compare
 *     su più righe, una per occupante (proprietario, inquilino, ecc.). Qui
 *     interessano solo condomìni e unità, quindi quelle righe vanno fuse in
 *     un'unica unità. L'anagrafica delle persone è gestita a parte.
 *
 * Funzione pura, usata sia lato client (anteprima) sia lato server
 * (rivalidazione): non ci si fida mai del solo controllo client.
 */
export function preparaRigheCondominioUnita(
  righe: RigaImportCondominioUnita[]
): RigaImportCondominioUnita[] {
  const conNome = righe
    .map((r) => ({
      ...r,
      nomeCondominio: r.nomeCondominio.trim() || r.indirizzoCondominio.trim(),
    }))
    // Scarta le righe che non identificano un'unità (né identificativo né
    // indirizzo): sono le righe di totale o le righe vuote di coda che molti
    // export lasciano in fondo al foglio, non vere unità da importare.
    .filter(
      (r) => r.identificativo.trim() !== "" || r.indirizzoCondominio.trim() !== ""
    );

  const perUnita = new Map<string, RigaImportCondominioUnita>();
  for (const riga of conNome) {
    const chiave = `${riga.nomeCondominio}||${riga.indirizzoCondominio}||${riga.identificativo}`;
    const esistente = perUnita.get(chiave);
    if (!esistente) {
      perUnita.set(chiave, { ...riga });
      continue;
    }
    // Stessa unità su un'altra riga: teniamo i dati più completi. I millesimi
    // appartengono all'unità (le righe inquilino li hanno vuoti → NaN),
    // quindi si conserva il valore valido più alto tra le righe.
    esistente.piano = esistente.piano ?? riga.piano;
    esistente.codiceFiscaleCondominio =
      esistente.codiceFiscaleCondominio ?? riga.codiceFiscaleCondominio;
    esistente.millesimiProprieta = millesimoPreferito(
      esistente.millesimiProprieta,
      riga.millesimiProprieta
    );
  }

  return [...perUnita.values()];
}

// Sceglie il millesimo "migliore" tra due righe della stessa unità:
// ignora i NaN (celle vuote) e tiene il valore più alto. Se entrambi sono
// NaN, resta NaN così la validazione segnala l'unità senza millesimi.
function millesimoPreferito(a: number, b: number): number {
  if (Number.isNaN(a)) return b;
  if (Number.isNaN(b)) return a;
  return Math.max(a, b);
}
