/*
  Entradas de la 7ma edicion: precios, fechas y reglas de estado.
  Se usa en cliente y servidor: no importar nada de servidor aca.

  Dos formas de pago:
  - FULL: un solo pago de $72.000.
  - SPLIT: $100.000 en dos pagos de $50.000 (la mitad ahora para reservar el
    lugar y la otra mitad antes del taller).
*/

import { EDITION_NAME, EDITION_PLACE, FASE1_SCHEDULE, WAITLIST_MAX } from './inscripcion';

export type TicketPlan = 'FULL' | 'SPLIT';
export type TicketStatus = 'PENDIENTE' | 'SENADO' | 'PAGADO' | 'CANCELADO';
export type TicketPaymentMethod = 'MERCADO_PAGO' | 'TRANSFERENCIA' | 'EFECTIVO';

export type TicketPlanInfo = {
  id: TicketPlan;
  label: string;
  totalCents: number;
  installmentsCents: number[];
};

export const TICKET_PLANS: Record<TicketPlan, TicketPlanInfo> = {
  FULL: { id: 'FULL', label: 'Pago único', totalCents: 7_200_000, installmentsCents: [7_200_000] },
  SPLIT: { id: 'SPLIT', label: 'En 2 pagos', totalCents: 10_000_000, installmentsCents: [5_000_000, 5_000_000] },
};

export const TICKET_CAPACITY = WAITLIST_MAX;
export const TICKET_CODE_PREFIX = 'M7';
export const TICKET_CODE_RE = /\bM7-[2-9A-HJ-NP-Z]{8}\b/i;

export const EVENT_NAME = EDITION_NAME;
export const EVENT_DATE_LABEL = 'Sábado 28 y domingo 29 de noviembre';
export const EVENT_SCHEDULE_LABEL = FASE1_SCHEDULE;
export const EVENT_HOURS_LABEL = '11 a 17 hs';
export const EVENT_PLACE = EDITION_PLACE;
// Direccion exacta: si se carga en Vercel sale en los mensajes de WhatsApp.
export const EVENT_ADDRESS = (process.env.NEXT_PUBLIC_EVENT_ADDRESS ?? '').trim();
export const EVENT_START = new Date('2026-11-28T11:00:00-03:00');
export const EVENT_END = new Date('2026-11-29T17:00:00-03:00');
export const BALANCE_DEADLINE_LABEL = 'antes del sábado 28';

// Flyer oficial (public/entradas/flyer-7ma.jpg): og:image de /entradas y
// primera imagen que manda el WhatsApp.
export const FLYER_PATH = '/entradas/flyer-7ma.jpg';

// Numero del WhatsApp Business (solo digitos), para los botones "escribinos".
export const BUSINESS_WHATSAPP_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '').replace(/\D+/g, '');

export function isTicketPlan(value: unknown): value is TicketPlan {
  return value === 'FULL' || value === 'SPLIT';
}

export function formatPesos(cents: number) {
  return `$${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(Math.round(cents / 100))}`;
}

export const FULL_PRICE_LABEL = formatPesos(TICKET_PLANS.FULL.totalCents);
export const SPLIT_TOTAL_LABEL = formatPesos(TICKET_PLANS.SPLIT.totalCents);
export const SPLIT_INSTALLMENT_LABEL = formatPesos(TICKET_PLANS.SPLIT.installmentsCents[0]);

export function computeTicketStatus(totalCents: number, paidCents: number, cancelled = false): TicketStatus {
  if (cancelled) return 'CANCELADO';
  if (paidCents >= totalCents) return 'PAGADO';
  if (paidCents > 0) return 'SENADO';
  return 'PENDIENTE';
}

// Que pago sigue para una entrada: el primero (o unico) o el saldo.
export function nextInstallment(ticket: { plan: TicketPlan; totalCents: number; paidCents: number; status: string }) {
  if (ticket.status === 'CANCELADO' || ticket.paidCents >= ticket.totalCents) return null;
  const plan = TICKET_PLANS[ticket.plan];
  if (ticket.paidCents <= 0) return { number: 1, amountCents: plan.installmentsCents[0] };
  return { number: 2, amountCents: ticket.totalCents - ticket.paidCents };
}

export function ticketStatusLabel(status: string) {
  switch (status) {
    case 'PAGADO':
      return 'Entrada confirmada';
    case 'SENADO':
      return 'Lugar reservado · falta el saldo';
    case 'CANCELADO':
      return 'Cancelada';
    default:
      return 'Pago pendiente';
  }
}

export function firstName(fullName: string) {
  const first = fullName.trim().split(/\s+/)[0] ?? '';
  return first ? first[0].toUpperCase() + first.slice(1).toLowerCase() : '';
}

// Fecha calendario en Argentina (YYYY-MM-DD): para saber si ya entro "hoy".
export function argentinaDay(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function ticketPaths(code: string) {
  return {
    ticket: `/entradas/${code}`,
    pay: `/entradas/${code}/pagar`,
    image: `/api/entradas/${code}/imagen`,
  };
}

// Link para que la persona le escriba al WhatsApp Business pidiendo su entrada.
// Abre la conversacion (y la ventana de 24 h de WhatsApp Cloud API).
export function businessWhatsAppUrl(text: string) {
  if (!BUSINESS_WHATSAPP_NUMBER) return null;
  return `https://wa.me/${BUSINESS_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}
