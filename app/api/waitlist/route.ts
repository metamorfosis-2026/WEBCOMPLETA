import { NextResponse } from 'next/server';

import { EDITION_NAME, WAITLIST_MAX, WAITLIST_MIN, WAITLIST_PUBLIC_FROM } from '@/app/lib/inscripcion';
import { countActiveSignups } from '@/app/lib/supabase/db';

/*
  Estado publico de la lista de espera para la landing.
  El numero exacto solo sale cuando ya ayuda a vender (prueba social): con
  pocos anotados un "3 de 50" espanta, asi que el servidor lo oculta y la web
  muestra un mensaje sin numero.
*/
export const dynamic = 'force-dynamic';

export type WaitlistPublicState =
  | { phase: 'forming' }
  | { phase: 'filling'; count: number; missing: number }
  | { phase: 'confirmed'; count: number; left: number }
  | { phase: 'full' };

export async function GET() {
  let state: WaitlistPublicState = { phase: 'forming' };

  try {
    const count = await countActiveSignups(EDITION_NAME);

    if (count >= WAITLIST_MAX) state = { phase: 'full' };
    else if (count >= WAITLIST_MIN) state = { phase: 'confirmed', count, left: WAITLIST_MAX - count };
    else if (count >= WAITLIST_PUBLIC_FROM) state = { phase: 'filling', count, missing: WAITLIST_MIN - count };
  } catch {
    // Sin base de datos mostramos el mensaje neutro.
  }

  return NextResponse.json(state, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  });
}
