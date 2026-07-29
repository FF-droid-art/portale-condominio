import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

// Finché il dominio del mittente non è verificato su Resend, questo indirizzo
// di test consegna solo alla casella del proprio account Resend (sandbox mode).
export const MITTENTE_EMAIL = "Portale Condominio <onboarding@resend.dev>";
