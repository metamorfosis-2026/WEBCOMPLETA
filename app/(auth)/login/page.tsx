import Link from 'next/link';

import LoginClient from './ui/LoginClient';

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { from?: string };
}) {
  const from = searchParams?.from;

  return (
    <main className="min-h-screen text-white">
      <div className="mx-auto w-full max-w-md px-5 py-14">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-7 backdrop-blur">
          <h1 className="text-2xl font-semibold tracking-tight">Ingresar</h1>
          <p className="mt-2 text-sm text-white/70">
            Acceso a tu panel personal. Primero claridad, después decisiones.
          </p>

          <div className="mt-6">
            <LoginClient from={from} />
          </div>

          <div className="mt-6 flex items-center justify-between text-sm">
            <Link className="text-white/70 hover:text-white hover:underline" href={`/register${from ? `?from=${encodeURIComponent(from)}` : ''}`}>
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
