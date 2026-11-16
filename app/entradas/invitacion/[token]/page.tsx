import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { InvitationForm } from '@/app/components/InvitationForm';
import { EVENT_HOURS_LABEL, EVENT_PLACE, invitationSource } from '@/app/lib/entradas';
import { verifyInvitationToken } from '@/app/lib/invitaciones';
import { findTicketBySource } from '@/app/lib/supabase/tickets';

import { EntradasShell } from '../../EntradasShell';
import { CalendarIcon, CheckIcon, ClockIcon, PinIcon } from '../../icons';

/*
  Link de invitacion (se genera desde el admin, sirve para una entrada).
  Se ve como la pagina de compra, pero sin precios ni pago: la persona deja
  sus datos y recibe la entrada con QR. No se habla de "gratis".
*/
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Tu invitación · Metamorfosis 7ma Edición',
  description: 'Tenés una invitación a Metamorfosis 7ma Edición: sábado 28 y domingo 29 de noviembre.',
  robots: { index: false, follow: false },
};

const FACTS = [
  { icon: CalendarIcon, text: 'Sábado y domingo' },
  { icon: ClockIcon, text: `De ${EVENT_HOURS_LABEL}` },
  { icon: PinIcon, text: EVENT_PLACE },
];

const TAKEAWAYS = [
  'Entender de dónde viene lo que sentís y por qué se repite.',
  'Mirar tus vínculos y tus patrones con otra claridad.',
  'Herramientas concretas para usar en tu día a día.',
];

export default async function InvitationPage({ params }: { params: { token: string } }) {
  const token = decodeURIComponent(params.token);
  const invitationId = verifyInvitationToken(token);
  if (!invitationId) notFound();

  let used = false;
  try {
    used = Boolean(await findTicketBySource(invitationSource(invitationId)));
  } catch (error) {
    // Sin base mostramos el formulario igual: al enviarlo se vuelve a controlar.
    console.error('[invitacion] no se pudo consultar el link:', error);
  }

  return (
    <EntradasShell wide>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:gap-x-16 xl:gap-x-24">
        <section aria-labelledby="titulo-invitacion" className="text-center lg:pt-4 lg:text-left">
          <p className="text-[15px] font-medium text-celeste">Metamorfosis · 7ma edición</p>
          <h1
            id="titulo-invitacion"
            className="display mx-auto mt-3 max-w-[14ch] text-[2.1rem] leading-[1.05] text-white [text-wrap:balance] min-[380px]:text-[2.4rem] sm:text-[3.1rem] lg:mx-0 lg:text-[3.6rem]"
          >
            Tenés una invitación
          </h1>
          <p className="mx-auto mt-4 max-w-[34rem] text-[17px] leading-relaxed text-ivory/75 [text-wrap:balance] sm:text-[19px] lg:mx-0 lg:mt-5">
            Queremos que seas parte de nuestro taller vivencial de inteligencia emocional: un fin de semana para frenar,
            entender lo que sentís y salir con herramientas que se usan.
          </p>

          <div className="mt-6 rounded-2xl border border-ivory/10 bg-white/[0.03] px-4 py-5 lg:mt-9 lg:inline-flex lg:items-center lg:gap-8 lg:p-6">
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

            <div aria-hidden="true" className="my-4 h-px bg-ivory/10 lg:my-0 lg:h-20 lg:w-px" />

            <ul className="flex flex-wrap justify-center gap-x-5 gap-y-3 lg:grid lg:gap-y-2.5">
              {FACTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2 whitespace-nowrap text-[14px] text-ivory/85 lg:gap-2.5 lg:text-[15px]">
                  <Icon className="h-5 w-5 flex-none text-celeste" />
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 hidden border-t border-ivory/10 pt-8 lg:block">
            <h2 className="text-[17px] font-semibold text-white">Qué te llevás</h2>
            <ul className="mt-4 space-y-3.5">
              {TAKEAWAYS.map((text) => (
                <li key={text} className="flex items-start gap-3 text-[16px] leading-relaxed text-ivory/80">
                  <CheckIcon className="mt-0.5 h-5 w-5 flex-none text-celeste" />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <aside aria-label="Confirmar invitación">
          <div className="lg:sticky lg:top-8 lg:rounded-[28px] lg:border lg:border-ivory/10 lg:bg-[#0A1120]/90 lg:p-8 lg:shadow-[0_40px_120px_-60px_rgba(124,201,236,0.5)]">
            {used ? (
              <div className="text-center lg:text-left">
                <h2 className="display-sm text-[1.6rem] leading-tight text-white">Esta invitación ya fue usada</h2>
                <p className="mt-3 text-[16px] leading-relaxed text-ivory/75 [text-wrap:balance]">
                  Si la confirmaste vos, tu entrada con QR está en el WhatsApp que dejaste. Si no la encontrás, escribinos y te
                  la reenviamos.
                </p>
              </div>
            ) : (
              <InvitationForm token={token} />
            )}
          </div>
        </aside>
      </div>
    </EntradasShell>
  );
}
