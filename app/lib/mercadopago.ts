import { createHmac, timingSafeEqual } from 'node:crypto';

/*
  Mercado Pago Checkout Pro por API REST (sin SDK).
  - MP_ACCESS_TOKEN: credencial de produccion (APP_USR-...) de la cuenta que
    cobra. Con una TEST-... se usa el checkout de prueba.
  - MP_WEBHOOK_SECRET (opcional): "clave secreta" de Webhooks en el panel de
    MP. Si esta, se valida la firma x-signature de cada notificacion.

  Nunca confiamos en lo que llega al webhook: con el id del pago lo volvemos
  a pedir a la API de MP con nuestro token y usamos esa respuesta.
*/

// MP_API_URL solo para pruebas (apuntar a un simulador); por defecto, la API real.
function mpApi() {
  return (process.env.MP_API_URL?.trim() || 'https://api.mercadopago.com').replace(/\/+$/, '');
}

// Error de la API de MP con su status HTTP (0 = falta el token).
export class MercadoPagoError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'MercadoPagoError';
  }
}

export function hasMercadoPago() {
  return Boolean(process.env.MP_ACCESS_TOKEN?.trim());
}

function accessToken() {
  const token = process.env.MP_ACCESS_TOKEN?.trim();
  if (!token) throw new MercadoPagoError('MP_ACCESS_TOKEN no configurado', 0);
  return token;
}

async function mpFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${mpApi()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });

  const text = await response.text();
  if (!response.ok) {
    throw new MercadoPagoError(`MP ${response.status} ${path}: ${text.slice(0, 300)}`, response.status);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

/* --------------------------------------------------------------- preference */

// La referencia viaja en el pago y nos dice de que entrada y que cuota es.
// En la promo para dos lleva tambien el codigo de la segunda entrada.
export function buildExternalReference(code: string, plan: string, installment: number, partnerCode?: string | null) {
  return `${code}:${plan}:${installment}${partnerCode ? `:${partnerCode}` : ''}`;
}

export function parseExternalReference(reference: string | null | undefined) {
  const match = String(reference ?? '').match(/^(M7-[A-Z0-9]+):(FULL|SPLIT|DUO):(\d)(?::(M7-[A-Z0-9]+))?$/i);
  if (!match) return null;
  return {
    code: match[1].toUpperCase(),
    plan: match[2].toUpperCase() as 'FULL' | 'SPLIT' | 'DUO',
    installment: Number(match[3]),
    partnerCode: match[4] ? match[4].toUpperCase() : null,
  };
}

export async function createCheckoutPreference({
  code,
  partnerCode = null,
  plan,
  installment,
  amountCents,
  title,
  description,
  payerName,
  payerEmail,
  successUrl,
  pendingUrl,
  failureUrl,
  notificationUrl,
}: {
  code: string;
  partnerCode?: string | null;
  plan: string;
  installment: number;
  amountCents: number;
  title: string;
  description: string;
  payerName: string;
  payerEmail: string | null;
  successUrl: string;
  pendingUrl: string;
  failureUrl: string;
  notificationUrl: string | null;
}) {
  const [name, ...rest] = payerName.trim().split(/\s+/);
  const isHttps = /^https:\/\//i.test(successUrl);

  const body = {
    items: [
      {
        id: `${code}-${installment}`,
        title,
        description,
        quantity: 1,
        unit_price: Math.round(amountCents) / 100,
        currency_id: 'ARS',
      },
    ],
    payer: {
      name: name ?? '',
      surname: rest.join(' '),
      ...(payerEmail ? { email: payerEmail } : {}),
    },
    external_reference: buildExternalReference(code, plan, installment, partnerCode),
    metadata: { ticket_code: code, plan, installment, ...(partnerCode ? { partner_code: partnerCode } : {}) },
    back_urls: { success: successUrl, pending: pendingUrl, failure: failureUrl },
    // MP solo acepta auto_return con URLs https (en local no lo mandamos).
    ...(isHttps ? { auto_return: 'approved' } : {}),
    ...(notificationUrl ? { notification_url: notificationUrl } : {}),
    statement_descriptor: 'METAMORFOSIS',
  };

  const preference = await mpFetch<{ id: string; init_point: string; sandbox_init_point?: string }>(
    '/checkout/preferences',
    { method: 'POST', body: JSON.stringify(body) }
  );

  const useSandbox = accessToken().startsWith('TEST-') && preference.sandbox_init_point;
  return { id: preference.id, url: useSandbox ? preference.sandbox_init_point! : preference.init_point };
}

/* ------------------------------------------------------------------ payment */

export type MercadoPagoPayment = {
  id: number;
  status: string;
  status_detail: string | null;
  transaction_amount: number;
  currency_id: string;
  external_reference: string | null;
  date_approved: string | null;
  payer?: { email?: string | null } | null;
};

export async function getMercadoPagoPayment(paymentId: string) {
  return mpFetch<MercadoPagoPayment>(`/v1/payments/${encodeURIComponent(paymentId)}`);
}

/* ---------------------------------------------------------------- signature */

/*
  Firma de webhooks de MP: header x-signature = "ts=...,v1=..." y el
  manifest "id:{data.id};request-id:{x-request-id};ts:{ts};" firmado con
  HMAC-SHA256 y la clave secreta. Devuelve null si no hay como validar
  (sin clave o sin header): el pago igual se verifica contra la API.
*/
export function verifyMercadoPagoSignature({
  signatureHeader,
  requestId,
  dataId,
}: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string;
}): boolean | null {
  const secret = process.env.MP_WEBHOOK_SECRET?.trim();
  if (!secret || !signatureHeader) return null;

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((chunk) => {
      const [key, ...value] = chunk.split('=');
      return [key.trim(), value.join('=').trim()];
    })
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  let manifest = `id:${id};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;

  const expected = createHmac('sha256', secret).update(manifest).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(v1, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
