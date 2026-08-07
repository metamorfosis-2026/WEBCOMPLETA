'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { EDITION_LABEL, onlyDigits } from '@/app/lib/inscripcion';
import { insertSignup } from '@/app/lib/supabase/db';

const signupSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  phone: z.string().trim().min(6).max(40),
  social: z.string().trim().max(120).optional().or(z.literal('')),
  source: z.string().trim().max(60).optional().or(z.literal('')),
});

export type SignupInput = z.infer<typeof signupSchema>;

export type SignupResult =
  | { ok: true; id: string }
  | { ok: false; error: 'INVALID' | 'STORAGE' };

/*
  Guarda la inscripcion en Supabase (tabla signups, se ve en /admin).
  Si Supabase falla (o falta la tabla), devolvemos ok:false pero la UI
  igual ofrece el DM de Instagram: nunca bloqueamos el contacto por un
  problema nuestro.
*/
export async function submitSignup(input: SignupInput): Promise<SignupResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };

  const { fullName, phone, social, source } = parsed.data;
  const digits = onlyDigits(phone);
  if (digits.length < 8) return { ok: false, error: 'INVALID' };

  try {
    const signup = await insertSignup({
      full_name: fullName,
      phone: digits,
      social: social?.trim() ? social.trim() : null,
      edition_label: EDITION_LABEL,
      source: source?.trim() ? source.trim() : 'landing',
      status: 'NUEVO',
    });

    revalidatePath('/admin');
    return { ok: true, id: signup.id };
  } catch {
    return { ok: false, error: 'STORAGE' };
  }
}
