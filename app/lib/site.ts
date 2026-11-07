/*
  URL publica del sitio, para armar links absolutos (Mercado Pago, WhatsApp,
  QR). Conviene fijar SITE_URL=https://metamorfosis.vip en Vercel; si falta,
  usamos el dominio de produccion que expone Vercel o el origen del request.
*/
export function getSiteUrl(fallbackOrigin?: string | null) {
  const explicit = (process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? '').trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  if (fallbackOrigin) return fallbackOrigin.replace(/\/+$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export function isPublicHttps(url: string) {
  return /^https:\/\//i.test(url) && !/localhost|127\.0\.0\.1/i.test(url);
}
