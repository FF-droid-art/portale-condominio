/**
 * "Adesso" secondo l'orologio del condominio.
 *
 * Il portale gestisce condomìni italiani e ragiona per orologio da parete: una
 * scadenza è "oggi" e una prenotazione è "dalle 18 alle 20" per chi sta
 * nell'edificio, non per il fuso in cui gira il processo. Su Vercel il server
 * lavora in UTC, quindi affidarsi a `new Date().getHours()` sposterebbe di
 * un'ora o due tutto ciò che riguarda date e fasce orarie — e a cavallo della
 * mezzanotte cambierebbe addirittura il giorno.
 *
 * Queste due funzioni sono l'unico punto in cui il portale decide che giorno e
 * che ora sono. Non usano librerie: `Intl.DateTimeFormat` con un fuso esplicito
 * fa parte della piattaforma e conosce già l'ora legale.
 */

export const FUSO_CONDOMINIO = "Europe/Rome";

// "en-CA" produce date già in forma aaaa-mm-gg, quindi non serve rimontare i
// pezzi a mano; "en-GB" con hourCycle h23 dà l'ora in forma hh:mm senza AM/PM.
const formattoreData = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_CONDOMINIO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const formattoreOra = new Intl.DateTimeFormat("en-GB", {
  timeZone: FUSO_CONDOMINIO,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Data odierna nel fuso del condominio, come "aaaa-mm-gg". */
export function oggiLocale(istante: Date = new Date()): string {
  return formattoreData.format(istante);
}

/** Ora corrente nel fuso del condominio, come "hh:mm". */
export function oraLocale(istante: Date = new Date()): string {
  return formattoreOra.format(istante);
}

/** Istante corrente come "aaaa-mm-ggThh:mm", confrontabile con le fasce salvate. */
export function adessoLocale(istante: Date = new Date()): string {
  return `${oggiLocale(istante)}T${oraLocale(istante)}`;
}
