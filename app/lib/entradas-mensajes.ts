/*
  Textos de WhatsApp de las entradas. Se usan para el envio automatico y
  tambien en el admin (boton "mandar a mano" por wa.me), asi que no importan
  nada de servidor.

  Cada mensaje trae su plantilla equivalente para WhatsApp Cloud API: los
  nombres y el orden de los parametros tienen que coincidir con las
  plantillas cargadas en Meta (ver docs/entradas-setup.md).
*/

import {
  BALANCE_DEADLINE_LABEL,
  DUO_TOTAL_CENTS,
  TICKET_PLANS,
  EVENT_ADDRESS,
  EVENT_DATE_LABEL,
  EVENT_HOURS_LABEL,
  EVENT_PLACE,
  SUPPORT_LABEL,
  firstName,
  formatPesos,
} from './entradas';
import type { OutgoingWhatsApp } from './whatsapp';

export type MessageKind = 'CONFIRMACION' | 'SENA' | 'SALDO' | 'VISPERA' | 'PENDIENTE' | 'BOT' | 'IA' | 'FLYER' | 'SEGUIMIENTO';

export type TicketForMessage = {
  code: string;
  fullName: string;
  totalCents: number;
  paidCents: number;
  status: string;
  // Promo para dos: nombre de la otra persona.
  companionName?: string | null;
};

export type TicketLinks = { ticket: string; pay: string; image: string };

const PLACE_LINE = EVENT_ADDRESS ? `📍 ${EVENT_ADDRESS}` : `📍 ${EVENT_PLACE} (te pasamos la dirección exacta por acá)`;
const INCLUDES_LINE = `Tu entrada es por la Fase 1: incluye el taller y, después, ${SUPPORT_LABEL} con Daiana hasta llegar a la Fase 2.`;

function hello(ticket: TicketForMessage) {
  const name = firstName(ticket.fullName);
  return name ? `¡Hola ${name}!` : '¡Hola!';
}

export function confirmationMessage(ticket: TicketForMessage, links: TicketLinks): OutgoingWhatsApp {
  const text = [
    `${hello(ticket)} 🦋`,
    'Tu entrada para *Metamorfosis 7ma Edición* está confirmada ✅',
    ticket.companionName ? `Es parte de la promo para dos, junto a *${ticket.companionName}* 💙` : null,
    '',
    `📅 ${EVENT_DATE_LABEL}`,
    `🕚 De ${EVENT_HOURS_LABEL}, los dos días`,
    PLACE_LINE,
    '',
    INCLUDES_LINE,
    '',
    `🎟️ Código: *${ticket.code}*`,
    `Tu entrada con QR: ${links.ticket}`,
    '',
    'Guardá este mensaje: el QR se escanea en la puerta.',
  ]
    .filter((line) => line !== null)
    .join('\n');

  return {
    text,
    imageUrl: links.image,
    template: { name: 'entrada_confirmada', params: [firstName(ticket.fullName) || 'hola', ticket.code, links.ticket] },
  };
}

export function depositMessage(ticket: TicketForMessage, links: TicketLinks): OutgoingWhatsApp {
  const balance = formatPesos(ticket.totalCents - ticket.paidCents);
  const paid = formatPesos(ticket.paidCents);
  const text = [
    `${hello(ticket)} 🦋`,
    `Recibimos tu primer pago de *${paid}* para *Metamorfosis 7ma Edición*. Tu lugar ya está reservado ✅`,
    '',
    `Te queda el saldo de *${balance}*, que podés pagar ${BALANCE_DEADLINE_LABEL} acá:`,
    links.pay,
    '',
    `📅 ${EVENT_DATE_LABEL}`,
    `🕚 De ${EVENT_HOURS_LABEL}, los dos días`,
    PLACE_LINE,
    '',
    INCLUDES_LINE,
    '',
    `🎟️ Código: *${ticket.code}*`,
    `Tu entrada con QR: ${links.ticket}`,
  ].join('\n');

  return {
    text,
    imageUrl: links.image,
    template: {
      name: 'sena_recibida',
      params: [firstName(ticket.fullName) || 'hola', paid, balance, links.pay, links.ticket],
    },
  };
}

export function balanceReminderMessage(ticket: TicketForMessage, links: TicketLinks): OutgoingWhatsApp {
  const balance = formatPesos(ticket.totalCents - ticket.paidCents);
  const text = [
    `${hello(ticket)} 🦋`,
    `Te recordamos que te queda el saldo de *${balance}* de tu entrada a *Metamorfosis 7ma Edición* (${EVENT_DATE_LABEL.toLowerCase()}).`,
    '',
    `Lo podés pagar ${BALANCE_DEADLINE_LABEL} acá:`,
    links.pay,
    '',
    'Cualquier duda, respondé este mensaje.',
  ].join('\n');

  return {
    text,
    template: { name: 'recordatorio_saldo', params: [firstName(ticket.fullName) || 'hola', balance, links.pay] },
  };
}

