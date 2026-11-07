import type { Metadata } from 'next';

import { TicketCheckout } from '@/app/components/TicketCheckout';
import {
  EVENT_HOURS_LABEL,
  EVENT_PLACE,
  FLYER_PATH,
  SHOW_REMAINING_AT,
  TICKET_CAPACITY,
  businessWhatsAppUrl,
} from '@/app/lib/entradas';
import { INSTAGRAM_DM_URL } from '@/app/lib/inscripcion';
import { getSiteUrl } from '@/app/lib/site';
import { countSoldTicketsCached } from '@/app/lib/supabase/tickets';

import { EntradasFaq } from './EntradasFaq';
import { EntradasShell } from './EntradasShell';
import { CalendarIcon, ChatIcon, CheckIcon, ClockIcon, PinIcon, UsersIcon } from './icons';

// Pagina estatica que se renueva cada 60 s: carga rapido y los lugares que
// quedan salen de la base, con un minuto de demora como mucho. La venta igual
// controla el cupo al momento de pagar.
export const revalidate = 60;

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

// `short` entra en una linea a 360 px; en escritorio va la version larga.
const TAKEAWAYS = [
  { text: 'Entender de dónde viene lo que sentís y por qué se repite.', short: 'Entender de dónde viene lo que sentís' },
  { text: 'Mirar tus vínculos y tus patrones con otra claridad.', short: 'Mirar tus vínculos con otra claridad' },
  { text: 'Herramientas concretas para usar en tu día a día.', short: 'Herramientas para tu día a día' },
];

const WHATSAPP_QUESTION_URL = businessWhatsAppUrl('Hola, quiero consultar por el taller de noviembre');

