import Link from 'next/link';

import RegisterClient from './ui/RegisterClient';

function resolveAuthErrorMessage(error?: string) {
  switch (error) {
    case 'oauth':
      return 'No pudimos completar el registro con Google.';
    case 'config':
      return 'Falta terminar la configuracion de Supabase en este entorno.';
    default:
      return null;
  }
}

export default function RegisterPage({
  searchParams,
}: {
  searchParams?: { from?: string; ref?: string; error?: string };
}) {
  const from = searchParams?.from;
  const ref = searchParams?.ref;
  const error = resolveAuthErrorMessage(searchParams?.error);

  return (
    <main className="min-h-screen text-white">
      <div className="mx-auto w-full max-w-md px-5 py-14">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-7 backdrop-blur">
          <h1 className="text-2xl font-semibold tracking-tight">Crear cuenta</h1>
          <p className="mt-2 text-sm text-white/70">
            Registro simple con Google para acceder a tu panel.
          </p>

          <div className="mt-6">
            <RegisterClient from={from} refCode={ref} initialError={error} />
          </div>

          <div className="mt-6 flex items-center justify-between text-sm">
            <Link
              className="text-white/70 hover:text-white hover:underline"
              href={`/login${from ? `?from=${encodeURIComponent(from)}` : ''}`}
            >
              Ya tengo cuenta
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
