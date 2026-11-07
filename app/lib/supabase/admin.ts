import { createClient } from '@supabase/supabase-js';

import { getSupabaseAdminEnv } from './config';

/*
  Lecturas siempre frescas: Next memoriza los GET identicos dentro de un mismo
  render, y despues de escribir (por ejemplo, acreditar un pago y volver a leer
  la entrada) devolvia la version vieja. Pasar un `signal` lo desactiva, y de
  paso pone un tope de tiempo si Supabase no responde.
*/
const QUERY_TIMEOUT_MS = 15_000;

function freshFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, {
    ...init,
    cache: 'no-store',
    signal: init?.signal ?? AbortSignal.timeout(QUERY_TIMEOUT_MS),
  });
}

/*
  Para lecturas que se cachean con unstable_cache: mismo tope de tiempo pero sin
  `cache: 'no-store'`, que dentro de una pagina con revalidate la volveria
  dinamica. unstable_cache igual hace la consulta real cada vez que se renueva.
*/
function timedFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(QUERY_TIMEOUT_MS) });
}

export function createAdminClient({ cacheable = false }: { cacheable?: boolean } = {}) {
  const { url, serviceRoleKey } = getSupabaseAdminEnv();

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: { fetch: cacheable ? timedFetch : freshFetch },
  });
}
