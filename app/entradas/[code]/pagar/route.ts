import { NextResponse, type NextRequest } from 'next/server';

import { createPaymentLink } from '@/app/lib/entradas-flow';
import { hasMercadoPago } from '@/app/lib/mercadopago';
import { getSiteUrl } from '@/app/lib/site';
import { getTicketByCode } from '@/app/lib/supabase/tickets';

export const dynamic = 'force-dynamic';

/*
  Link fijo para pagar lo que falta de una entrada (el primer pago o el
  saldo). Es el que va en los WhatsApp: cada vez arma un checkout nuevo de
  Mercado Pago con el monto que corresponde en ese momento.
*/
export async function GET(request: NextRequest, { params }: { params: { code: string } }) {
  const siteUrl = getSiteUrl(new URL(request.url).origin);
  const ticketUrl = `${siteUrl}/entradas/${encodeURIComponent(params.code.toUpperCase())}`;

  try {
    const ticket = await getTicketByCode(params.code);
    if (!ticket) return NextResponse.redirect(`${siteUrl}/entradas`, 303);
    if (!hasMercadoPago()) return NextResponse.redirect(`${ticketUrl}?pago=no-disponible`, 303);

    const url = await createPaymentLink(ticket, siteUrl);
    return NextResponse.redirect(url ?? ticketUrl, 303);
  } catch (error) {
    console.error('[entradas] no se pudo armar el pago de', params.code, error);
    return NextResponse.redirect(`${ticketUrl}?pago=error`, 303);
  }
}
