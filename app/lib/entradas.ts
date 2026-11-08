/*
  Entradas de la 7ma edicion: precios, fechas y reglas de estado.
  Se usa en cliente y servidor: no importar nada de servidor aca.

  Dos formas de pago:
  - FULL: un solo pago de $72.000.
  - SPLIT: $120.000 en dos pagos de $60.000 (el primero reserva el lugar y el
    saldo se paga antes del sabado 28).

  Cada entrada guarda su total. Si cambian los precios:
  - la que no tiene ningun pago se cobra con el precio nuevo (repricedTotal);
  - la que ya pago algo conserva el precio con el que pago (totalForFirstPayment).
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
  SPLIT: { id: 'SPLIT', label: 'En 2 pagos', totalCents: 12_000_000, installmentsCents: [6_000_000, 6_000_000] },
};

// Precios anteriores del plan en 2 pagos (primer pago -> total). Hasta el
// 7/11/2026 eran 2 x $50.000 = $100.000.
const PREVIOUS_SPLIT_PRICES = [{ firstCents: 5_000_000, totalCents: 10_000_000 }];

export const TICKET_CAPACITY = WAITLIST_MAX;
// Cuantos lugares quedan se dice (en la web y en el WhatsApp) solo cuando son
// pocos de verdad. Con mas, solo "hay lugar": las ventas son dato interno.
export const SHOW_REMAINING_AT = 20;
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

/*
  Que cubre lo que se paga (pago unico o en 2): solo la Fase 1, que es el
  fin de semana del 28 y 29 y suma 2 meses de acompanamiento de Daiana. La
  Fase 2 tiene otro valor, que se informa solo a quienes llegan a esa etapa.
  Lo usan la web, el checkout, Mercado Pago y el bot de WhatsApp.
*/
export const SUPPORT_LABEL = '2 meses de acompañamiento';
export const SUPPORT_DETAIL = `${SUPPORT_LABEL} de Daiana, con actividades y encuentros virtuales o presenciales, hasta llegar a la Fase 2`;
export const NEXT_PHASE_PRICE_NOTE = 'La Fase 2 tiene otro valor, que se comunica solo a quienes llegan a esa etapa.';
export const TICKET_SCOPE_TEXT = `El pago es solo por la Fase 1: el taller del ${EVENT_DATE_LABEL.toLowerCase()} y, además, ${SUPPORT_DETAIL}. ${NEXT_PHASE_PRICE_NOTE}`;

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
// Lo que se ahorra pagando todo junto frente al plan en 2 pagos.
export const FULL_SAVINGS_LABEL = formatPesos(TICKET_PLANS.SPLIT.totalCents - TICKET_PLANS.FULL.totalCents);

export function computeTicketStatus(totalCents: number, paidCents: number, cancelled = false): TicketStatus {
  if (cancelled) return 'CANCELADO';
  if (paidCents >= totalCents) return 'PAGADO';
  if (paidCents > 0) return 'SENADO';
  return 'PENDIENTE';
}

// Que pago sigue para una entrada: el primero (o unico) o el saldo.
// El primero sale del total de la entrada (la mitad en el plan en 2 pagos), asi
// una que conserva el precio anterior sigue cobrando ese precio.
export function nextInstallment(ticket: { plan: TicketPlan; totalCents: number; paidCents: number; status: string }) {
  if (ticket.status === 'CANCELADO' || ticket.paidCents >= ticket.totalCents) return null;
  const plan = TICKET_PLANS[ticket.plan];
  if (ticket.paidCents <= 0) {
    const share = plan.installmentsCents[0] / plan.totalCents;
    return { number: 1, amountCents: Math.round(ticket.totalCents * share) };
  }
  return { number: 2, amountCents: ticket.totalCents - ticket.paidCents };
}

// Entrada pendiente y sin pagos acreditados con un total distinto al precio de
// hoy: devuelve el total nuevo (null si no hay que cambiar nada). Quien la usa
// chequea ademas que no tenga pagos en proceso (por ejemplo, un cupon de Rapipago).
export function repricedTotal(ticket: { plan: TicketPlan; totalCents: number; paidCents: number; status: string }) {
  const current = TICKET_PLANS[ticket.plan].totalCents;
  if (ticket.status !== 'PENDIENTE' || ticket.paidCents > 0 || ticket.totalCents === current) return null;
  return current;
}

// Total de una entrada al acreditarse su primer pago de Mercado Pago. Si el pago
// salio de un link armado con el precio anterior del plan en 2 pagos, la entrada
// conserva ese precio; si no, queda `totalCents`.
export function totalForFirstPayment(plan: TicketPlan, firstPaymentCents: number, totalCents: number) {
  if (plan !== 'SPLIT') return totalCents;
  return PREVIOUS_SPLIT_PRICES.find((price) => price.firstCents === firstPaymentCents)?.totalCents ?? totalCents;
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