export function eveMessage(ticket: TicketForMessage, links: TicketLinks): OutgoingWhatsApp {
  const owes = ticket.paidCents < ticket.totalCents;
  const text = [
    `${hello(ticket)} 🦋 ¡Mañana arrancamos *Metamorfosis 7ma Edición*!`,
    '',
    `🕚 De ${EVENT_HOURS_LABEL}, sábado y domingo`,
    PLACE_LINE,
    '',
    `Tené a mano tu QR para la entrada: ${links.ticket}`,
    owes ? `\nTodavía te queda el saldo de *${formatPesos(ticket.totalCents - ticket.paidCents)}*. Pagalo acá así entrás directo: ${links.pay}` : null,
    '',
    'Venís con ropa cómoda. ¡Te esperamos!',
  ]
    .filter((line) => line !== null)
    .join('\n');

  return {
    text,
    imageUrl: links.image,
    template: { name: 'vispera_taller', params: [firstName(ticket.fullName) || 'hola', links.ticket] },
  };
}

export function pendingPaymentMessage(ticket: TicketForMessage, links: TicketLinks): OutgoingWhatsApp {
  const text = [
    `${hello(ticket)} 🦋`,
    `Tenés una entrada a *Metamorfosis 7ma Edición* iniciada pero todavía no vemos el pago acreditado.`,
    '',
    'Podés completarlo acá:',
    links.pay,
    '',
    'Si ya pagaste en efectivo (Rapipago / Pago Fácil) puede tardar unas horas en acreditarse: te avisamos por acá apenas entre.',
  ].join('\n');
  return { text };
}

// Mensaje que corresponde al estado actual de la entrada.
export function messageForTicket(ticket: TicketForMessage, links: TicketLinks): { kind: MessageKind; message: OutgoingWhatsApp } | null {
  if (ticket.status === 'PAGADO') return { kind: 'CONFIRMACION', message: confirmationMessage(ticket, links) };
  if (ticket.status === 'SENADO') return { kind: 'SENA', message: depositMessage(ticket, links) };
  if (ticket.status === 'PENDIENTE') return { kind: 'PENDIENTE', message: pendingPaymentMessage(ticket, links) };
  return null;
}

/*
  Bienvenida a quien escribe por primera vez (despues de la imagen del flyer).
  Es el texto modelo: la IA lo adapta si la persona ya trajo una pregunta, y
  sin IA se manda tal cual.
*/
export const WELCOME_TEXT = [
  '¡Hola! Gracias por escribirnos 🦋',
  '',
  'Te compartimos la info de la 7ma edición de Metamorfosis, nuestro taller vivencial de inteligencia emocional:',
  '',
  `📅 ${EVENT_DATE_LABEL}`,
  `🕚 De ${EVENT_HOURS_LABEL}`,
  `📍 ${EVENT_PLACE} (la dirección exacta se envía al confirmar)`,
  '',
  'Es un fin de semana para frenar, mirar con honestidad lo que venís cargando y llevarte herramientas concretas para tu día a día. Es en grupo reducido y todo es vivencial: más que escuchar, se vive.',
  '',
  'Para orientarte mejor, ¿qué te llevó a interesarte en el taller?',
].join('\n');

/*
  Promo para dos, con el texto de Daiana. La IA lo manda casi tal cual cuando
  alguien pregunta por venir de a dos; sin IA va en el menu.
*/
export const DUO_PROMO_TEXT = [
  '🦋 *META 7 | UNA EXPERIENCIA PARA COMPARTIR*',
  '',
  'Hay experiencias que pueden marcar un antes y un después en nuestra manera de vernos, comprendernos y vincularnos.',
  'Y hay personas con las que nos gustaría compartir ese camino.',
  '',
  'Por eso, para esta nueva edición de Metamorfosis, preparamos una propuesta especial:',
  '',
  '✨ *VENÍ CON ALGUIEN Y ACCEDAN A UN VALOR ÚNICO.*',
  '',
  `Valor regular: ${formatPesos(TICKET_PLANS.SPLIT.totalCents)} por persona.`,
  `💙 *PROMO PARA DOS: ${formatPesos(DUO_TOTAL_CENTS)} EN TOTAL.*`,
  `¡Solo ${formatPesos(TICKET_PLANS.DUO.totalCents)} por persona, abonando al contado!`,
  '',
  'Dos personas. Dos procesos personales. Una oportunidad para animarse a vivir algo diferente.',
  '',
  '🦋 Metamorfosis 7 — Cupos limitados.',
].join('\n');

// Seguimiento unico si la persona dejo de responder (sin insistir).
export const FOLLOW_UP_TEXT = [
  '¡Hola! 🦋 Te escribo por si te quedó alguna duda sobre el taller del 28 y 29 de noviembre.',
  'Si querés, seguimos por acá cuando te quede cómodo.',
].join('\n');
