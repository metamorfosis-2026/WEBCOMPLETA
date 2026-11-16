'use server';

import { headers } from 'next/headers';
import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';

import { claimInvitation, type InvitationError } from '@/app/lib/entradas-flow';
import { verifyInvitationToken } from '@/app/lib/invitaciones';
import { isValidWhatsAppNumber, toWhatsAppNumber } from '@/app/lib/phone';
import { getSiteUrl } from '@/app/lib/site';

const schema = z.object({
  token: z.string().trim().min(10).max(60),
  fullName: z.string().trim().min(3).max(120),
  phone: z.string().trim().min(6).max(40),
  email: z.string().trim().max(160).email().optional().or(z.literal('')),
  // Anti-bots: campo oculto (hp) y cuanto tardo en llenar el formulario.
  hp: z.string().max(300).optional(),
  elapsedMs: z.number().nonnegative().optional(),
});

const MIN_FILL_MS = 3000;

export type InvitationInput = z.infer<typeof schema>;
export type InvitationClaimError = 'INVALID' | 'PHONE' | 'LINK' | 'RETRY' | 'FAILED' | InvitationError;
export type InvitationResult = { ok: true; code: string; error?: undefined } | { ok: false; error: InvitationClaimError };

function requestOrigin() {
  const list = headers();
  const host = list.get('x-forwarded-host') ?? list.get('host');
  if (!host) return null;
  const proto = list.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

// Canjea un link de invitacion: crea la entrada confirmada (sin pago) y manda el QR.
export async function acceptInvitation(input: InvitationInput): Promise<InvitationResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };

  const honeypot = parsed.data.hp?.trim() ?? '';
  if (honeypot && (parsed.data.elapsedMs ?? 0) < MIN_FILL_MS) return { ok: false, error: 'RETRY' };

  const invitationId = verifyInvitationToken(parsed.data.token);
  if (!invitationId) return { ok: false, error: 'LINK' };

  const phone = toWhatsAppNumber(parsed.data.phone);
  if (!isValidWhatsAppNumber(phone)) return { ok: false, error: 'PHONE' };

  try {
    const result = await claimInvitation(
      {
        invitationId,
        fullName: parsed.data.fullName.replace(/\s+/g, ' '),
        phone,
        email: parsed.data.email ? parsed.data.email.toLowerCase() : null,
      },
      getSiteUrl(requestOrigin())
    );
    if ('error' in result) return { ok: false, error: result.error };

    revalidatePath('/admin');
    revalidateTag('entradas-vendidas');
    return { ok: true, code: result.ticket.code };
  } catch (error) {
    console.error('[invitacion] no se pudo crear la entrada:', error);
    return { ok: false, error: 'FAILED' };
  }
}
