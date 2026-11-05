import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { hasSupabaseEnv } from './config';

const SESSION_REFRESH_TIMEOUT_MS = 3000;

export async function updateSession(request: NextRequest) {
  if (!hasSupabaseEnv()) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // Si Supabase no responde (proyecto pausado, caida, DNS), no bloqueamos la
  // pagina: el middleware de Vercel tiene un limite de tiempo y la web entera
  // devolveria 504 MIDDLEWARE_INVOCATION_TIMEOUT.
  try {
    await Promise.race([
      supabase.auth.getClaims(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('supabase getClaims timeout')), SESSION_REFRESH_TIMEOUT_MS)
      ),
    ]);
  } catch (error) {
    console.error('[middleware] no se pudo refrescar la sesion de Supabase:', error);
  }

  return response;
}
