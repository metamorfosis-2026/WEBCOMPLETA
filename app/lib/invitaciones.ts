/*
  Links de invitacion (solo servidor). Cada link sirve para UNA entrada.

  El token es "<id>-<firma>": el id es al azar y la firma es un HMAC del id
  con una clave del servidor, asi nadie puede inventar un link. No hace falta
  tabla nueva: el link queda usado cuando existe una entrada (no cancelada)
  con ese id en `source`. Si esa entrada se cancela, el link vuelve a servir.
*/

import { createHmac, timingSafeEqual } from 'node:crypto';

import { customAlphabet } from 'nanoid';

import { INVITATION_ID_RE } from './entradas';

const generateId = customAlphabet('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 8);
const SIGNATURE_LENGTH = 16;

function secret() {
  const value = process.env.INVITATION_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error('Falta la clave para firmar los links de invitación.');
  return value;
}

function sign(id: string) {
  return createHmac('sha256', secret()).update(`invitacion-m7:${id}`).digest('hex').slice(0, SIGNATURE_LENGTH);
}

export function createInvitationToken() {
  const id = generateId();
  return `${id}-${sign(id)}`;
}

// Devuelve el id de la invitacion si el token es valido; si no, null.
export function verifyInvitationToken(token: string) {
  const [rawId, signature, ...rest] = token.trim().split('-');
  const id = (rawId ?? '').toUpperCase();
  if (rest.length || !INVITATION_ID_RE.test(id) || !signature || signature.length !== SIGNATURE_LENGTH) return null;
  try {
    const expected = Buffer.from(sign(id));
    const given = Buffer.from(signature.toLowerCase());
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  } catch {
    return null;
  }
  return id;
}
