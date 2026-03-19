'use client';

import { useMemo, useState } from 'react';
import { signIn } from 'next-auth/react';

export default function LoginClient({ from }: { from?: string }) {
  const callbackUrl = useMemo(() => from || '/dashboard', [from]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCredentialsLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await signIn('credentials', {
      email,
      password,
      callbackUrl,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError('Email o contraseña inválidos.');
      return;
    }

    // redirect manually (keeps client simple)
    window.location.href = callbackUrl;
  }

  return (
    <div className="grid gap-4">
      <button
        type="button"
        onClick={() => signIn('google', { callbackUrl })}
        className="inline-flex h-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-white/90 transition hover:bg-white/10"
      >
        Ingresar con Google
      </button>

      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center">
          <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-xs text-white/60">
            o con email
          </span>
        </div>
      </div>

      <form onSubmit={onCredentialsLogin} className="grid gap-3">
        <label className="grid gap-1">
          <span className="text-xs text-white/70">Email</span>
          <input
            className="h-11 rounded-xl border border-white/10 bg-black/30 px-4 text-sm outline-none placeholder:text-white/30 focus:border-emerald-400/50"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-white/70">Contraseña</span>
          <input
            className="h-11 rounded-xl border border-white/10 bg-black/30 px-4 text-sm outline-none placeholder:text-white/30 focus:border-emerald-400/50"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
          />
        </label>

        {error ? <p className="text-sm font-medium text-amber-200/90">{error}</p> : null}

        <button
          disabled={loading}
          className="inline-flex h-12 items-center justify-center rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:opacity-60"
          type="submit"
        >
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>

        <p className="text-xs text-white/50">
          Este acceso es para ver tu panel (referencias, puntos y estado). No es una venta automática.
        </p>
      </form>
    </div>
  );
}
