import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';

import { auth } from '@/auth';
import { FormSubmitButton } from '@/app/admin/FormSubmitButton';
import { checkInTicketAction, undoCheckInAction } from '@/app/admin/entradas-actions';
import {
  BALANCE_DEADLINE_LABEL,
  DUO_TOTAL_CENTS,
  EVENT_DATE_LABEL,
  EVENT_HOURS_LABEL,
  EVENT_PLACE,
  TICKET_PLANS,
  argentinaDay,
  businessWhatsAppUrl,
  formatPesos,
  nextInstallment,
  ticketPaths,
  ticketStatusLabel,
} from '@/app/lib/entradas';
import { processMercadoPagoPayment } from '@/app/lib/entradas-flow';
import { parseExternalReference } from '@/app/lib/mercadopago';
import { isAdminRole } from '@/app/lib/metamorfosis';
import { prettyPhone } from '@/app/lib/phone';
import { getSiteUrl } from '@/app/lib/site';
import { getTicketByCode, listTicketCheckins, type Ticket, type TicketCheckin } from '@/app/lib/supabase/tickets';

import { EntradasShell } from '../EntradasShell';
import { AutoRefresh } from './AutoRefresh';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Tu entrada · Metamorfosis 7ma Edición',
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;

function param(searchParams: SearchParams, key: string) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

const timeFormatter = new Intl.DateTimeFormat('es-AR', {
  weekday: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Argentina/Buenos_Aires',
});

