import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import {
  LIMITI,
  chiaveTentativo,
  messaggioLimite,
  type AzioneLimitata,
} from "@/lib/limite-tentativi";

/**
 * Scrittura del contatore dei tentativi (COD-05). I numeri e i messaggi
 * stanno in `limite-tentativi.ts`, qui c'è solo l'I/O.
 *
 * ## Perché il client service-role
 *
 * Login, recupero password e pagina di firma del verbale sono per
 * definizione i punti in cui una sessione utente NON esiste ancora: nessun
 * client con RLS attiva potrebbe scrivere il contatore. La tabella
 * `tentativi_autenticazione` ha quindi la RLS attiva e **zero policy** — non
 * è raggiungibile né da `anon` né da `authenticated` — e le due funzioni qui
 * sotto sono eseguibili solo da `service_role`. Questo rispetta il vincolo
 * del progetto sull'uso della service key (contesto senza sessione, e query
 * sempre filtrata da un identificativo non enumerabile: l'impronta SHA-256
 * della coppia email+IP, che il browser non conosce e non può costruire).
 *
 * ## Perché un'unica funzione SQL e non tre query
 *
 * "Conta i tentativi, poi scrivine uno" non è atomico: due richieste
 * simultanee leggerebbero lo stesso contatore e passerebbero entrambe.
 * `registra_tentativo_autenticazione` fa pulizia, conteggio e inserimento
 * dentro una sola transazione, serializzata per chiave da un advisory lock,
 * in un solo giro di rete — vedi la migrazione in `supabase/schema.sql`.
 *
 * ## Se il contatore non funziona, si passa
 *
 * Qualunque errore (migrazione non ancora applicata a mano sul progetto
 * Supabase, variabile d'ambiente mancante, database irraggiungibile) viene
 * loggato e il tentativo viene lasciato passare. È una scelta esplicita:
 * un rate limiter rotto che fa fallire ogni login chiuderebbe fuori dal
 * portale tutti i condòmini di tutti gli stabili per proteggere da un
 * attacco che potrebbe non essere in corso.
 */

export type EsitoLimite = { bloccato: false } | { bloccato: true; messaggio: string };

type RigaRegistrazione = {
  bloccato: boolean;
  tentativi: number;
  riprova_dal: string | null;
};

const PASSA: EsitoLimite = { bloccato: false };

/**
 * Registra un tentativo e dice se va bloccato. Gli `elementi` sono ciò che
 * identifica chi sta tentando (tipicamente email normalizzata e IP): non
 * vengono salvati, ne finisce a database solo l'impronta.
 *
 * Va chiamata PRIMA di verificare le credenziali o di spedire l'email, e
 * conta ogni tentativo — non solo quelli falliti — perché è l'unico modo di
 * limitare allo stesso modo un indirizzo registrato e uno inesistente: se si
 * contassero i soli fallimenti, il comportamento del portale direbbe quali
 * email hanno un account.
 */
export async function registraTentativo(
  azione: AzioneLimitata,
  elementi: (string | null)[]
): Promise<EsitoLimite> {
  const limite = LIMITI[azione];
  const chiave = chiaveTentativo(azione, elementi);

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc("registra_tentativo_autenticazione", {
      p_azione: azione,
      p_chiave: chiave,
      p_finestra_minuti: limite.finestraMinuti,
      p_massimo: limite.massimo,
    });

    if (error) {
      console.error("[limite-tentativi] conteggio non riuscito, tentativo lasciato passare", {
        azione,
        errore: error.message,
      });
      return PASSA;
    }

    const riga = data?.[0] as RigaRegistrazione | undefined;
    if (!riga?.bloccato) return PASSA;

    // COD-09: il blocco è l'evento che si vuole poter vedere nei log.
    // Dell'identificativo si registra solo il prefisso dell'impronta — basta
    // a correlare più blocchi fra loro senza scrivere a log l'email di
    // nessuno.
    console.warn("[limite-tentativi] blocco scattato", {
      azione,
      chiave: chiave.slice(0, 12),
      tentativi: riga.tentativi,
      finestraMinuti: limite.finestraMinuti,
      riprovaDal: riga.riprova_dal,
    });

    return { bloccato: true, messaggio: messaggioLimite(azione, riga.riprova_dal) };
  } catch (errore) {
    console.error("[limite-tentativi] contatore non disponibile, tentativo lasciato passare", {
      azione,
      errore: errore instanceof Error ? errore.message : errore,
    });
    return PASSA;
  }
}

/**
 * Azzera il contatore. Si chiama dopo un'operazione riuscita (un accesso
 * andato a buon fine): chi ricorda la password al quarto tentativo non deve
 * restare a un tentativo dal blocco per i dieci minuti successivi.
 */
export async function azzeraTentativi(
  azione: AzioneLimitata,
  elementi: (string | null)[]
): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.rpc("azzera_tentativi_autenticazione", {
      p_azione: azione,
      p_chiave: chiaveTentativo(azione, elementi),
    });
    if (error) {
      console.error("[limite-tentativi] azzeramento non riuscito", {
        azione,
        errore: error.message,
      });
    }
  } catch (errore) {
    console.error("[limite-tentativi] azzeramento non riuscito", {
      azione,
      errore: errore instanceof Error ? errore.message : errore,
    });
  }
}
