'use client';

import { useMemo, useState } from 'react';
import { signIn } from 'next-auth/react';

export default function RegisterClient({
  from,
  refCode,
}: {
  from?: string;
  refCode?: string;
}) {
  const callbackUrl = useMemo(() => from || '/dashboard', [from]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, email, password, ref: refCode }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      if (res.status === 409) setError('Ese email ya está en uso.');
      else setError(data?.error === 'INVALID_INPUT' ? 'Revisá los datos.' : 'No se pudo registrar.');
      setLoading(false);
      return;
    }

    // Auto-login with credentials
    const login = await signIn('credentials', {
      email,
      password,
      callbackUrl,
      redirect: false,
    });

    setLoading(false);

    if (login?.error) {
      window.location.href = `/login?from=${encodeURIComponent(callbackUrl)}`;
      return;
    }

    window.location.href = callbackUrl;
  }

  return (
    <form onSubmit={onRegister} className="grid gap-3">
      <label className="grid gap-1">
        <span className="text-xs text-white/70">Nombre y apellido</span>
        <input
          className="h-11 rounded-xl border border-white/10 bg-black/30 px-4 text-sm outline-none placeholder:text-white/30 focus:border-emerald-400/50"
          placeholder="Ej: Juan Pérez"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
      </label>

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
          placeholder="Mínimo 8 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete="new-password"
        />
      </label>

      {refCode ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-white/70">
          Invitación de la comunidad detectada (código: <span className="font-semibold text-white">{refCode}</span>).
        </div>
      ) : null}

      {error ? <p className="text-sm font-medium text-amber-200/90">{error}</p> : null}

      <button
        disabled={loading}
        className="inline-flex h-12 items-center justify-center rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:opacity-60"
        type="submit"
      >
        {loading ? 'Creando…' : 'Crear cuenta'}
      </button>

      <p className="text-xs text-white/50">
        Esto habilita tu panel. No implica compra ni compromiso.
      </p>
    </form>
  );
}
