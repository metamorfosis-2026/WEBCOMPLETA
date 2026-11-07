import Image from 'next/image';
import Link from 'next/link';

import { ArrowLeftIcon } from './icons';

/*
  Marco comun de /entradas y /entradas/CODIGO: mismo fondo oscuro que la home.
  `wide`: pagina de compra (dos columnas en escritorio). Sin `wide`: columna
  angosta, para la entrada con el QR.
*/
export function EntradasShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  const container = wide ? 'max-w-6xl px-5 sm:px-8' : 'max-w-xl px-4 sm:px-6';

  return (
    // overflow-x-clip (no hidden): recorta los halos sin romper la card sticky.
    <main className="grain relative min-h-screen overflow-x-clip bg-night text-ivory">
      <div aria-hidden="true" className="aura aura-celeste aura-breathe left-[-20%] top-[-8rem] h-[28rem] w-[28rem]" />
      <div aria-hidden="true" className="aura aura-deep right-[-25%] top-[24rem] h-[30rem] w-[30rem]" />

      <header className="relative z-10 border-b border-ivory/[0.07] bg-night/85 backdrop-blur-xl">
        <div className={`mx-auto flex w-full items-center py-4 ${container} ${wide ? 'justify-center lg:justify-between' : 'justify-center'}`}>
          <Link
            href="/"
            aria-label="Volver a Metamorfosis"
            className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celeste/70"
          >
            <Image
              src="/marca/logo-horizontal.png"
              alt="Metamorfosis"
              width={220}
              height={62}
              priority
              className="h-auto w-[170px] sm:w-[200px]"
            />
          </Link>
          {wide ? (
            <Link
              href="/"
              className="hidden items-center gap-2 rounded-lg px-2 py-1 text-[14px] text-ivory/70 transition hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celeste/70 lg:inline-flex"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Volver a la web
            </Link>
          ) : null}
        </div>
      </header>

      <div
        className={`relative z-10 mx-auto w-full ${container} ${
          wide ? 'pb-36 pt-8 sm:pt-12 lg:pb-24 lg:pt-16' : 'pb-16 pt-8 sm:pt-12'
        }`}
      >
        {children}
      </div>
    </main>
  );
}