function requestOrigin() {
  const list = headers();
  const host = list.get('x-forwarded-host') ?? list.get('host');
  if (!host) return null;
  const proto = list.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export default async function TicketPage({
  params,
  searchParams = {},
}: {
  params: { code: string };
  searchParams?: SearchParams;
}) {
  const code = decodeURIComponent(params.code).toUpperCase();
  const siteUrl = getSiteUrl(requestOrigin());
  const pago = param(searchParams, 'pago');
  const notice = param(searchParams, 'notice');

  // Volvio de Mercado Pago: procesamos el pago ya, por si el webhook se demora.
  const paymentId = param(searchParams, 'payment_id') || param(searchParams, 'collection_id');
  if (/^\d+$/.test(paymentId)) {
    const reference = parseExternalReference(param(searchParams, 'external_reference'));
    if (!reference || reference.code === code) {
      try {
        await processMercadoPagoPayment(paymentId, siteUrl);
      } catch (error) {
        console.error('[entradas] no se pudo procesar el pago al volver de MP:', error);
      }
    }
  }

  let ticket: Ticket | null = null;
  try {
    ticket = await getTicketByCode(code);
  } catch (error) {
    console.error('[entradas] no se pudo leer la entrada', code, error);
    return (
      <EntradasShell>
        <div className="surface p-7 text-center">
          <p className="display text-[1.6rem]">No pudimos cargar tu entrada</p>
          <p className="mt-3 text-[15px] text-ivory/60">Probá de nuevo en unos minutos.</p>
        </div>
      </EntradasShell>
    );
  }
  if (!ticket) notFound();

  const session = await auth().catch(() => null);
  const isAdmin = isAdminRole(session?.user?.role);
  const checkins = isAdmin ? await listTicketCheckins(ticket.id).catch((): TicketCheckin[] => []) : [];

  const hasAccess = ticket.status === 'PAGADO' || ticket.status === 'SENADO';
  const due = nextInstallment(ticket);
  const paths = ticketPaths(ticket.code);
  const qrSvg = hasAccess
    ? await QRCode.toString(`${siteUrl}${paths.ticket}`, {
        type: 'svg',
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#04070E', light: '#FFFFFF' },
      })
    : null;
  const whatsappUrl = businessWhatsAppUrl(`Hola! Quiero recibir mi entrada ${ticket.code}`);
  const waitingConfirmation = pago === 'ok' && ticket.status === 'PENDIENTE';

  return (
    <EntradasShell>
      {waitingConfirmation ? <AutoRefresh /> : null}

      {isAdmin ? <DoorPanel ticket={ticket} checkins={checkins} notice={notice} /> : null}

      <PaymentBanner pago={pago} status={ticket.status} />

      <article className="surface surface-accent p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-celeste">Entrada · Fase 1 · 7ma edición</p>
          <span className={`chip ${ticket.status === 'PAGADO' ? 'chip-celeste' : ticket.status === 'SENADO' ? 'chip-sand' : ''}`}>
            {ticketStatusLabel(ticket.status)}
          </span>
        </div>

        <h1 className="display mt-5 text-[2.1rem] leading-tight sm:text-[2.5rem]">{ticket.fullName}</h1>

        {qrSvg ? (
          <div
            className="mx-auto mt-8 w-full max-w-[300px] rounded-[22px] bg-white p-4 shadow-[0_30px_70px_-30px_rgba(124,201,236,0.7)] [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
            // SVG generado por nosotros (qrcode) a partir de la URL de la entrada.
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        ) : (
          <div className="mx-auto mt-8 flex aspect-square w-full max-w-[300px] items-center justify-center rounded-[22px] border border-dashed border-ivory/20 p-8 text-center text-[15px] leading-relaxed text-ivory/45">
            {ticket.status === 'CANCELADO'
              ? 'Esta entrada fue cancelada.'
              : 'Tu QR aparece acá apenas se acredite el pago.'}
          </div>
        )}

        <p className="numeric mt-6 text-center text-[1.6rem] tracking-[0.18em] text-white">{ticket.code}</p>

        <dl className="mt-8 grid gap-x-6 gap-y-5 border-t border-ivory/10 pt-7 sm:grid-cols-2">
          <Detail term="Fecha" value={EVENT_DATE_LABEL} />
          <Detail term="Horario" value={`${EVENT_HOURS_LABEL} (los dos días)`} />
          <Detail term="Lugar" value={EVENT_PLACE} />
          <Detail
            term={TICKET_PLANS[ticket.plan].label}
            value={`Pagado ${formatPesos(ticket.paidCents)} de ${formatPesos(ticket.totalCents)}`}
          />
        </dl>

        <div className="mt-8 grid gap-3">
          {due && ticket.status !== 'CANCELADO' ? (
            <>
              <a
                href={paths.pay}
                className="inline-flex min-h-[3.5rem] items-center justify-center rounded-full bg-celeste px-6 text-center text-[13px] font-extrabold uppercase tracking-[0.1em] text-night shadow-[0_18px_44px_-18px_rgba(124,201,236,0.75)] transition hover:bg-white"
              >
                {ticket.status === 'SENADO'
                  ? `Pagar el saldo · ${formatPesos(due.amountCents)}`
                  : ticket.plan === 'DUO'
                    ? `Completar el pago · ${formatPesos(DUO_TOTAL_CENTS)} (las 2 entradas)`
                    : `Completar el pago · ${formatPesos(due.amountCents)}`}
              </a>
              {ticket.status === 'SENADO' ? (
                <p className="text-center text-[13px] text-ivory/45">
                  Pagalo {BALANCE_DEADLINE_LABEL} para entrar directo.
                </p>
              ) : null}
            </>
          ) : null}

          {hasAccess ? (
            <a
              href={paths.image}
              download={`entrada-${ticket.code}.png`}
              className="inline-flex min-h-[3.25rem] items-center justify-center rounded-full border border-ivory/20 px-6 text-[13px] font-bold uppercase tracking-[0.1em] text-ivory/80 transition hover:border-celeste/60 hover:text-ivory"
            >
              Descargar entrada
            </a>
          ) : null}

          {hasAccess && whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[3.25rem] items-center justify-center rounded-full border border-ivory/20 px-6 text-[13px] font-bold uppercase tracking-[0.1em] text-ivory/80 transition hover:border-celeste/60 hover:text-ivory"
            >
              Recibir por WhatsApp
            </a>
          ) : null}
        </div>
      </article>

      <p className="mt-6 text-center text-[13px] leading-relaxed text-ivory/40">
        La entrada es personal. Mostrá este QR en la puerta los dos días.
        <br />
        ¿Dudas? Respondé el WhatsApp de tu entrada o{' '}
        <Link href="/" className="underline hover:text-ivory/70">
          volvé a la web
        </Link>
        .
      </p>
    </EntradasShell>
  );
}

function Detail({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-[0.18em] text-ivory/40">{term}</dt>
      <dd className="mt-1.5 text-[15px] text-ivory/85">{value}</dd>
    </div>
  );
}

function PaymentBanner({ pago, status }: { pago: string; status: Ticket['status'] }) {
  let tone = 'border-celeste/30 bg-celeste/[0.08] text-ivory/85';
  let text: string | null = null;

  if (pago === 'ok') {
    text =
      status === 'PENDIENTE'
        ? 'Estamos confirmando tu pago con Mercado Pago… esto tarda unos segundos.'
        : '¡Listo! Tu pago se acreditó. También te mandamos la entrada por WhatsApp.';
  } else if (pago === 'pendiente') {
    text =
      status === 'PENDIENTE'
        ? 'Tu pago quedó pendiente de acreditación (por ejemplo, si elegiste pagar en efectivo). Apenas se acredite te llega la entrada por WhatsApp.'
        : null;
  } else if (pago === 'error') {
    tone = 'border-sand/30 bg-sand/[0.08] text-sand';
    text = 'El pago no se completó. Podés intentarlo de nuevo con el botón de abajo.';
  } else if (pago === 'no-disponible') {
    tone = 'border-sand/30 bg-sand/[0.08] text-sand';
    text = 'El pago online no está disponible en este momento. Escribinos y te ayudamos.';
  }

  if (!text) return null;
  return <p className={`mb-6 rounded-2xl border p-4 text-[15px] leading-relaxed ${tone}`}>{text}</p>;
}

