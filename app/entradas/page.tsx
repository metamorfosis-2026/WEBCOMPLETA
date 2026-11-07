import type { Metadata } from 'next';

import { TicketCheckout } from '@/app/components/TicketCheckout';
import { EVENT_HOURS_LABEL, EVENT_PLACE, FLYER_PATH, TICKET_CAPACITY } from '@/app/lib/entradas';
import { INSTAGRAM_DM_URL } from '@/app/lib/inscripcion';
import { getSiteUrl } from '@/app/lib/site';
import { countSoldTickets } from '@/app/lib/supabase/tickets';

import { EntradasShell } from './EntradasShell';
import { CalendarIcon, CheckIcon, ClockIcon, PinIcon, UsersIcon } from './icons';

export const dynamic = 'force-dynamic';

const TITLE = 'Entradas · Metamorfosis 7ma Edición';
const DESCRIPTION =
  'Taller vivencial de inteligencia emocional. Sábado 28 y domingo 29 de noviembre, de 11 a 17 hs, en Zona Oeste. Pagás con Mercado Pago y tu entrada con QR llega por WhatsApp.';

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: '/entradas',
    type: 'website',
    locale: 'es_AR',
    images: [{ url: FLYER_PATH, width: 1080, height: 1080, alt: 'Metamorfosis 7ma edición: 28 y 29 de noviembre, Zona Oeste, de 11 a 17 hs' }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [FLYER_PATH] },
};

// `short`: version corta para la columna angosta del celular.
const FACTS: { icon: typeof CalendarIcon; text: string; short?: string }[] = [
  { icon: CalendarIcon, text: 'Sábado y domingo', short: 'Sáb y dom' },
  { icon: ClockIcon, text: `De ${EVENT_HOURS_LABEL}` },
  { icon: PinIcon, text: EVENT_PLACE },
  { icon: UsersIcon, text: `Hasta ${TICKET_CAPACITY} personas` },
];

const TAKEAWAYS = [
  'Entender de dónde viene lo que sentís y por qué se repite.',
  'Mirar tus vínculos y tus patrones con otra claridad.',
  'Herramientas concretas para usar en tu día a día.',
];

export default async function EntradasPage() {
  let sold: number | null = null;
  try {
    sold = await countSoldTickets();
  } catch (error) {
    // Sin base (o sin la tabla todavia) mostramos el formulario igual.
    console.error('[entradas] no se pudo contar las vendidas:', error);
  }

  const remaining = sold === null ? null : Math.max(0, TICKET_CAPACITY - sold);

  return (
    <EntradasShell wide>
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:items-start lg:gap-16 xl:gap-24">
        {/* ------------------------------------------------------- evento */}
        <section aria-labelledby="titulo-taller" className="lg:pt-4">
          <p className="text-[15px] font-medium text-celeste">Metamorfosis · 7ma edición</p>
          <h1
            id="titulo-taller"
            className="display mt-3 max-w-[14ch] text-[2.4rem] leading-[1.05] text-white [text-wrap:balance] sm:text-[3.1rem] lg:text-[3.6rem]"
          >
            Taller vivencial de inteligencia emocional
          </h1>
          <p className="mt-5 max-w-[34rem] text-[17px] leading-relaxed text-ivory/75 [text-wrap:balance] sm:text-[19px]">
            Un fin de semana para frenar, entender lo que sentís y salir con herramientas que se usan.
          </p>

          {/* Fecha + datos en un solo panel: en celular la fecha arriba y los
              datos en 2 columnas; desde sm, fecha a la izquierda y datos al lado. */}
          <div className="mt-9 rounded-2xl border border-ivory/10 bg-white/[0.03] p-4 sm:inline-flex sm:items-center sm:gap-8 sm:p-6">
            <div className="flex items-center gap-4 sm:flex-col sm:items-start sm:gap-2">
              <p className="numeric text-[2.9rem] font-bold leading-none text-white sm:text-[3.4rem]">
                <span className="sr-only">28 y 29 de noviembre de 2026</span>
                <span aria-hidden="true">28–29</span>
              </p>
              <p aria-hidden="true" className="text-[13px] font-semibold leading-tight tracking-[0.18em] text-celeste">
                <span className="mr-2 sm:mr-0 sm:block">NOV</span>
                <span className="sm:block">2026</span>
              </p>
            </div>

            <div aria-hidden="true" className="my-5 h-px bg-ivory/10 sm:my-0 sm:h-24 sm:w-px" />

            <ul className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 sm:grid-cols-1 sm:gap-y-2.5">
              {FACTS.map(({ icon: Icon, text, short }) => (
                <li key={text} className="flex items-center gap-2 whitespace-nowrap text-[14px] text-ivory/85 sm:gap-2.5 sm:text-[15px]">
                  <Icon className="h-5 w-5 flex-none text-celeste" />
                  {short ? (
                    <>
                      <span className="sm:hidden">{short}</span>
                      <span className="hidden sm:inline">{text}</span>
                    </>
                  ) : (
                    text
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-10 border-t border-ivory/10 pt-8">
            <h2 className="text-[17px] font-semibold text-white">Qué te llevás</h2>
            <ul className="mt-4 grid gap-3.5">
              {TAKEAWAYS.map((item) => (
                <li key={item} className="flex gap-3 text-[16px] leading-relaxed text-ivory/80">
                  <CheckIcon className="mt-0.5 h-5 w-5 flex-none text-celeste" />
                  <span className="[text-wrap:balance]">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------------ checkout */}
        {/* self-stretch: la columna ocupa todo el alto de la fila, asi la card
            sticky tiene lugar para quedarse fija mientras se scrollea. */}
        <aside aria-label="Comprar entrada" className="border-t border-ivory/10 pt-10 lg:self-stretch lg:border-0 lg:pt-0">
          <div className="lg:sticky lg:top-8 lg:rounded-[28px] lg:border lg:border-ivory/10 lg:bg-[#0A1120]/90 lg:p-8 lg:shadow-[0_40px_120px_-60px_rgba(124,201,236,0.5)]">
            {remaining === 0 ? (
              <div>
                <h2 className="display-sm text-[1.6rem] leading-tight text-white">Se agotaron las entradas</h2>
                <p className="mt-3 text-[16px] leading-relaxed text-ivory/75">
                  Se completaron los {TICKET_CAPACITY} lugares de esta edición. Escribinos por Instagram y te sumamos a la
                  lista de espera: si se libera un lugar, te avisamos primero.
                </p>
                <a
                  href={INSTAGRAM_DM_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-7 flex h-14 w-full items-center justify-center rounded-2xl bg-celeste px-6 text-[16px] font-semibold text-night transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Escribir por Instagram
                </a>
              </div>
            ) : (
              <TicketCheckout source="pagina-entradas" variant="page" remaining={remaining} />
            )}
          </div>
        </aside>
      </div>
    </EntradasShell>
  );
}
