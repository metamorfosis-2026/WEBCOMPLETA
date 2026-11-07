import Image from 'next/image';
import Link from 'next/link';

// Marco comun de /entradas y /entradas/CODIGO: mismo fondo que la landing.
export function EntradasShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grain relative min-h-screen bg-night text-ivory">
      <div aria-hidden="true" className="aura aura-celeste aura-breathe left-[-20%] top-[-8rem] h-[28rem] w-[28rem]" />
      <div aria-hidden="true" className="aura aura-deep right-[-25%] top-[24rem] h-[30rem] w-[30rem]" />

      <header className="relative z-10 border-b border-ivory/[0.07] bg-night/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-xl justify-center px-4 py-4">
          <Link href="/" aria-label="Volver a Metamorfosis">
            <Image
              src="/marca/logo-horizontal.png"
              alt="Metamorfosis"
              width={220}
              height={62}
              priority
              className="h-auto w-[180px] sm:w-[220px]"
            />
          </Link>
        </div>
      </header>

      <div className="relative z-10 mx-auto w-full max-w-xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">{children}</div>
    </main>
  );
}
