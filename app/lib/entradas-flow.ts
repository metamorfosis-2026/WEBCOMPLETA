/*
  Flujo de entradas (solo servidor):

  compra en la web -> entrada PENDIENTE -> link de Mercado Pago
  -> MP avisa al webhook (o la persona vuelve a /entradas/CODIGO)
  -> se guarda el pago, se recalcula el estado (SENADO / PAGADO)
  -> si el estado subio, sale el WhatsApp con la entrada y el QR.

  Todo es idempotente: MP manda varias notificaciones por pago y la pagina de
  vuelta tambien procesa el pago, pero el WhatsApp sale una sola vez.
*/

import {
  EVENT_DATE_LABEL,
  EVENT_END,
  EVENT_START,
  TICKET_CAPACITY,
  TICKET_CODE_RE,
  TICKET_PLANS,
  argentinaDay,
  computeTicketStatus,
  formatPesos,
  nextInstallment,
  ticketPaths,
  ticketStatusLabel,
  type TicketPlan,
  type TicketStatus,
} from './entradas';
import {
  balanceReminderMessage,
  eveMessage,
  messageForTicket,
  pendingPaymentMessage,
  type MessageKind,
  type TicketLinks,
} from './entradas-mensajes';
import { EDITION_LABEL, EDITION_NAME } from './inscripcion';
import {
  MercadoPagoError,
  createCheckoutPreference,
  getMercadoPagoPayment,
  hasMercadoPago,
  parseExternalReference,
  type MercadoPagoPayment,
} from './mercadopago';
import { toWhatsAppNumber } from './phone';
import { isPublicHttps } from './site';
import { listSignups, updateSignup } from './supabase/db';
import {
  countRecentBotReplies,
  countSoldTickets,
  findPendingTicketByPhone,
  getTicketByCode,
  getTicketById,
  hasSentMessageKind,
  getLatestIncomingId,
  insertIncomingWhatsApp,
  insertManualTicketPayment,
  insertTicket,
  insertTicketCheckin,
  insertWhatsAppMessage,
  listConversation,
  listTicketCheckins,
  listTicketPayments,
  listTicketsByPhone,
  listTicketsByStatus,
  updateTicket,
  updateTicketIfStatus,
  upsertMercadoPagoPayment,
  type Ticket,
} from './supabase/tickets';
import { sendWhatsApp, type OutgoingWhatsApp } from './whatsapp';
import {
  MEDIA_REPLY,
  generateAiReply,
  hasAiBot,
  ruleBasedReply,
  type BotContext,
  type ConversationTurn,
  type RegisterFn,
} from './whatsapp-bot';

const STATUS_RANK: Record<TicketStatus, number> = { CANCELADO: -1, PENDIENTE: 0, SENADO: 1, PAGADO: 2 };

export function absoluteTicketLinks(siteUrl: string, code: string): TicketLinks {
  const paths = ticketPaths(code);
  return { ticket: `${siteUrl}${paths.ticket}`, pay: `${siteUrl}${paths.pay}`, image: `${siteUrl}${paths.image}` };
}

/* ----------------------------------------------------------------- checkout */

export async function createPaymentLink(ticket: Ticket, siteUrl: string) {
  const next = nextInstallment(ticket);
  if (!next) return null;

  const links = absoluteTicketLinks(siteUrl, ticket.code);
  const title =
    ticket.plan === 'SPLIT'
      ? next.number === 1
        ? 'Metamorfosis 7ma Edición · Entrada (1er pago de 2)'
        : 'Metamorfosis 7ma Edición · Entrada (saldo)'
      : 'Metamorfosis 7ma Edición · Entrada';

  const preference = await createCheckoutPreference({
    code: ticket.code,
    plan: ticket.plan,
    installment: next.number,
    amountCents: next.amountCents,
    title,
    description: `Fase 1 · ${EVENT_DATE_LABEL}`,
    payerName: ticket.fullName,
    payerEmail: ticket.email,
    successUrl: `${links.ticket}?pago=ok`,
    pendingUrl: `${links.ticket}?pago=pendiente`,
    failureUrl: `${links.ticket}?pago=error`,
    // MP no puede avisarle a localhost: en local se procesa al volver a la pagina.
    notificationUrl: isPublicHttps(siteUrl) ? `${siteUrl}/api/mercadopago/webhook` : null,
  });

  return preference.url;
}

