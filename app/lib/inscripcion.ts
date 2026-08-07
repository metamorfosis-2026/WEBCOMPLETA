/*
  Datos comerciales de la edicion vigente + helpers de contacto.
  Se usa tanto en la landing (cliente) como en el server action de inscripcion.
*/

export const EDITION_NUMBER = '7ma';
export const EDITION_NAME = 'METAMORFOSIS 7ma Edición';
export const EDITION_DATE_LABEL = 'Septiembre / Octubre 2026';
export const EDITION_DATE_SHORT = 'SEPT / OCT 2026';
export const EDITION_LABEL = `${EDITION_NAME} · ${EDITION_DATE_LABEL}`;
export const EDITION_PLACE = 'Zona Oeste';

export const FASE1_PRICE_LABEL = '$120.000';
export const FASE1_PRICE_TRANSFER_LABEL = '$72.000';
export const FASE1_TRANSFER_DISCOUNT_LABEL = '40%';
export const FASE1_RESERVE_LABEL = '50%';
export const FASE1_SCHEDULE = 'Sábado y domingo · 10:30 a 18:30';

export const CTA_LABEL = `Inscribite en ${EDITION_NAME}`;
export const CTA_LABEL_SHORT = `Inscribite · ${EDITION_NUMBER} Edición`;
// El CTA se arma en dos renglones. El peso visual lo lleva la edición:
// "Inscribite en" es la bajada chica y "Metamorfosis 7ma Edición" el titular.
export const CTA_LINE_TOP = 'Inscribite en';
export const CTA_LINE_BOTTOM = 'Metamorfosis 7ma Edición';

export const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '5491164450430';
export const INSTAGRAM_USERNAME = process.env.NEXT_PUBLIC_INSTAGRAM_USERNAME ?? 'metamorfosis.vip';
export const INSTAGRAM_DM_URL = `https://ig.me/m/${INSTAGRAM_USERNAME}`;
export const INSTAGRAM_PROFILE_URL = `https://www.instagram.com/${INSTAGRAM_USERNAME}/`;

export function onlyDigits(value: string) {
  return value.replace(/\D+/g, '');
}

export function buildWhatsAppUrl(message: string, phoneDigits = WHATSAPP_NUMBER) {
  return `https://wa.me/${onlyDigits(phoneDigits)}?text=${encodeURIComponent(message)}`;
}

export function buildSignupMessage({
  fullName,
  phone,
  social,
}: {
  fullName: string;
  phone: string;
  social?: string;
}) {
  return [
    `Hola! Quiero inscribirme en ${EDITION_NAME} (Fase 1).`,
    fullName.trim() ? `Nombre: ${fullName.trim()}` : null,
    onlyDigits(phone) ? `WhatsApp: +${onlyDigits(phone)}` : null,
    social?.trim() ? `Red social: ${social.trim()}` : null,
    '¿Me pasás las fechas exactas y cómo reservo mi lugar?',
  ]
    .filter(Boolean)
    .join('\n');
}
