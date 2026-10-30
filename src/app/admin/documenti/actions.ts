"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { richiedeAmministratore } from "@/lib/supabase/dal";
import { CATEGORIE_DOCUMENTO, DOCUMENTO_MAX_BYTES } from "@/lib/archivio";
import { FAMIGLIE_ARCHIVIO, testaDiFile, verificaTipoFile } from "@/lib/tipi-file";
import type { CategoriaDocumento } from "@/lib/types";

export type StatoForm = { errore?: string } | undefined;

function rivalida() {
  revalidatePath("/admin/documenti");
  revalidatePath("/area-riservata/documenti");
}

/**
 * Sanifica il nome per il percorso nello storage. L'estensione non è quella
 * del nome caricato ma quella del formato riconosciuto dai primi byte
 * (COD-06): un PNG rinominato "foto.html" non deve finire nello storage con
 * un percorso che termina in .html.
 */
function nomeSicuro(nomeFile: string, estensione: string): string {
  const senzaEstensione = nomeFile.replace(/\.[^.]*$/, "");
  const normalizzato = senzaEstensione
    .normalize("NFD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${normalizzato || "documento"}.${estensione}`;
}

/**
 * Caricamento di un documento nell'archivio del condominio.
 *
 * Il file finisce nel bucket privato già usato per fatture e verbali, sotto
 * "condomini/{condominio_id}/": è il prefisso su cui la policy dello storage
 * decide chi legge (tutti i condòmini di quello stabile) e chi scrive (il solo
 * amministratore). La riga in tabella tiene i metadati; se l'inserimento non
 * riesce il file viene rimosso, per non lasciare orfani nel bucket.
 */
export async function caricaDocumento(
  _stato: StatoForm,
  formData: FormData
): Promise<StatoForm> {
  const condominioId = String(formData.get("condominio_id") ?? "");
  const titolo = String(formData.get("titolo") ?? "").trim();
  const descrizione = String(formData.get("descrizione") ?? "").trim();
  const categoriaRichiesta = String(formData.get("categoria") ?? "");
  const file = formData.get("file");

  if (!condominioId) return { errore: "Seleziona il condominio." };
  if (!(file instanceof File) || file.size === 0) {
    return { errore: "Scegli il file da caricare." };
  }
  if (file.size > DOCUMENTO_MAX_BYTES) {
    return { errore: "Il file supera i 10 MB consentiti." };
  }

  // COD-06: il tipo si decide dai primi byte del file, non da `file.type`,
  // che è dichiarato dal browser e quindi scelto da chi carica.
  const tipo = verificaTipoFile(await testaDiFile(file), file.name, FAMIGLIE_ARCHIVIO);
  if (!tipo.ok) return { errore: tipo.errore };

  const categoria: CategoriaDocumento = (CATEGORIE_DOCUMENTO as string[]).includes(
    categoriaRichiesta
  )
    ? (categoriaRichiesta as CategoriaDocumento)
    : "altro";

  const amministratore = await richiedeAmministratore();
  const supabase = await createClient();

  const percorso = `condomini/${condominioId}/${Date.now()}-${nomeSicuro(
    file.name,
    tipo.estensione
  )}`;

  const { error: erroreUpload } = await supabase.storage
    .from("documenti-condominio")
    .upload(percorso, file, { contentType: tipo.mime });

  if (erroreUpload) {
    console.error("[archivio] caricamento del documento non riuscito", {
      condominioId,
      errore: erroreUpload.message,
    });
    return { errore: "Caricamento del file non riuscito: riprova." };
  }

  const { error } = await supabase.from("documenti_condominio").insert({
    condominio_id: condominioId,
    titolo: titolo || file.name,
    descrizione: descrizione || null,
    categoria,
    percorso,
    nome_file: file.name,
    dimensione_byte: file.size,
    // Il MIME riconosciuto, non quello dichiarato dal client.
    mime_type: tipo.mime,
    caricato_da: amministratore.id,
  });

  if (error) {
    await supabase.storage.from("documenti-condominio").remove([percorso]);
    console.error("[archivio] registrazione del documento non riuscita", {
      condominioId,
      errore: error.message,
    });
    return { errore: "Il documento non è stato registrato in archivio: riprova." };
  }

  rivalida();
}

export async function aggiornaDocumento(input: {
  id: string;
  titolo: string;
  descrizione: string;
  categoria: string;
}): Promise<{ ok: true } | { errore: string }> {
  if (!input.id) return { errore: "Documento non valido." };
  if (!input.titolo.trim()) return { errore: "Il titolo è obbligatorio." };

  await richiedeAmministratore();
  const supabase = await createClient();

  const categoria = (CATEGORIE_DOCUMENTO as string[]).includes(input.categoria)
    ? (input.categoria as CategoriaDocumento)
    : "altro";

  const { error } = await supabase
    .from("documenti_condominio")
    .update({
      titolo: input.titolo.trim(),
      descrizione: input.descrizione.trim() || null,
      categoria,
    })
    .eq("id", input.id);

  if (error) return { errore: error.message };
  rivalida();
  return { ok: true };
}

/**
 * Elimina prima la riga e poi il file: se andasse a rovescio e la cancellazione
 * della riga fallisse, l'archivio mostrerebbe un documento non più scaricabile.
 * Un file rimasto nel bucket senza riga, invece, è invisibile e innocuo.
 */
export async function eliminaDocumento(id: string): Promise<{ errore?: string }> {
  if (!id) return { errore: "Documento non valido." };
  await richiedeAmministratore();

  const supabase = await createClient();
  const { data: documento } = await supabase
    .from("documenti_condominio")
    .select("percorso")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("documenti_condominio").delete().eq("id", id);
  if (error) return { errore: error.message };

  if (documento?.percorso) {
    await supabase.storage.from("documenti-condominio").remove([documento.percorso]);
  }

  rivalida();
  return {};
}