export async function startCheckout(
  input: { plan: TicketPlan; fullName: string; phone: string; email: string | null; source: string | null },
  siteUrl: string
) {
  const plan = TICKET_PLANS[input.plan];
  const values = {
    full_name: input.fullName,
    email: input.email,
    plan: plan.id,
    total_cents: plan.totalCents,
    source: input.source,
  };

  const existing = await findPendingTicketByPhone(input.phone);
  const ticket = existing
    ? await updateTicket(existing.id, values)
    : await insertTicket({ ...values, edition_label: EDITION_LABEL, phone: input.phone });

  const url = await createPaymentLink(ticket, siteUrl);
  if (!url) throw new Error('NO_PAYMENT_DUE');
  return { ticket, url };
}

/* ------------------------------------------------------------- recalculo */

/*
  Recalcula lo pagado a partir de los pagos acreditados y actualiza la
  entrada. Si el estado sube (pendiente -> seña -> pagada) manda el WhatsApp.
  `planFromPayment`: si el primer pago vino de un link de otro plan (la
  persona cambio de opcion pero pago el link viejo), gana lo que pago.
*/
async function refreshTicket(ticketId: string, siteUrl: string, options: { planFromPayment?: TicketPlan } = {}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const ticket = await getTicketById(ticketId);
    if (!ticket) throw new Error('TICKET_NOT_FOUND');

    const payments = await listTicketPayments(ticketId);
    const paid = payments.filter((p) => p.status === 'approved').reduce((sum, p) => sum + p.amountCents, 0);

    let plan = ticket.plan;
    if (options.planFromPayment && options.planFromPayment !== plan && ticket.paidCents === 0) {
      plan = options.planFromPayment;
    }
    const total = plan === ticket.plan ? ticket.totalCents : TICKET_PLANS[plan].totalCents;
    const status = computeTicketStatus(total, paid, ticket.status === 'CANCELADO');

    if (status === ticket.status && paid === ticket.paidCents && plan === ticket.plan) {
      return ticket;
    }

    const updated = await updateTicketIfStatus(ticket.id, ticket.status, {
      paid_cents: paid,
      status,
      plan,
      total_cents: total,
    });
    if (!updated) continue; // otro proceso lo cambio en el medio: releemos

    if (STATUS_RANK[updated.status] > STATUS_RANK[ticket.status] && updated.status !== 'PENDIENTE') {
      await notifyTicket(updated, siteUrl);
      await syncSignupStatus(updated);
    }
    return updated;
  }

  return getTicketById(ticketId);
}

// Si la persona estaba en la lista de espera, la marcamos en el admin.
async function syncSignupStatus(ticket: Ticket) {
  try {
    const target = ticket.status === 'PAGADO' ? 'INSCRIPTO' : 'RESERVADO';
    const signups = await listSignups();
    for (const signup of signups) {
      if (!(signup.editionLabel ?? '').startsWith(EDITION_NAME)) continue;
      if (toWhatsAppNumber(signup.phone) !== ticket.phone) continue;
      if (signup.status === 'INSCRIPTO' || signup.status === target) continue;
      await updateSignup(signup.id, { status: target });
    }
  } catch (error) {
    console.error('[entradas] no se pudo actualizar la lista de espera:', error);
  }
}

/* ------------------------------------------------------------ mercado pago */

