'use client';

import { useMemo, useState } from 'react';

import { safeRedirectPath } from '@/app/lib/metamorfosis';
import { createClient } from '@/app/lib/supabase/client';

export default function LoginClient({
  from,
  initialError,
}: {
  from?: string;
  initialError?: string | null;
}) {
  const callbackPath = useMemo(() => safeRedirectPath(from, '/dashboard'), [from]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  async function onGoogleLogin() {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
      setError('Falta configurar Supabase para habilitar el ingreso.');
      return;
    }

    setLoading(true);
    setError(null);

    const redirectTo = new URL('/auth/callback', window.location.origin);
    redirectTo.searchParams.set('next', callbackPath);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo.toString(),
        queryParams: {
          prompt: 'select_account',
        },
      },
    });

    if (signInError) {
      setLoading(false);
      setError('No pudimos abrir Google. Intenta de nuevo.');
    }
  }

  return (
    <div className="grid gap-4">
      <button
        type="button"
        onClick={onGoogleLogin}
        disabled={loading}
        className="inline-flex h-12 items-center justify-center rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:opacity-60"
      >
        {loading ? 'Abriendo Google...' : 'Ingresar con Google'}
      </button>

      {error ? <p className="text-sm font-medium text-amber-200/90">{error}</p> : null}

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
        Usa la misma cuenta de Gmail con la que participas en Metamorfosis. Si aun no tenes acceso,
        podes crear tu cuenta desde la pantalla de registro.
      </div>
    </div>
  );
}
