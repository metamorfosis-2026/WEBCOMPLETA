'use client';

import { useMemo, useState } from 'react';

import {
  TICKET_PLANS,
  argentinaDay,
  formatPesos,
  nextInstallment,
  ticketPaths,
  type TicketPlan,
  type TicketStatus,
} from '@/app/lib/entradas';
import { messageForTicket } from '@/app/lib/entradas-mensajes';
import { prettyPhone } from '@/app/lib/phone';

import {
  checkInTicketAction,
  createTicketAction,
  deleteTicketPaymentAction,
  recordTicketPaymentAction,
  resendTicketWhatsAppAction,
  toggleCancelTicketAction,
  undoCheckInAction,
  updateTicketAction,
} from './entradas-actions';
import { FormSubmitButton } from './FormSubmitButton';

export type BoardTicket = {
  id: string;
  code: string;
  fullName: string;
  phone: string;
  email: string | null;
  plan: TicketPlan;
  totalCents: number;
  paidCents: number;
  status: TicketStatus;
  source: string | null;
  notes: string | null;
  createdAt: string;
  payments: {
    id: string;
    amountCents: number;
    method: string;
    status: string;
    statusDetail: string | null;
    mpPaymentId: string | null;
    recordedBy: string | null;
    paidAt: string | null;
    createdAt: string;
  }[];
  checkins: { id: string; createdAt: string }[];
  lastMessage: { kind: string | null; ok: boolean; error: string | null; createdAt: string } | null;
};

export type IntegrationStatus = {
  mercadoPago: boolean;
  whatsapp: 'evolution' | 'cloud' | 'none';
  cloudTemplates: boolean;
  ai: boolean;
  cron: boolean;
  siteUrl: string;
};

type Filter = 'VENDIDAS' | TicketStatus | 'TODAS';

const STATUS_STYLE: Record<TicketStatus, { chip: string; dot: string; label: string }> = {
  PAGADO: { chip: 'border-emerald-300/50 bg-emerald-400/20 text-emerald-50', dot: 'bg-emerald-300', label: 'Pagada' },
  SENADO: { chip: 'border-amber-400/40 bg-amber-400/10 text-amber-100', dot: 'bg-amber-400', label: 'Con saldo' },
  PENDIENTE: { chip: 'border-sky-400/30 bg-sky-400/10 text-sky-100', dot: 'bg-sky-400', label: 'Sin pagar' },
  CANCELADO: { chip: 'border-white/10 bg-white/5 text-white/45', dot: 'bg-white/30', label: 'Cancelada' },
};

const MESSAGE_LABEL: Record<string, string> = {
  CONFIRMACION: 'entrada',
  SENA: 'seña',
  SALDO: 'recordatorio de saldo',
  VISPERA: 'víspera',
  PENDIENTE: 'pago pendiente',
  BOT: 'respuesta automática',
  IA: 'respuesta de la IA',
  FALLO: 'entrega',
};

const dateTimeFormatter = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Argentina/Buenos_Aires',
});

const fieldClass =
  'h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none placeholder:text-white/25 focus:border-emerald-400/40';
const primaryButton =
  'inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-black transition hover:bg-white/85';
const ghostButton =
  'inline-flex h-9 items-center justify-center rounded-lg border border-white/15 bg-white/5 px-4 text-xs font-semibold text-white/80 transition hover:bg-white/10';

