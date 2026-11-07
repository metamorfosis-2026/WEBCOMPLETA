'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { TICKET_PLANS, computeTicketStatus, isTicketPlan } from '@/app/lib/entradas';
import {
  checkInTicket,
  createManualTicket,
  notifyTicket,
  recalculateTicket,
  registerManualPayment,
} from '@/app/lib/entradas-flow';
import { isAdminRole, parseMoneyToCents } from '@/app/lib/metamorfosis';
import { isValidWhatsAppNumber, toWhatsAppNumber } from '@/app/lib/phone';
import { getSiteUrl } from '@/app/lib/site';
import { deleteTicketCheckin, deleteTicketPayment, getTicketById, updateTicket } from '@/app/lib/supabase/tickets';

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('UNAUTHENTICATED');
  if (!isAdminRole(session.user.role)) throw new Error('FORBIDDEN');
  return session;
}

function actorOf(session: Awaited<ReturnType<typeof requireAdmin>>) {
  return session.user.email ?? session.user.name ?? session.user.id;
}

function siteUrl() {
  const list = headers();
  const host = list.get('x-forwarded-host') ?? list.get('host');
  const proto = list.get('x-forwarded-proto') ?? (host?.startsWith('localhost') ? 'http' : 'https');
  return getSiteUrl(host ? `${proto}://${host}` : null);
}

// Vuelve a la pagina de la entrada (modo puerta) o a la pestana del admin.
function done(formData: FormData, notice: string): never {
  revalidatePath('/admin');
  const returnTo = String(formData.get('returnTo') ?? '');
  const target = /^\/entradas\/M7-[A-Z0-9]+$/i.test(returnTo) ? returnTo : '/admin?tab=entradas';
  redirect(`${target}${target.includes('?') ? '&' : '?'}notice=${encodeURIComponent(notice)}`);
}

function paymentMethod(value: FormDataEntryValue | null) {
  return String(value ?? '') === 'EFECTIVO' ? 'EFECTIVO' : 'TRANSFERENCIA';
}

/* ------------------------------------------------------------------- puerta */

export async function checkInTicketAction(formData: FormData) {
  const session = await requireAdmin();
  const ticketId = String(formData.get('ticketId') ?? '');
  const ticket = await getTicketById(ticketId);
  if (!ticket) throw new Error('TICKET_NOT_FOUND');
  if (ticket.status === 'CANCELADO' || ticket.status === 'PENDIENTE') {
    done(formData, 'Esta entrada no tiene pagos acreditados: no se registró el ingreso.');
  }

  // En la puerta se puede cobrar el saldo en el momento y dejarla pasar.
  const collect = String(formData.get('collect') ?? '');
  const due = ticket.totalCents - ticket.paidCents;
  if (collect && due > 0) {
    await registerManualPayment(ticket.id, due, paymentMethod(collect), actorOf(session), siteUrl());
  }

  const result = await checkInTicket(ticket.id, actorOf(session));
  done(formData, result.already ? `${ticket.fullName} ya había ingresado hoy.` : `Ingreso registrado: ${ticket.fullName}.`);
}

export async function undoCheckInAction(formData: FormData) {
  await requireAdmin();
  const checkinId = String(formData.get('checkinId') ?? '');
  if (!checkinId) throw new Error('INVALID_CHECKIN');
  await deleteTicketCheckin(checkinId);
  done(formData, 'Ingreso borrado.');
}

/* ------------------------------------------------------------------- pagos */

export async function recordTicketPaymentAction(formData: FormData) {
  const session = await requireAdmin();
  const ticketId = String(formData.get('ticketId') ?? '');
  const amountCents = parseMoneyToCents(String(formData.get('amount') ?? ''));
  if (!ticketId || amountCents <= 0) throw new Error('INVALID_PAYMENT');

  const ticket = await registerManualPayment(ticketId, amountCents, paymentMethod(formData.get('method')), actorOf(session), siteUrl());
  done(formData, `Pago registrado${ticket ? `: ${ticket.fullName}` : ''}.`);
}

