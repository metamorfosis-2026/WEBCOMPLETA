import { getSiteUrl } from '@/app/lib/site';
import { getTicketByCode } from '@/app/lib/supabase/tickets';
import { renderTicketImage } from '@/app/lib/ticket-image';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PNG de la entrada con el QR (solo si tiene algun pago acreditado).
export async function GET(request: Request, { params }: { params: { code: string } }) {
  let ticket;
  try {
    ticket = await getTicketByCode(params.code);
  } catch (error) {
    console.error('[entradas] imagen: no se pudo leer la entrada', error);
    return new Response('Error', { status: 500 });
  }
  if (!ticket || (ticket.status !== 'PAGADO' && ticket.status !== 'SENADO')) {
    return new Response('No encontrada', { status: 404 });
  }

  return renderTicketImage(ticket, getSiteUrl(new URL(request.url).origin));
}
