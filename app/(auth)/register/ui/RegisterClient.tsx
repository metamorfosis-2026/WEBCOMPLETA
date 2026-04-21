'use client';

import { useMemo, useState } from 'react';

import { safeRedirectPath } from '@/app/lib/metamorfosis';
import { createClient } from '@/app/lib/supabase/client';

export default function RegisterClient({
  from,
  refCode,
  initialError,
}: {
  from?: string;
  refCode?: string;
  initialError?: string | null;
}) {
  const callbackPath = useMemo(() => safeRedirectPath(from, '/dashboard'), [from]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  async function onGoogleRegister() {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
      setError('Falta configurar Supabase para habilitar el registro.');
      return;
    }

    setLoading(true);
    setError(null);

    const redirectTo = new URL('/auth/callback', window.location.origin);
    redirectTo.searchParams.set('next', callbackPath);
    if (refCode) redirectTo.searchParams.set('ref', refCode);

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
      setError('No pudimos iniciar el registro con Google.');
    }
  }

  return (
    <div className="grid gap-4">
      {refCode ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-white/70">
          Invitacion detectada. Si seguis con Google vamos a vincular esta cuenta al codigo{' '}
          <span className="font-semibold text-white">{refCode}</span>.
        </div>
      ) : null}

      <button
        type="button"
        onClick={onGoogleRegister}
        disabled={loading}
        className="inline-flex h-12 items-center justify-center rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:opacity-60"
      >
        {loading ? 'Abriendo Google...' : 'Crear cuenta con Google'}
      </button>

      {error ? <p className="text-sm font-medium text-amber-200/90">{error}</p> : null}

      <p className="text-xs text-white/50">
        Esto crea tu acceso al panel personal. Luego el equipo puede asignarte a una edicion y
        registrar tus pagos.
      </p>
    </div>
  );
}