export async function processMercadoPagoPayment(paymentId: string, siteUrl: string) {
  let payment: MercadoPagoPayment;
  try {
    payment = await getMercadoPagoPayment(paymentId);
  } catch (error) {
    // Pago que MP no conoce (por ejemplo, la "Simular notificacion" del panel):
    // no hay nada que hacer y no queremos que MP reintente.
    if (error instanceof MercadoPagoError && error.status === 404) {
      return { handled: false as const, reason: 'payment-not-found' };
    }
    throw error;
  }
  const reference = parseExternalReference(payment.external_reference);
  if (!reference) return { handled: false as const, reason: 'not-a-ticket' };
  if (payment.currency_id && payment.currency_id !== 'ARS') return { handled: false as const, reason: 'currency' };

  const ticket = await getTicketByCode(reference.code);
  if (!ticket) return { handled: false as const, reason: 'ticket-not-found' };

  await upsertMercadoPagoPayment({
    ticket_id: ticket.id,
    installment: reference.installment,
    amount_cents: Math.round(Number(payment.transaction_amount) * 100),
    status: payment.status,
    status_detail: payment.status_detail ?? null,
    mp_payment_id: String(payment.id),
    payer_email: payment.payer?.email ?? null,
    paid_at: payment.date_approved ?? null,
  });

  const updated = await refreshTicket(ticket.id, siteUrl, {
    planFromPayment: payment.status === 'approved' ? reference.plan : undefined,
  });
  return { handled: true as const, ticket: updated, paymentStatus: payment.status, code: reference.code };
}

/* ---------------------------------------------------------------- whatsapp */

export async function deliverWhatsApp(
  ticket: Pick<Ticket, 'id'> | null,
  phone: string,
  kind: MessageKind,
  message: OutgoingWhatsApp,
  options: { inConversation?: boolean } = {}
) {
  const result = await sendWhatsApp(phone, message, options);
  try {
    await insertWhatsAppMessage({
      ticket_id: ticket?.id ?? null,
      direction: 'OUT',
      phone,
      kind,
      body: message.text.slice(0, 2000),
      provider: result.provider,
      ok: result.ok,
      error: result.ok ? null : (result.error ?? 'error').slice(0, 500),
    });
  } catch (error) {
    console.error('[whatsapp] no se pudo registrar el mensaje:', error);
  }
  if (!result.ok) console.error(`[whatsapp] fallo ${kind} a ${phone}:`, result.error);
  return result;
}

// Manda el mensaje que corresponde al estado actual (entrada, seña o pago pendiente).
export async function notifyTicket(ticket: Ticket, siteUrl: string) {
  const built = messageForTicket(ticket, absoluteTicketLinks(siteUrl, ticket.code));
  if (!built) return null;
  return deliverWhatsApp(ticket, ticket.phone, built.kind, built.message);
}

/* ----------------------------------------------------------------- admin */

export async function registerManualPayment(
  ticketId: string,
  amountCents: number,
  method: 'TRANSFERENCIA' | 'EFECTIVO',
  actor: string | null,
  siteUrl: string
) {
  const ticket = await getTicketById(ticketId);
  if (!ticket) throw new Error('TICKET_NOT_FOUND');
  const next = nextInstallment(ticket);
  await insertManualTicketPayment({
    ticket_id: ticket.id,
    installment: next?.number ?? 1,
    amount_cents: amountCents,
    method,
    recorded_by: actor,
  });
  return refreshTicket(ticket.id, siteUrl);
}

export async function createManualTicket(
  input: {
    fullName: string;
    phone: string;
    email: string | null;
    plan: TicketPlan;
    paidCents: number;
    method: 'TRANSFERENCIA' | 'EFECTIVO';
    actor: string | null;
    notes: string | null;
  },
  siteUrl: string
) {
  const plan = TICKET_PLANS[input.plan];
  const ticket = await insertTicket({
    edition_label: EDITION_LABEL,
    full_name: input.fullName,
    phone: input.phone,
    email: input.email,
    plan: plan.id,
    total_cents: plan.totalCents,
    source: 'admin',
    notes: input.notes,
  });
  if (input.paidCents > 0) {
    await insertManualTicketPayment({
      ticket_id: ticket.id,
      installment: 1,
      amount_cents: input.paidCents,
      method: input.method,
      recorded_by: input.actor,
    });
  }
  return refreshTicket(ticket.id, siteUrl);
}

export async function recalculateTicket(ticketId: string, siteUrl: string) {
  return refreshTicket(ticketId, siteUrl);
}

export async function checkInTicket(ticketId: string, actor: string | null) {
  const today = argentinaDay(new Date());
  const checkins = await listTicketCheckins(ticketId);
  if (checkins.some((checkin) => argentinaDay(new Date(checkin.createdAt)) === today)) {
    return { already: true };
  }
  await insertTicketCheckin(ticketId, actor);
  return { already: false };
}

