'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { TICKET_CAPACITY } from '@/app/lib/entradas';
import { startCheckout } from '@/app/lib/entradas-flow';
import { hasMercadoPago } from '@/app/lib/mercadopago';
import { isValidWhatsAppNumber, toWhatsAppNumber } from '@/app/lib/phone';
import { getSiteUrl } from '@/app/lib/site';
import { countSoldTickets } from '@/app/lib/supabase/tickets';

const checkoutSchema = z.object({
  plan: z.enum(['FULL', 'SPLIT']),
  fullName: z.string().trim().min(3).max(120),
  phone: z.string().trim().min(6).max(40),
  email: z.string().trim().max(160).email().optional().or(z.literal('')),
  source: z.string().trim().max(60).optional().or(z.literal('')),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export type CheckoutError = 'INVALID' | 'PHONE' | 'SOLD_OUT' | 'PAYMENTS_OFF' | 'FAILED';

export type CheckoutResult =
  | { ok: true; url: string; code: string; error?: undefined }
  | { ok: false; error: CheckoutError };

function requestOrigin() {
  const list = headers();
  const host = list.get('x-forwarded-host') ?? list.get('host');
  if (!host) return null;
  const proto = list.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

/*
  Crea (o reutiliza) la entrada y devuelve el link de Mercado Pago.
  El lugar se ocupa recien cuando el pago se acredita.
*/
export async function startTicketCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };

  const phone = toWhatsAppNumber(parsed.data.phone);
  if (!isValidWhatsAppNumber(phone)) return { ok: false, error: 'PHONE' };
  if (!hasMercadoPago()) return { ok: false, error: 'PAYMENTS_OFF' };

  try {
    if ((await countSoldTickets()) >= TICKET_CAPACITY) return { ok: false, error: 'SOLD_OUT' };

    const { ticket, url } = await startCheckout(
      {
        plan: parsed.data.plan,
        fullName: parsed.data.fullName,
        phone,
        email: parsed.data.email ? parsed.data.email.toLowerCase() : null,
        source: parsed.data.source || 'web',
      },
      getSiteUrl(requestOrigin())
    );

    revalidatePath('/admin');
    return { ok: true, url, code: ticket.code };
  } catch (error) {
    console.error('[entradas] no se pudo iniciar el pago:', error);
    return { ok: false, error: 'FAILED' };
  }
}
