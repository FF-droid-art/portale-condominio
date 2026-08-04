// La "quota di titolarità" ha senso solo per chi vanta un diritto reale sul
// bene (proprietario, nudo proprietario, usufruttuario, assegnatario). Chi ha
// solo un diritto personale di godimento (conduttore = inquilino, comodatario)
// non possiede una quota.
export const RUOLI_SENZA_QUOTA = ["conduttore", "comodatario"];

export function haQuota(tipoSoggetto: string): boolean {
  return !RUOLI_SENZA_QUOTA.includes(tipoSoggetto);
}
