import { NextResponse, type NextRequest } from 'next/server';

import { processMercadoPagoPayment } from '@/app/lib/entradas-flow';
import { verifyMercadoPagoSignature } from '@/app/lib/mercadopago';
import { getSiteUrl } from '@/app/lib/site';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/*
  Notificaciones de Mercado Pago. Llegan en dos formatos:
  - Webhooks: ?type=payment&data.id=123 (y el mismo dato en el body).
  - IPN viejo: ?topic=payment&id=123.
  Ignoramos merchant_order y el resto. Respondemos 500 solo si fallo algo
  nuestro, para que MP reintente.
*/
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  let body: Record<string, any> = {};
  try {
    body = await request.json();
  } catch {
    // MP a veces manda el body vacio: usamos la query.
  }

  const type = url.searchParams.get('type') ?? url.searchParams.get('topic') ?? body.type ?? body.topic ?? '';
  const dataId =
    url.searchParams.get('data.id') ??
    body?.data?.id ??
    (type === 'payment' ? url.searchParams.get('id') ?? body.id : null);

  if (type !== 'payment' || !dataId) {
    return NextResponse.json({ ignored: true });
  }

  const signatureOk = verifyMercadoPagoSignature({
    signatureHeader: request.headers.get('x-signature'),
    requestId: request.headers.get('x-request-id'),
    dataId: String(dataId),
  });
  if (signatureOk === false) {
    console.warn('[mercadopago] firma invalida para el pago', dataId);
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  try {
    const result = await processMercadoPagoPayment(String(dataId), getSiteUrl(url.origin));
    return NextResponse.json({ ok: true, handled: result.handled });
  } catch (error) {
    console.error('[mercadopago] error procesando el pago', dataId, error);
    return NextResponse.json({ error: 'processing failed' }, { status: 500 });
  }
}

// Para probar a mano que la URL responde.
export async function GET() {
  return NextResponse.json({ ok: true });
}
