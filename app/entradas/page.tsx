import type { Metadata } from 'next';

import { TicketCheckout } from '@/app/components/TicketCheckout';
import { TICKET_CAPACITY } from '@/app/lib/entradas';
import { INSTAGRAM_DM_URL } from '@/app/lib/inscripcion';
import { countSoldTickets } from '@/app/lib/supabase/tickets';

import { EntradasShell } from './EntradasShell';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Entradas · Metamorfosis 7ma Edición',
  description:
    'Comprá tu entrada a la Fase 1 de Metamorfosis: sábado 28 y domingo 29 de noviembre en Zona Oeste. Pagás con Mercado Pago y te llega el QR por WhatsApp.',
};

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
    <EntradasShell>
      <div className="surface surface-accent p-6 sm:p-9">
        {remaining === 0 ? (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-celeste">Entradas · 7ma edición</p>
            <h1 className="display mt-4 text-[2rem] leading-tight">Se agotaron las entradas</h1>
            <p className="mt-4 text-[16px] leading-relaxed text-ivory/65">
              Se completaron los {TICKET_CAPACITY} lugares de esta edición. Escribinos por Instagram y te sumamos a la
              lista de espera: si se libera un lugar, te avisamos primero.
            </p>
            <a
              href={INSTAGRAM_DM_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-flex min-h-[3.25rem] w-full items-center justify-center rounded-full bg-celeste px-6 text-[13px] font-extrabold uppercase tracking-[0.12em] text-night"
            >
              Escribir por Instagram
            </a>
          </div>
        ) : (
          <TicketCheckout source="pagina-entradas" remaining={remaining} />
        )}
      </div>
    </EntradasShell>
  );
}
