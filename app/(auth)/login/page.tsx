import Link from 'next/link';

import LoginClient from './ui/LoginClient';

function resolveAuthErrorMessage(error?: string) {
  switch (error) {
    case 'oauth':
      return 'No pudimos completar el ingreso con Google.';
    case 'config':
      return 'Falta terminar la configuracion de Supabase en este entorno.';
    default:
      return null;
  }
}

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { from?: string; error?: string };
}) {
  const from = searchParams?.from;
  const error = resolveAuthErrorMessage(searchParams?.error);

  return (
    <main className="min-h-screen text-white">
      <div className="mx-auto w-full max-w-md px-5 py-14">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-7 backdrop-blur">
          <h1 className="text-2xl font-semibold tracking-tight">Ingresar</h1>
          <p className="mt-2 text-sm text-white/70">Acceso a tu panel personal con Google.</p>

          <div className="mt-6">
            <LoginClient from={from} initialError={error} />
          </div>

          <div className="mt-6 flex items-center justify-between text-sm">
            <Link
              className="text-white/70 hover:text-white hover:underline"
              href={`/register${from ? `?from=${encodeURIComponent(from)}` : ''}`}
            >
              Crear cuenta
            </Link>
            <Link className="text-white/70 hover:text-white hover:underline" href="/">
              Volver a la landing
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
