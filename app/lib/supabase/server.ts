import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { getSupabaseEnv } from './config';

export async function createClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseEnv();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot mutate cookies. Route Handlers and Server Actions can.
        }
      },
    },
  });
}