/* --------------------------------------------------------------------- bot */

/*
  WhatsApp que se atiende solo. Cada mensaje entrante:
  1. Se guarda (si ya estaba, es un reenvio del webhook y no se contesta).
  2. Se espera unos segundos: si la persona sigue escribiendo, contesta el
     ultimo mensaje con todo junto en vez de responder cada uno.
  3. Si pide su entrada / QR / saldo (o manda su codigo), le llega la entrada
     con la imagen del QR.
  4. Si no, contesta la IA con los datos del taller y de su entrada; sin IA,
     un menu armado a mano.
*/
const TICKET_REQUEST = /\b(entradas?|qr|ticket|saldo|mi codigo|mi código)\b/i;
const DEBOUNCE_MS = Number(process.env.WHATSAPP_DEBOUNCE_MS ?? 3500);
const MAX_REPLIES_PER_WINDOW = 6; // freno anti-bucle (por ejemplo, contra otro bot)

export type IncomingWhatsApp = {
  from: string;
  text: string;
  messageId: string | null;
  pushName: string | null;
  // text: mensaje normal · media: audio / foto / video sin texto
  type: 'text' | 'media';
  provider: string;
};

async function wait(ms: number) {
  if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function handleIncomingWhatsApp(message: IncomingWhatsApp, siteUrl: string) {
  const phone = toWhatsAppNumber(message.from);
  const text = message.text.trim();

  const codeMatch = text.match(TICKET_CODE_RE);
  let tickets: Ticket[] = [];
  if (codeMatch) {
    const byCode = await getTicketByCode(codeMatch[0]);
    if (byCode && byCode.status !== 'CANCELADO') tickets = [byCode];
  }
  if (!tickets.length) tickets = await listTicketsByPhone(phone);

  const incomingId = await insertIncomingWhatsApp({
    ticket_id: tickets[0]?.id ?? null,
    phone,
    body: message.type === 'media' && !text ? '[audio / archivo sin texto]' : text.slice(0, 2000),
    provider: message.provider,
    external_id: message.messageId,
  });
  if (!incomingId) return { replied: false, reason: 'duplicate' };

  const windowStart = new Date(Date.now() - 3 * 60_000).toISOString();
  if ((await countRecentBotReplies(phone, windowStart)) >= MAX_REPLIES_PER_WINDOW) {
    console.warn('[whatsapp] demasiadas respuestas seguidas a', phone, '- pauso el bot');
    return { replied: false, reason: 'loop-guard' };
  }

  await wait(DEBOUNCE_MS);
  if ((await getLatestIncomingId(phone)) !== incomingId) return { replied: false, reason: 'newer-message' };

  // Audio, foto o video sin texto: no los podemos leer.
  if (message.type === 'media' && !text) {
    await deliverWhatsApp(tickets[0] ?? null, phone, 'BOT', { text: MEDIA_REPLY }, { inConversation: true });
    return { replied: true, mode: 'media' };
  }

  // Si manda su codigo (por ejemplo desde otro telefono), le mandamos esa entrada.
  const ordered = [...tickets].sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status]).slice(0, 3);
  const sendTickets = async () => {
    for (const ticket of ordered) {
      const built = messageForTicket(ticket, absoluteTicketLinks(siteUrl, ticket.code));
      if (built) await deliverWhatsApp(ticket, phone, 'BOT', built.message, { inConversation: true });
    }
  };
  const asksForTicket = Boolean(codeMatch) || TICKET_REQUEST.test(text);
  if (codeMatch && ordered.length) {
    await sendTickets();
    return { replied: true, mode: 'ticket', tickets: ordered.length };
  }
  // Sin IA, "entrada" / "qr" / "saldo" reenvian la entrada directo. Con IA
  // decide ella (si pregunta "la entrada incluye almuerzo?" no hay que reenviarla).
  if (!hasAiBot() && asksForTicket && ordered.length) {
    await sendTickets();
    return { replied: true, mode: 'ticket', tickets: ordered.length };
  }

  let remaining: number | null = null;
  try {
    remaining = Math.max(0, TICKET_CAPACITY - (await countSoldTickets()));
  } catch {
    // sin dato de cupo, la IA no lo menciona
  }

  const context: BotContext = {
    now: new Date(),
    pushName: message.pushName,
    remaining,
    tickets: ordered.map((ticket) => ({
      code: ticket.code,
      fullName: ticket.fullName,
      status: ticket.status,
      totalCents: ticket.totalCents,
      paidCents: ticket.paidCents,
      links: absoluteTicketLinks(siteUrl, ticket.code),
    })),
  };

  // Memoria: lo hablado con este numero en las ultimas 24 h.
  const conversation = await listConversation(phone, new Date(Date.now() - 24 * 60 * 60_000).toISOString(), 24);
  const history: ConversationTurn[] = conversation
    .filter((entry) => entry.body && (entry.direction === 'IN' || entry.ok))
    .map((entry) => ({ role: entry.direction === 'IN' ? 'user' : 'assistant', text: entry.body! }));

  let resent = false;
  const aiText = await generateAiReply(history, context, siteUrl, {
    register: registerFromWhatsApp(phone, siteUrl),
    resendTicket: async () => {
      if (!ordered.length) return 'SIN_ENTRADA: este número no tiene entradas. Si pagó con otro número, pedile su código (empieza con M7-).';
      if (resent) return 'YA_ENVIADA: la entrada ya se mandó en este turno.';
      resent = true;
      await sendTickets();
      return `ENVIADO: se mandó por WhatsApp ${ordered.length === 1 ? 'su entrada' : `${ordered.length} entradas`} con el QR y el estado del pago. Confirmá en una línea, sin repetir links.`;
    },
  });
  if (aiText) {
    await deliverWhatsApp(ordered[0] ?? null, phone, 'IA', { text: aiText }, { inConversation: true });
    return { replied: true, mode: resent ? 'ai+ticket' : 'ai' };
  }
  if (resent) return { replied: true, mode: 'ticket' };

  // Sin IA (o si fallo): si pidio la entrada se la mandamos; si no, el menu.
  if (asksForTicket && ordered.length) {
    await sendTickets();
    return { replied: true, mode: 'ticket', tickets: ordered.length };
  }

  await deliverWhatsApp(
    ordered[0] ?? null,
    phone,
    'BOT',
    { text: ruleBasedReply(text, context, siteUrl) },
    { inConversation: true }
  );
  return { replied: true, mode: 'menu' };
}

