/*
  Datos comerciales de la edicion vigente + helpers de contacto.
  Se usa tanto en la landing (cliente) como en el server action de inscripcion.
*/

import { onlyDigits } from './phone';

export const EDITION_NUMBER = '7ma';
export const EDITION_NAME = 'METAMORFOSIS 7ma Edición';
export const EDITION_DATE_LABEL = '28 y 29 de noviembre';
export const EDITION_DATE_SHORT = '28-29 NOV';
export const EDITION_LABEL = `${EDITION_NAME} · ${EDITION_DATE_LABEL}`;

/*
  Lista de espera: el taller es muy a medida, asi que el fin de semana de
  noviembre se confirma recien cuando hay un minimo de inscriptos. Las
  personas que se anotan despues del maximo quedan como reserva.
*/
export const WAITLIST_MIN = 25;
export const WAITLIST_MAX = 50;
// Desde cuantos anotados mostramos el numero en la web publica. Por debajo
// de esto el contador juega en contra ("1 de 50" parece que nadie va).
export const WAITLIST_PUBLIC_FROM = 10;
export const EDITION_PLACE = 'Zona Oeste';

// Los precios de la entrada viven en app/lib/entradas.ts.
export const FASE1_SCHEDULE = 'Sábado y domingo · 10:30 a 18:30';

export const CTA_LABEL = `Comprá tu entrada · ${EDITION_NAME}`;
export const CTA_LABEL_SHORT = `Entradas · ${EDITION_NUMBER} Edición`;
// El CTA se arma en dos renglones. El peso visual lo lleva la edición:
// "Comprá tu entrada" es la bajada chica y "Metamorfosis 7ma Edición" el titular.
export const CTA_LINE_TOP = 'Comprá tu entrada';
export const CTA_LINE_BOTTOM = 'Metamorfosis 7ma Edición';

export const INSTAGRAM_USERNAME = process.env.NEXT_PUBLIC_INSTAGRAM_USERNAME ?? 'metamorfosis.vip';
export const INSTAGRAM_DM_URL = `https://ig.me/m/${INSTAGRAM_USERNAME}`;
export const INSTAGRAM_PROFILE_URL = `https://www.instagram.com/${INSTAGRAM_USERNAME}/`;

export { onlyDigits };

// Texto que la persona pega en el DM de Instagram despues de inscribirse.
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
    `Hola! Me sumé a la lista de ${EDITION_NAME} (Fase 1, ${EDITION_DATE_LABEL}).`,
    fullName.trim() ? `Nombre: ${fullName.trim()}` : null,
    onlyDigits(phone) ? `WhatsApp: +${onlyDigits(phone)}` : null,
    social?.trim() ? `Red social: ${social.trim()}` : null,
    '¿Me avisan cuando confirmen el fin de semana y cómo reservo mi lugar?',
  ]
    .filter(Boolean)
    .join('\n');
}