/* ------------------------------------------------------------- modo puerta */

function DoorPanel({ ticket, checkins, notice }: { ticket: Ticket; checkins: TicketCheckin[]; notice: string }) {
  const today = argentinaDay(new Date());
  const todayCheckin = checkins.find((checkin) => argentinaDay(new Date(checkin.createdAt)) === today) ?? null;
  const due = ticket.totalCents - ticket.paidCents;
  const returnTo = ticketPaths(ticket.code).ticket;

  let tone = 'border-emerald-400/50 bg-emerald-400/[0.12]';
  let title = 'Puede pasar';
  if (ticket.status === 'CANCELADO') {
    tone = 'border-red-400/50 bg-red-500/[0.12]';
    title = 'Entrada cancelada';
  } else if (ticket.status === 'PENDIENTE') {
    tone = 'border-red-400/50 bg-red-500/[0.12]';
    title = 'Sin pago acreditado';
  } else if (todayCheckin) {
    tone = 'border-amber-400/50 bg-amber-400/[0.12]';
    title = `Ya ingresó hoy · ${timeFormatter.format(new Date(todayCheckin.createdAt))}`;
  } else if (ticket.status === 'SENADO') {
    tone = 'border-amber-400/50 bg-amber-400/[0.12]';
    title = `Debe el saldo · ${formatPesos(due)}`;
  }

  const buttonClass =
    'inline-flex min-h-[3.25rem] w-full items-center justify-center rounded-2xl px-5 text-center text-[14px] font-bold transition';

  return (
    <section className={`mb-6 rounded-[22px] border p-5 sm:p-6 ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">Modo puerta (admin)</p>
        <Link href="/admin?tab=entradas" className="text-[12px] text-white/60 underline">
          Ver todas
        </Link>
      </div>

      <p className="display-sm mt-3 text-[1.7rem] text-white">{title}</p>
      <p className="mt-1 text-[14px] text-white/70">
        {ticket.fullName} · {prettyPhone(ticket.phone)}
      </p>

      {notice ? <p className="mt-4 rounded-xl bg-black/30 p-3 text-[14px] text-white/90">{notice}</p> : null}

      <div className="mt-5 grid gap-2.5">
        {ticket.status === 'PAGADO' && !todayCheckin ? (
          <form action={checkInTicketAction}>
            <input type="hidden" name="ticketId" value={ticket.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <FormSubmitButton className={`${buttonClass} bg-emerald-400 text-black hover:bg-emerald-300`} pendingLabel="Registrando…">
              Registrar ingreso
            </FormSubmitButton>
          </form>
        ) : null}

        {ticket.status === 'SENADO' && !todayCheckin ? (
          <>
            {(['EFECTIVO', 'TRANSFERENCIA'] as const).map((method) => (
              <form key={method} action={checkInTicketAction}>
                <input type="hidden" name="ticketId" value={ticket.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <input type="hidden" name="collect" value={method} />
                <FormSubmitButton className={`${buttonClass} bg-amber-300 text-black hover:bg-amber-200`} pendingLabel="Registrando…">
                  {`Cobré ${formatPesos(due)} en ${method === 'EFECTIVO' ? 'efectivo' : 'transferencia'} · registrar ingreso`}
                </FormSubmitButton>
              </form>
            ))}
            <form action={checkInTicketAction}>
              <input type="hidden" name="ticketId" value={ticket.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <FormSubmitButton
                className={`${buttonClass} border border-white/25 text-white/85 hover:bg-white/10`}
                pendingLabel="Registrando…"
                confirmMessage="¿Dejarla pasar sin cobrar el saldo? El saldo queda pendiente."
              >
                Dejar pasar sin cobrar
              </FormSubmitButton>
            </form>
          </>
        ) : null}

        {todayCheckin ? (
          <form action={undoCheckInAction}>
            <input type="hidden" name="checkinId" value={todayCheckin.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <FormSubmitButton
              className={`${buttonClass} border border-white/25 text-white/85 hover:bg-white/10`}
              pendingLabel="Borrando…"
              confirmMessage="¿Borrar el ingreso de hoy?"
            >
              Deshacer ingreso de hoy
            </FormSubmitButton>
          </form>
        ) : null}
      </div>

      {checkins.length ? (
        <p className="mt-4 text-[12px] text-white/55">
          Ingresos: {checkins.map((checkin) => timeFormatter.format(new Date(checkin.createdAt))).join(' · ')}
        </p>
      ) : null}
    </section>
  );
}