export async function deleteTicketPaymentAction(formData: FormData) {
  await requireAdmin();
  const paymentId = String(formData.get('paymentId') ?? '');
  const ticketId = String(formData.get('ticketId') ?? '');
  if (!paymentId || !ticketId) throw new Error('INVALID_PAYMENT');
  // Solo borra pagos cargados a mano: los de Mercado Pago se devuelven desde MP.
  await deleteTicketPayment(paymentId);
  await recalculateTicket(ticketId, siteUrl());
  done(formData, 'Pago borrado.');
}

/* ----------------------------------------------------------------- whatsapp */

export async function resendTicketWhatsAppAction(formData: FormData) {
  await requireAdmin();
  const ticket = await getTicketById(String(formData.get('ticketId') ?? ''));
  if (!ticket) throw new Error('TICKET_NOT_FOUND');
  const result = await notifyTicket(ticket, siteUrl());
  done(
    formData,
    !result
      ? 'Esta entrada no tiene mensaje para mandar.'
      : result.ok
        ? `WhatsApp enviado a ${ticket.fullName}.`
        : `No se pudo mandar el WhatsApp: ${result.error}`
  );
}

/* ------------------------------------------------------------------ edicion */

export async function updateTicketAction(formData: FormData) {
  await requireAdmin();
  const ticketId = String(formData.get('ticketId') ?? '');
  const fullName = String(formData.get('fullName') ?? '').trim();
  const phone = toWhatsAppNumber(String(formData.get('phone') ?? ''));
  const email = String(formData.get('email') ?? '').trim().toLowerCase() || null;
  const notes = String(formData.get('notes') ?? '').trim() || null;
  if (!ticketId || fullName.length < 2) throw new Error('INVALID_TICKET');
  if (!isValidWhatsAppNumber(phone)) done(formData, 'El WhatsApp no es válido: no se guardaron los cambios.');

  await updateTicket(ticketId, { full_name: fullName, phone, email, notes });
  done(formData, 'Entrada actualizada.');
}

export async function toggleCancelTicketAction(formData: FormData) {
  await requireAdmin();
  const ticket = await getTicketById(String(formData.get('ticketId') ?? ''));
  if (!ticket) throw new Error('TICKET_NOT_FOUND');

  const status =
    ticket.status === 'CANCELADO' ? computeTicketStatus(ticket.totalCents, ticket.paidCents) : 'CANCELADO';
  await updateTicket(ticket.id, { status });
  done(formData, status === 'CANCELADO' ? 'Entrada cancelada (libera el lugar).' : 'Entrada reactivada.');
}

export async function createTicketAction(formData: FormData) {
  const session = await requireAdmin();
  const fullName = String(formData.get('fullName') ?? '').trim();
  const phone = toWhatsAppNumber(String(formData.get('phone') ?? ''));
  const email = String(formData.get('email') ?? '').trim().toLowerCase() || null;
  const planValue = String(formData.get('plan') ?? 'FULL');
  const plan = isTicketPlan(planValue) ? planValue : 'FULL';
  const paidCents = parseMoneyToCents(String(formData.get('paid') ?? ''));
  const notes = String(formData.get('notes') ?? '').trim() || null;

  if (fullName.length < 3) done(formData, 'Falta el nombre.');
  if (!isValidWhatsAppNumber(phone)) done(formData, 'El WhatsApp no es válido.');
  if (paidCents > TICKET_PLANS[plan].totalCents) done(formData, 'El monto pagado supera el total de la entrada.');

  const ticket = await createManualTicket(
    { fullName, phone, email, plan, paidCents, method: paymentMethod(formData.get('method')), actor: actorOf(session), notes },
    siteUrl()
  );
  done(formData, `Entrada creada${ticket ? `: ${ticket.code}` : ''}.`);
}