/*
  Herramienta del bot: anota a quien escribe y devuelve su link de pago.
  Reutiliza la entrada sin pagar de ese numero (si cambia de forma de pago no
  se duplica). El link /entradas/CODIGO/pagar arma el checkout de Mercado
  Pago al abrirlo, con el monto que corresponda en ese momento.
  Los textos en mayusculas son para la IA, no para la persona.
*/
function registerFromWhatsApp(phone: string, siteUrl: string): RegisterFn {
  return async (fullName, planId) => {
    const name = fullName.trim().replace(/\s+/g, ' ');
    if (name.length < 3 || !name.includes(' ')) {
      return { message: 'FALTA_NOMBRE: pedile nombre y apellido antes de anotarla.', payUrl: null };
    }
    if (!hasMercadoPago()) {
      return {
        message: 'NO_DISPONIBLE: el pago online todavía no está habilitado. Decile que se habilita en breve y que vuelva a escribir, sin inventar fechas.',
        payUrl: null,
      };
    }

    const active = (await listTicketsByPhone(phone)).find((t) => t.status === 'PAGADO' || t.status === 'SENADO');
    if (active) {
      const links = absoluteTicketLinks(siteUrl, active.code);
      const owes = active.status === 'SENADO';
      return {
        message: `YA_TIENE_ENTRADA: este número ya tiene la entrada ${active.code} a nombre de ${active.fullName} (${ticketStatusLabel(active.status)}). No se creó otra. Su entrada con QR: ${links.ticket}${owes ? `. Link para pagar el saldo: ${links.pay}` : ''}`,
        payUrl: owes ? links.pay : null,
      };
    }

    if ((await countSoldTickets()) >= TICKET_CAPACITY) {
      return {
        message: 'AGOTADO: no quedan lugares. Decíselo con amabilidad y ofrecele escribir por Instagram para quedar en lista de espera.',
        payUrl: null,
      };
    }

    const plan = TICKET_PLANS[planId];
    const values = { full_name: name, plan: plan.id, total_cents: plan.totalCents, source: 'whatsapp' };
    const pending = await findPendingTicketByPhone(phone);
    const ticket = pending
      ? await updateTicket(pending.id, values)
      : await insertTicket({ ...values, edition_label: EDITION_LABEL, phone, email: null });
    const links = absoluteTicketLinks(siteUrl, ticket.code);

    return {
      message: `OK: entrada ${ticket.code} a nombre de ${name}, ${plan.label.toLowerCase()}. Link para pagar ${formatPesos(plan.installmentsCents[0])} con Mercado Pago: ${links.pay} (mandalo tal cual). Apenas se acredite el pago le llega por este WhatsApp la entrada con el QR, sin que tenga que hacer nada más.`,
      payUrl: links.pay,
    };
  };
}

