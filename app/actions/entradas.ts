'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { TICKET_CAPACITY } from '@/app/lib/entradas';
import { startCheckout, startDuoCheckout } from '@/app/lib/entradas-flow';
import { hasMercadoPago } from '@/app/lib/mercadopago';
import { isValidWhatsAppNumber, toWhatsAppNumber } from '@/app/lib/phone';
import { getSiteUrl } from '@/app/lib/site';
import { countSoldTickets } from '@/app/lib/supabase/tickets';

const checkoutSchema = z.object({
  plan: z.enum(['FULL', 'SPLIT', 'DUO']),
  fullName: z.string().trim().min(3).max(120),
  phone: z.string().trim().min(6).max(40),
  // Promo para dos: la segunda persona (le llega su propia entrada a su WhatsApp).
  guestName: z.string().trim().max(120).optional().or(z.literal('')),
  guestPhone: z.string().trim().max(40).optional().or(z.literal('')),
  email: z.string().trim().max(160).email().optional().or(z.literal('')),
  source: z.string().trim().max(60).optional().or(z.literal('')),
  // Anti-bots: campo oculto (hp) y cuanto tardo en llenar el formulario.
  hp: z.string().max(300).optional(),
  elapsedMs: z.number().nonnegative().optional(),
});

// Un humano no completa nombre + WhatsApp en menos de esto.
const MIN_FILL_MS = 3000;

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export type CheckoutError =
  | 'INVALID'
  | 'PHONE'
  | 'GUEST'
  | 'GUEST_PHONE'
  | 'SAME_PHONE'
  | 'BUYER_HAS_TICKET'
  | 'GUEST_HAS_TICKET'
  | 'SOLD_OUT'
  | 'PAYMENTS_OFF'
  | 'FAILED'
  | 'RETRY';

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

  /*
    El campo oculto solo es una senal: Safari, Samsung Internet, Firefox y los
    gestores de contrasenas a veces lo autocompletan aunque diga
    autocomplete=off. Solo frenamos si ademas se lleno en menos de 3 s (un
    bot), y aun asi devolvemos un error visible para que una persona pueda
    reintentar.
  */
  const honeypot = parsed.data.hp?.trim() ?? '';
  if (honeypot && (parsed.data.elapsedMs ?? 0) < MIN_FILL_MS) {
    console.warn('[entradas] posible bot: campo oculto lleno y formulario completado en', parsed.data.elapsedMs, 'ms');
    return { ok: false, error: 'RETRY' };
  }

  const phone = toWhatsAppNumber(parsed.data.phone);
  if (!isValidWhatsAppNumber(phone)) return { ok: false, error: 'PHONE' };

  const duo = parsed.data.plan === 'DUO';
  const guestName = (parsed.data.guestName ?? '').trim().replace(/\s+/g, ' ');
  const guestPhone = toWhatsAppNumber(parsed.data.guestPhone ?? '');
  if (duo) {
    if (guestName.length < 3) return { ok: false, error: 'GUEST' };
    if (!isValidWhatsAppNumber(guestPhone)) return { ok: false, error: 'GUEST_PHONE' };
    if (guestPhone === phone) return { ok: false, error: 'SAME_PHONE' };
  }
  if (!hasMercadoPago()) return { ok: false, error: 'PAYMENTS_OFF' };

  try {
    if ((await countSoldTickets()) >= TICKET_CAPACITY) return { ok: false, error: 'SOLD_OUT' };

    const siteUrl = getSiteUrl(requestOrigin());
    const buyer = {
      fullName: parsed.data.fullName,
      phone,
      email: parsed.data.email ? parsed.data.email.toLowerCase() : null,
    };
    const source = parsed.data.source || 'web';

    if (duo) {
      const result = await startDuoCheckout({ buyer, guest: { fullName: guestName, phone: guestPhone }, origin: source }, siteUrl);
      if ('error' in result) return { ok: false, error: result.error };
      revalidatePath('/admin');
      return { ok: true, url: result.url, code: result.ticket.code };
    }

    const { ticket, url } = await startCheckout(
      { ...buyer, plan: parsed.data.plan === 'SPLIT' ? 'SPLIT' : 'FULL', source },
      siteUrl
    );

    revalidatePath('/admin');
    return { ok: true, url, code: ticket.code };
  } catch (error) {
    console.error('[entradas] no se pudo iniciar el pago:', error);
    return { ok: false, error: 'FAILED' };
  }
}