export function TicketsBoard({
  tickets,
  capacity,
  integrations,
}: {
  tickets: BoardTicket[];
  capacity: number;
  integrations: IntegrationStatus;
}) {
  const [filter, setFilter] = useState<Filter>('VENDIDAS');
  const [query, setQuery] = useState('');
  const today = argentinaDay(new Date());

  const stats = useMemo(() => {
    let sold = 0;
    let paid = 0;
    let withBalance = 0;
    let pending = 0;
    let collected = 0;
    let owed = 0;
    let inToday = 0;
    for (const ticket of tickets) {
      if (ticket.status === 'CANCELADO') continue;
      if (ticket.status === 'PENDIENTE') {
        pending += 1;
        continue;
      }
      sold += 1;
      collected += ticket.paidCents;
      if (ticket.status === 'PAGADO') paid += 1;
      if (ticket.status === 'SENADO') {
        withBalance += 1;
        owed += ticket.totalCents - ticket.paidCents;
      }
      if (ticket.checkins.some((checkin) => argentinaDay(new Date(checkin.createdAt)) === today)) inToday += 1;
    }
    return { sold, paid, withBalance, pending, collected, owed, inToday };
  }, [tickets, today]);

  const counts = useMemo(() => {
    const acc: Record<string, number> = { TODAS: tickets.length, VENDIDAS: stats.sold };
    for (const ticket of tickets) acc[ticket.status] = (acc[ticket.status] ?? 0) + 1;
    return acc;
  }, [tickets, stats.sold]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets.filter((ticket) => {
      if (filter === 'VENDIDAS' && ticket.status !== 'PAGADO' && ticket.status !== 'SENADO') return false;
      if (filter !== 'VENDIDAS' && filter !== 'TODAS' && ticket.status !== filter) return false;
      if (!q) return true;
      return [ticket.fullName, ticket.phone, ticket.code, ticket.email ?? '', ticket.notes ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [tickets, filter, query]);

  const percent = Math.min(100, (stats.sold / capacity) * 100);

  return (
    <div className="grid gap-6">
      <IntegrationRow integrations={integrations} />

      {/* ----------------------------------------------------------- resumen */}
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-400/[0.08] via-white/[0.03] to-transparent p-6 sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <p className="text-5xl font-semibold tabular-nums leading-none text-white">{stats.sold}</p>
              <p className="text-base text-white/50">de {capacity} lugares vendidos</p>
            </div>
            <div className="mt-6 h-2.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all"
                style={{ width: `${Math.max(percent, stats.sold ? 2 : 0)}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-white/50">
              Recaudado {formatPesos(stats.collected)} · Falta cobrar {formatPesos(stats.owed)} en saldos
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[30rem]">
            <MiniStat label="Pagadas" value={stats.paid} tone="text-emerald-200" />
            <MiniStat label="Con saldo" value={stats.withBalance} tone="text-amber-200" />
            <MiniStat label="Sin pagar" value={stats.pending} tone="text-sky-200" />
            <MiniStat label="Entraron hoy" value={stats.inToday} tone="text-white" />
          </div>
        </div>
      </div>

      <CreateTicketForm />

      {/* ----------------------------------------------------------- filtros */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['VENDIDAS', 'Vendidas'],
              ['PAGADO', 'Pagadas'],
              ['SENADO', 'Con saldo'],
              ['PENDIENTE', 'Sin pagar'],
              ['CANCELADO', 'Canceladas'],
              ['TODAS', 'Todas'],
            ] as [Filter, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-xs font-semibold transition ${
                filter === id
                  ? 'border-emerald-400/50 bg-emerald-400/15 text-white'
                  : 'border-white/10 bg-white/[0.03] text-white/60 hover:border-white/25 hover:text-white/85'
              }`}
            >
              {label}
              <span className={`tabular-nums ${filter === id ? 'text-emerald-200' : 'text-white/35'}`}>{counts[id] ?? 0}</span>
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar nombre, teléfono o código…"
          className="h-10 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white/90 outline-none placeholder:text-white/30 focus:border-emerald-400/40 lg:w-72"
        />
      </div>

      {/* ------------------------------------------------------------- lista */}
      <div className="overflow-hidden rounded-2xl border border-white/10">
        <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)_minmax(0,1fr)_7.5rem_1.5rem] gap-4 border-b border-white/10 bg-white/[0.03] px-5 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-white/40 md:grid">
          <span>Persona</span>
          <span>WhatsApp</span>
          <span>Pagado</span>
          <span>Estado</span>
          <span />
        </div>

        {visible.length ? (
          visible.map((ticket) => (
            <TicketRow key={ticket.id} ticket={ticket} today={today} siteUrl={integrations.siteUrl} />
          ))
        ) : (
          <p className="px-5 py-10 text-center text-sm text-white/50">
            {tickets.length ? 'No hay entradas con este filtro.' : 'Todavía no se vendió ninguna entrada.'}
          </p>
        )}
      </div>
    </div>
  );
}

function IntegrationRow({ integrations }: { integrations: IntegrationStatus }) {
  const items: { label: string; ok: boolean; text: string }[] = [
    {
      label: 'Mercado Pago',
      ok: integrations.mercadoPago,
      text: integrations.mercadoPago ? 'Conectado' : 'Falta MP_ACCESS_TOKEN: la web no puede cobrar',
    },
    {
      label: 'WhatsApp',
      ok: integrations.whatsapp !== 'none',
      text:
        integrations.whatsapp === 'evolution'
          ? 'Automático (Evolution, número escaneado por QR)'
          : integrations.whatsapp === 'cloud'
            ? `Automático (Cloud API${integrations.cloudTemplates ? ', con plantillas' : ', sin plantillas: solo dentro de las 24 h'})`
            : 'Sin conectar: usá "Mandar a mano"',
    },
    {
      label: 'Respuestas automáticas',
      ok: integrations.whatsapp !== 'none',
      text:
        integrations.whatsapp === 'none'
          ? 'Se activan al conectar el WhatsApp'
          : integrations.ai
            ? 'Contesta la IA (Claude) a cualquier consulta'
            : 'Menú automático (sumá ANTHROPIC_API_KEY para la IA)',
    },
    {
      label: 'Recordatorios',
      ok: integrations.cron,
      text: integrations.cron ? 'Activos (todos los días 10:00)' : 'Falta CRON_SECRET en Vercel',
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${item.ok ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            {item.label}
          </p>
          <p className="mt-1 text-sm text-white/80">{item.text}</p>
        </div>
      ))}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function CreateTicketForm() {
  return (
    <details className="rounded-2xl border border-white/10 bg-white/[0.03]">
      <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-white/85 [&::-webkit-details-marker]:hidden">
        + Cargar una entrada a mano{' '}
        <span className="font-normal text-white/45">(pagó por transferencia o efectivo, fuera de la web)</span>
      </summary>
      <form action={createTicketAction} className="grid gap-3 px-5 pb-5 md:grid-cols-3">
        <input name="fullName" required placeholder="Nombre y apellido" className={fieldClass} />
        <input name="phone" required placeholder="WhatsApp (11 6445 0430)" className={fieldClass} />
        <input name="email" placeholder="Email (opcional)" className={fieldClass} />
        <select name="plan" defaultValue="FULL" className={fieldClass}>
          <option value="FULL">Pago único · {formatPesos(TICKET_PLANS.FULL.totalCents)}</option>
          <option value="SPLIT">En 2 pagos · {formatPesos(TICKET_PLANS.SPLIT.totalCents)}</option>
        </select>
        <input name="paid" inputMode="numeric" placeholder="Cuánto pagó (ej: 72000)" className={fieldClass} />
        <select name="method" defaultValue="TRANSFERENCIA" className={fieldClass}>
          <option value="TRANSFERENCIA">Transferencia</option>
          <option value="EFECTIVO">Efectivo</option>
        </select>
        <input name="notes" placeholder="Notas internas (opcional)" className={`${fieldClass} md:col-span-2`} />
        <FormSubmitButton className={primaryButton} pendingLabel="Creando…">
          Crear y mandar por WhatsApp
        </FormSubmitButton>
      </form>
    </details>
  );
}

function TicketRow({ ticket, today, siteUrl }: { ticket: BoardTicket; today: string; siteUrl: string }) {
  const style = STATUS_STYLE[ticket.status];
  const paths = ticketPaths(ticket.code);
  const due = nextInstallment(ticket);
  const todayCheckin = ticket.checkins.find((checkin) => argentinaDay(new Date(checkin.createdAt)) === today) ?? null;
  const hasAccess = ticket.status === 'PAGADO' || ticket.status === 'SENADO';

  // El mismo mensaje que manda el sistema, para mandarlo a mano desde el celu.
  const manual = messageForTicket(ticket, {
    ticket: `${siteUrl}${paths.ticket}`,
    pay: `${siteUrl}${paths.pay}`,
    image: `${siteUrl}${paths.image}`,
  });
  const manualUrl = manual ? `https://wa.me/${ticket.phone}?text=${encodeURIComponent(manual.message.text)}` : null;

  return (
    <details className="group border-b border-white/[0.06] last:border-b-0 open:bg-white/[0.03]">
      <summary className="grid cursor-pointer list-none grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-5 py-4 transition hover:bg-white/[0.03] md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)_minmax(0,1fr)_7.5rem_1.5rem] [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">
            {ticket.fullName}
            {todayCheckin ? <span className="ml-2 text-xs font-normal text-emerald-300">· adentro</span> : null}
          </p>
          <p className="truncate text-xs text-white/45">
            {ticket.code} · {TICKET_PLANS[ticket.plan].label}
            <span className="md:hidden"> · {prettyPhone(ticket.phone)}</span>
          </p>
        </div>
        <span className="hidden truncate text-sm tabular-nums text-white/75 md:block">{prettyPhone(ticket.phone)}</span>
        <span className="hidden text-sm tabular-nums text-white/70 md:block">
          {formatPesos(ticket.paidCents)} <span className="text-white/35">/ {formatPesos(ticket.totalCents)}</span>
        </span>
        <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${style.chip}`}>
          <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
          {style.label}
        </span>
        <span aria-hidden="true" className="hidden text-white/35 transition group-open:rotate-90 md:block">
          ›
        </span>
      </summary>

      <div className="grid gap-5 px-5 pb-6 pt-1">
        {/* acciones rapidas */}
        <div className="flex flex-wrap gap-2">
          <a href={paths.ticket} target="_blank" rel="noreferrer" className={ghostButton}>
            Ver entrada
          </a>
          {ticket.status !== 'CANCELADO' ? (
            <form action={resendTicketWhatsAppAction}>
              <input type="hidden" name="ticketId" value={ticket.id} />
              <FormSubmitButton
                className="inline-flex h-9 items-center justify-center rounded-lg bg-emerald-500 px-4 text-xs font-bold text-black transition hover:bg-emerald-400"
                pendingLabel="Enviando…"
              >
                {hasAccess ? 'Reenviar entrada por WhatsApp' : 'Mandar link de pago por WhatsApp'}
              </FormSubmitButton>
            </form>
          ) : null}
          {manualUrl ? (
            <a href={manualUrl} target="_blank" rel="noreferrer" className={ghostButton}>
              Mandar a mano
            </a>
          ) : null}
          {hasAccess && !todayCheckin ? (
            <form action={checkInTicketAction}>
              <input type="hidden" name="ticketId" value={ticket.id} />
              <FormSubmitButton className={ghostButton} pendingLabel="Registrando…">
                Registrar ingreso hoy
              </FormSubmitButton>
            </form>
          ) : null}
          {todayCheckin ? (
            <form action={undoCheckInAction}>
              <input type="hidden" name="checkinId" value={todayCheckin.id} />
              <FormSubmitButton className={ghostButton} pendingLabel="Borrando…" confirmMessage="¿Borrar el ingreso de hoy?">
                Deshacer ingreso de hoy
              </FormSubmitButton>
            </form>
          ) : null}
        </div>

        {/* datos */}
        <dl className="grid gap-x-8 gap-y-2 text-xs sm:grid-cols-4">
          <Info term="Creada" value={dateTimeFormatter.format(new Date(ticket.createdAt))} />
          <Info term="Desde" value={ticket.source ?? '—'} />
          <Info
            term="Último WhatsApp"
            value={
              ticket.lastMessage
                ? `${ticket.lastMessage.ok ? '✓' : '✗'} ${MESSAGE_LABEL[ticket.lastMessage.kind ?? ''] ?? ticket.lastMessage.kind ?? ''} · ${dateTimeFormatter.format(new Date(ticket.lastMessage.createdAt))}`
                : 'Ninguno todavía'
            }
            tone={ticket.lastMessage && !ticket.lastMessage.ok ? 'text-red-300' : undefined}
          />
          <Info
            term="Ingresos"
            value={ticket.checkins.length ? ticket.checkins.map((c) => dateTimeFormatter.format(new Date(c.createdAt))).join(' · ') : '—'}
          />
        </dl>
        {ticket.lastMessage && !ticket.lastMessage.ok && ticket.lastMessage.error ? (
          <p className="-mt-2 text-xs text-red-300/80">Error: {ticket.lastMessage.error}</p>
        ) : null}

        {/* pagos */}
        <div className="grid gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/45">Pagos</p>
          {ticket.payments.length ? (
            <ul className="grid gap-1.5 text-sm">
              {ticket.payments.map((payment) => (
                <li key={payment.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-white/75">
                  <span className="tabular-nums text-white">{formatPesos(payment.amountCents)}</span>
                  <span className="text-white/45">
                    {payment.method === 'MERCADO_PAGO' ? `Mercado Pago #${payment.mpPaymentId}` : payment.method.toLowerCase()}
                  </span>
                  <span className={payment.status === 'approved' ? 'text-emerald-300' : 'text-amber-200'}>
                    {payment.status === 'approved' ? 'acreditado' : `${payment.status}${payment.statusDetail ? ` (${payment.statusDetail})` : ''}`}
                  </span>
                  <span className="text-white/35">{dateTimeFormatter.format(new Date(payment.paidAt ?? payment.createdAt))}</span>
                  {payment.method !== 'MERCADO_PAGO' ? (
                    <form action={deleteTicketPaymentAction}>
                      <input type="hidden" name="paymentId" value={payment.id} />
                      <input type="hidden" name="ticketId" value={ticket.id} />
                      <FormSubmitButton
                        className="text-xs text-red-300/80 underline hover:text-red-200"
                        pendingLabel="Borrando…"
                        confirmMessage="¿Borrar este pago cargado a mano?"
                      >
                        borrar
                      </FormSubmitButton>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-white/45">Sin pagos todavía.</p>
          )}

          {due && ticket.status !== 'CANCELADO' ? (
            <form action={recordTicketPaymentAction} className="mt-1 flex flex-wrap items-end gap-2">
              <input type="hidden" name="ticketId" value={ticket.id} />
              <input
                name="amount"
                inputMode="numeric"
                defaultValue={String(Math.round(due.amountCents / 100))}
                className={`${fieldClass} w-32`}
                aria-label="Monto"
              />
              <select name="method" defaultValue="TRANSFERENCIA" className={fieldClass} aria-label="Medio">
                <option value="TRANSFERENCIA">Transferencia</option>
                <option value="EFECTIVO">Efectivo</option>
              </select>
              <FormSubmitButton className={primaryButton} pendingLabel="Guardando…">
                Registrar pago
              </FormSubmitButton>
            </form>
          ) : null}
        </div>

        {/* edicion */}
        <form action={updateTicketAction} className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
          <input type="hidden" name="ticketId" value={ticket.id} />
          <Field label="Nombre" name="fullName" defaultValue={ticket.fullName} />
          <Field label="WhatsApp" name="phone" defaultValue={ticket.phone} />
          <Field label="Email" name="email" defaultValue={ticket.email ?? ''} />
          <span className="hidden md:block" />
          <label className="grid gap-1.5 md:col-span-3">
            <span className="text-xs text-white/50">Notas internas</span>
            <input name="notes" defaultValue={ticket.notes ?? ''} placeholder="Ej: viene con una amiga" className={fieldClass} />
          </label>
          <FormSubmitButton className={primaryButton} pendingLabel="Guardando…">
            Guardar
          </FormSubmitButton>
        </form>

        <div className="flex justify-end">
          <form action={toggleCancelTicketAction}>
            <input type="hidden" name="ticketId" value={ticket.id} />
            <FormSubmitButton
              className="text-xs text-white/45 underline hover:text-white/80"
              pendingLabel="Guardando…"
              confirmMessage={
                ticket.status === 'CANCELADO'
                  ? '¿Reactivar esta entrada?'
                  : '¿Cancelar esta entrada? Libera el lugar. Si pagó por Mercado Pago, la devolución se hace desde MP.'
              }
            >
              {ticket.status === 'CANCELADO' ? 'Reactivar entrada' : 'Cancelar entrada'}
            </FormSubmitButton>
          </form>
        </div>
      </div>
    </details>
  );
}

function Info({ term, value, tone }: { term: string; value: string; tone?: string }) {
  return (
    <div>
      <dt className="text-white/40">{term}</dt>
      <dd className={`mt-0.5 ${tone ?? 'text-white/80'}`}>{value}</dd>
    </div>
  );
}

function Field({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs text-white/50">{label}</span>
      <input name={name} defaultValue={defaultValue} className={fieldClass} />
    </label>
  );
}