/* --------------------------------------------------------------- recordatorios */

const REMINDER_EVERY_MS = 3 * 24 * 60 * 60 * 1000;
const PENDING_REMINDER_AFTER_MS = 20 * 60 * 60 * 1000;
const PENDING_REMINDER_UNTIL_MS = 4 * 24 * 60 * 60 * 1000;

async function runInBatches<T>(items: T[], size: number, worker: (item: T) => Promise<void>) {
  for (let index = 0; index < items.length; index += size) {
    await Promise.all(items.slice(index, index + size).map(worker));
  }
}

/*
  Corre una vez por dia (Vercel Cron):
  - Vispera (viernes 27): a todas las entradas con pago, una sola vez.
  - Antes de eso: a quien debe el saldo, cada 3 dias.
  - A quien se anoto y no pago (despues de ~20 h), un solo recordatorio.
*/
export async function runDailyReminders(siteUrl: string, now = new Date()) {
  const summary = { vispera: 0, saldo: 0, sinPagar: 0, fallidos: 0, skipped: null as string | null };
  if (now >= EVENT_END) {
    summary.skipped = 'el taller ya termino';
    return summary;
  }

  const today = argentinaDay(now);
  const eveDay = argentinaDay(new Date(EVENT_START.getTime() - 24 * 60 * 60 * 1000));
  const eventDay = argentinaDay(EVENT_START);
  const tickets = await listTicketsByStatus(['SENADO', 'PAGADO', 'PENDIENTE']);

  await runInBatches(tickets, 4, async (ticket) => {
    const links = absoluteTicketLinks(siteUrl, ticket.code);

    if (ticket.status === 'PENDIENTE') {
      const age = now.getTime() - new Date(ticket.createdAt).getTime();
      if (age < PENDING_REMINDER_AFTER_MS || age > PENDING_REMINDER_UNTIL_MS || today >= eventDay) return;
      if (await hasSentMessageKind(ticket.id, 'PENDIENTE')) return;
      const result = await deliverWhatsApp(ticket, ticket.phone, 'PENDIENTE', pendingPaymentMessage(ticket, links));
      if (result.ok) summary.sinPagar += 1;
      else summary.fallidos += 1;
      return;
    }

    if (today === eveDay) {
      if (await hasSentMessageKind(ticket.id, 'VISPERA')) return;
      const result = await deliverWhatsApp(ticket, ticket.phone, 'VISPERA', eveMessage(ticket, links));
      if (result.ok) summary.vispera += 1;
      else summary.fallidos += 1;
      return;
    }

    if (ticket.status !== 'SENADO' || today >= eventDay) return;
    const reference = new Date(ticket.lastReminderAt ?? ticket.updatedAt).getTime();
    if (now.getTime() - reference < REMINDER_EVERY_MS) return;

    const result = await deliverWhatsApp(ticket, ticket.phone, 'SALDO', balanceReminderMessage(ticket, links));
    await updateTicket(ticket.id, { last_reminder_at: now.toISOString() });
    if (result.ok) summary.saldo += 1;
    else summary.fallidos += 1;
  });

  return summary;
}