export default async function EntradasPage() {
  let sold: number | null = null;
  try {
    sold = await countSoldTicketsCached();
  } catch (error) {
    // Sin base no mostramos lugares (nada de numeros inventados), pero el
    // formulario sigue: el cupo se controla de nuevo al pagar.
    console.error('[entradas] no se pudo contar las vendidas:', error);
  }

  const remaining = sold === null ? null : Math.max(0, TICKET_CAPACITY - sold);
  const soldOut = remaining === 0;
  const seatsLabel =
    remaining === null || remaining > SHOW_REMAINING_AT
      ? null
      : soldOut
        ? 'Agotado'
        : remaining === 1
          ? 'Queda 1 lugar'
          : `Quedan ${remaining} lugares`;

  /*
    Ritmo vertical en celular: 40 px entre secciones (gap del grid), 24 px entre
    bloques de una seccion y 12 px entre las dos cards del evento, que van de a par.
    Escritorio: dos columnas; a la izquierda el evento y las preguntas, a la
    derecha la card de compra (sticky) con el boton de dudas abajo.
  */
  return (
    <EntradasShell wide>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:gap-x-16 lg:gap-y-12 xl:gap-x-24">
        {/* ------------------------------------------------------- evento */}
        <section aria-labelledby="titulo-taller" className="text-center lg:col-start-1 lg:row-start-1 lg:pt-4 lg:text-left">
          <p className="text-[15px] font-medium text-celeste">Metamorfosis · 7ma edición</p>
          <h1
            id="titulo-taller"
            className="display mx-auto mt-3 max-w-[14ch] text-[2.1rem] leading-[1.05] text-white [text-wrap:balance] min-[380px]:text-[2.4rem] sm:text-[3.1rem] lg:mx-0 lg:text-[3.6rem]"
          >
            Taller vivencial de inteligencia emocional
          </h1>
          <p className="mx-auto mt-4 max-w-[34rem] text-[17px] leading-relaxed text-ivory/75 [text-wrap:balance] sm:text-[19px] lg:mx-0 lg:mt-5">
            Un fin de semana para frenar, entender lo que sentís y salir con herramientas que se usan.
          </p>

          {/* Fecha + datos: en celular la fecha arriba y los datos en 2x2; en
              escritorio, fecha a la izquierda y datos al lado. */}
          <div className="mt-6 rounded-2xl border border-ivory/10 bg-white/[0.03] px-4 py-5 lg:mt-9 lg:inline-flex lg:items-center lg:gap-8 lg:p-6">
            <div className="flex flex-col items-center lg:items-start">
              <div className="flex items-center justify-center gap-4 lg:flex-col lg:items-start lg:gap-2">
                <p className="numeric text-[2.9rem] font-bold leading-none text-white lg:text-[3.4rem]">
                  <span className="sr-only">28 y 29 de noviembre de 2026</span>
                  <span aria-hidden="true">28–29</span>
                </p>
                <p aria-hidden="true" className="text-[13px] font-semibold leading-tight tracking-[0.18em] text-celeste">
                  <span className="mr-2 lg:mr-0 lg:block">NOV</span>
                  <span className="lg:block">2026</span>
                </p>
              </div>
              {seatsLabel ? (
                <p
                  className={`mt-3 inline-flex rounded-full border px-3 py-1 text-[13px] font-semibold ${
                    soldOut ? 'border-sand/60 bg-sand/15 text-sand' : 'border-sand/40 bg-sand/10 text-sand'
                  }`}
                >
                  {seatsLabel}
                </p>
              ) : null}
            </div>

            <div aria-hidden="true" className="my-4 h-px bg-ivory/10 lg:my-0 lg:h-24 lg:w-px" />

            <ul className="grid grid-cols-2 gap-x-3 gap-y-4 lg:grid-cols-1 lg:gap-y-2.5">
              {FACTS.map(({ icon: Icon, text, short }) => (
                <li
                  key={text}
                  className="flex flex-col items-center gap-1.5 whitespace-nowrap text-[14px] text-ivory/85 lg:flex-row lg:gap-2.5 lg:text-[15px]"
                >
                  <Icon className="h-5 w-5 flex-none text-celeste" />
                  {short ? (
                    <>
                      <span className="lg:hidden">{short}</span>
                      <span className="hidden lg:inline">{text}</span>
                    </>
                  ) : (
                    text
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Que te llevas: en celular, card gemela del box de la fecha con 3 filas
              compactas (check a la izquierda, el conjunto centrado). En escritorio,
              la lista de siempre debajo de una linea. */}
          <div className="mt-3 rounded-2xl border border-ivory/10 bg-white/[0.03] px-4 pb-1.5 pt-4 lg:mt-10 lg:rounded-none lg:border-x-0 lg:border-b-0 lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-8">
            <h2 className="text-[17px] font-semibold text-white">Qué te llevás</h2>
            <ul className="mx-auto mt-1 w-fit max-w-full divide-y divide-ivory/10 text-left lg:mx-0 lg:mt-4 lg:w-auto lg:space-y-3.5 lg:divide-y-0">
              {TAKEAWAYS.map(({ text, short }) => (
                <li
                  key={text}
                  className="flex min-h-[46px] items-center gap-2.5 whitespace-nowrap text-[14px] text-ivory/85 min-[380px]:text-[15px] lg:min-h-0 lg:whitespace-normal lg:items-start lg:gap-3 lg:text-[16px] lg:leading-relaxed lg:text-ivory/80"
                >
                  <CheckIcon className="h-5 w-5 flex-none text-celeste lg:mt-0.5" />
                  <span className="lg:hidden">{short}</span>
                  <span className="hidden lg:inline">{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------------ checkout */}
        {/* En escritorio ocupa las dos filas, asi la card sticky acompana el scroll
            mientras se leen el evento y las preguntas. */}
        <aside aria-label="Comprar entrada" className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="lg:sticky lg:top-8">
            <div className="lg:rounded-[28px] lg:border lg:border-ivory/10 lg:bg-[#0A1120]/90 lg:p-8 lg:shadow-[0_40px_120px_-60px_rgba(124,201,236,0.5)]">
              {soldOut ? (
                <div className="text-center lg:text-left">
                  <h2 className="display-sm text-[1.6rem] leading-tight text-white">Se agotaron las entradas</h2>
                  <p className="mt-3 text-[16px] leading-relaxed text-ivory/75 [text-wrap:balance]">
                    Se completaron los {TICKET_CAPACITY} lugares de esta edición, así que la compra está cerrada. Escribinos por
                    Instagram y te sumamos a la lista de espera: si se libera un lugar, te avisamos primero.
                  </p>
                  <button
                    type="button"
                    disabled
                    className="mt-6 flex h-14 w-full cursor-not-allowed items-center justify-center rounded-2xl bg-white/[0.06] px-6 text-[16px] font-semibold text-ivory/60"
                  >
                    Agotado
                  </button>
                  <a
                    href={INSTAGRAM_DM_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 flex h-14 w-full items-center justify-center rounded-2xl bg-celeste px-6 text-[16px] font-semibold text-night transition [@media(hover:hover)]:hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    Sumarme a la lista de espera
                  </a>
                </div>
              ) : (
                <TicketCheckout source="pagina-entradas" variant="page" />
              )}
            </div>

            {WHATSAPP_QUESTION_URL ? (
              <a
                href={WHATSAPP_QUESTION_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 flex w-full flex-col items-center justify-center rounded-2xl border border-ivory/20 px-4 py-3 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celeste/70 lg:mt-4 lg:min-h-12 lg:flex-row lg:gap-2 [@media(hover:hover)]:hover:border-celeste/60"
              >
                {/* Celular: dos lineas centradas (en una no entra a 360 px). Escritorio: una. */}
                <ChatIcon className="hidden h-5 w-5 flex-none text-celeste lg:block" />
                <span className="text-[13px] text-ivory/70 lg:text-[15px] lg:font-semibold">¿Tenés dudas?</span>
                <span className="mt-0.5 flex items-center gap-2 text-[15px] font-semibold text-ivory/90 lg:mt-0">
                  <ChatIcon className="h-5 w-5 flex-none text-celeste lg:hidden" />
                  Escribinos por WhatsApp
                </span>
              </a>
            ) : null}
          </div>
        </aside>

        {/* ---------------------------------------------------- preguntas */}
        <EntradasFaq className="lg:col-start-1 lg:row-start-2 lg:self-start" />
      </div>
    </EntradasShell>
  );
}
