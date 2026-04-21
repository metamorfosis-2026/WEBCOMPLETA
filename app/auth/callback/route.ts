import { NextResponse } from 'next/server';

import { syncSupabaseAuthUser } from '@/auth';
import { safeRedirectPath } from '@/app/lib/metamorfosis';
import { hasSupabaseEnv } from '@/app/lib/supabase/config';
import { createClient } from '@/app/lib/supabase/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = safeRedirectPath(requestUrl.searchParams.get('next'), '/dashboard');
  const ref = requestUrl.searchParams.get('ref');

  if (!hasSupabaseEnv()) {
    return NextResponse.redirect(new URL('/login?error=config', requestUrl.origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=oauth', requestUrl.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL('/login?error=oauth', requestUrl.origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await syncSupabaseAuthUser(user, { refCode: ref });
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
