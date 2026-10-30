import "server-only";

import QRCode from "qrcode";

import { urlRegistrazioneConCodice } from "@/lib/inviti";
import { urlCanonicoSito } from "@/lib/sito";

/**
 * QR code dei codici di invito, generati **lato server**.
 *
 * `qrcode` è un pacchetto JavaScript puro, senza dipendenze native: gira
 * dentro un Server Component e restituisce un PNG come data URI, che la
 * pagina mette in un `<img>`. Nessun JavaScript in più nel bundle del
 * browser (il modulo è marcato `server-only`), nessuna richiesta a un
 * servizio esterno di generazione QR — che vorrebbe dire mandare i codici
 * di invito di un condominio a una terza parte.
 *
 * Il risultato è un'immagine e non un `<svg>`: nella pagina di riepilogo ce
 * ne sono decine su un foglio da stampare, e un data URI PNG si stampa
 * uguale su qualunque browser senza dipendere da come ciascuno rende gli
 * SVG in stampa.
 *
 * Correzione d'errore a livello M (circa il 15% di ridondanza): il QR
 * finisce su carta, in bacheca, dove una piega o un'impronta sono la
 * norma. Il livello L (default) basterebbe su uno schermo; M costa qualche
 * modulo in più e si legge anche sporco.
 */
async function qrDaUrl(url: string, dimensione: number): Promise<string> {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: dimensione,
    // Nero su bianco espliciti: il QR deve restare leggibile anche se il
    // resto della pagina è in tema scuro, e in stampa il bianco è carta.
    color: { dark: "#000000ff", light: "#ffffffff" },
  });
}

/**
 * QR del codice di invito di un'unità: inquadrandolo si arriva su
 * `/registrazione?codice=XXXX-XXXX`, con il campo già compilato.
 *
 * L'origine è quella canonica di produzione (`urlCanonicoSito`) e non
 * quella della richiesta: questi QR vengono stampati e affissi, quindi
 * devono restare validi anche quando il deploy di anteprima da cui
 * l'amministratore ha stampato il foglio non esiste più.
 */
export async function qrCodiceInvito(codice: string, dimensione = 160): Promise<string> {
  return qrDaUrl(urlRegistrazioneConCodice(urlCanonicoSito(), codice), dimensione);
}
