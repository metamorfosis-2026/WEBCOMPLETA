import { customAlphabet } from 'nanoid';

import { TICKET_CODE_PREFIX, type TicketPlan, type TicketStatus } from '@/app/lib/entradas';

import { createAdminClient } from './admin';

/*
  Acceso a datos de entradas (tablas de supabase/entradas.sql).
  Siempre con service role: estas tablas tienen RLS sin politicas.
*/

type DbTicket = {
  id: string;
  code: string;
  edition_label: string;
  full_name: string;
  phone: string;
  email: string | null;
  plan: string;
  total_cents: number;
  paid_cents: number;
  status: string;
  source: string | null;
  notes: string | null;
  last_reminder_at: string | null;
  created_at: string;
  updated_at: string;
};

type DbTicketPayment = {
  id: string;
  ticket_id: string;
  installment: number;
  amount_cents: number;
  method: string;
  status: string;
  status_detail: string | null;
  mp_payment_id: string | null;
  payer_email: string | null;
  recorded_by: string | null;
  paid_at: string | null;
  created_at: string;
};

type DbTicketCheckin = {
  id: string;
  ticket_id: string;
  checked_in_by: string | null;
  created_at: string;
};

type DbWhatsAppMessage = {
  id: string;
  ticket_id: string | null;
  direction: string;
  phone: string;
  kind: string | null;
  body: string | null;
  provider: string | null;
  ok: boolean;
  error: string | null;
  external_id: string | null;
  created_at: string;
};

function mapTicket(row: DbTicket) {
  return {
    id: row.id,
    code: row.code,
    editionLabel: row.edition_label,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    plan: (row.plan === 'SPLIT' ? 'SPLIT' : 'FULL') as TicketPlan,
    totalCents: row.total_cents,
    paidCents: row.paid_cents,
    status: row.status as TicketStatus,
    source: row.source,
    notes: row.notes,
    lastReminderAt: row.last_reminder_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPayment(row: DbTicketPayment) {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    installment: row.installment,
    amountCents: row.amount_cents,
    method: row.method,
    status: row.status,
    statusDetail: row.status_detail,
    mpPaymentId: row.mp_payment_id,
    payerEmail: row.payer_email,
    recordedBy: row.recorded_by,
    paidAt: row.paid_at,
    createdAt: row.created_at,
  };
}

function mapCheckin(row: DbTicketCheckin) {
  return { id: row.id, ticketId: row.ticket_id, checkedInBy: row.checked_in_by, createdAt: row.created_at };
}

function mapMessage(row: DbWhatsAppMessage) {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    direction: row.direction,
    phone: row.phone,
    kind: row.kind,
    body: row.body,
    provider: row.provider,
    ok: row.ok,
    error: row.error,
    createdAt: row.created_at,
  };
}

export type Ticket = ReturnType<typeof mapTicket>;
export type TicketPayment = ReturnType<typeof mapPayment>;
export type TicketCheckin = ReturnType<typeof mapCheckin>;
export type WhatsAppMessage = ReturnType<typeof mapMessage>;

function assertNoError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

// Sin 0/O ni 1/I/L: el codigo se dicta y se lee en la puerta.
const generateCodeBody = customAlphabet('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 8);

export function generateTicketCode() {
  return `${TICKET_CODE_PREFIX}-${generateCodeBody()}`;
}

export function normalizeTicketCode(raw: string) {
  return raw.trim().toUpperCase();
}

/* ------------------------------------------------------------------ tickets */

export async function insertTicket(values: {
  edition_label: string;
  full_name: string;
  phone: string;
  email: string | null;
  plan: TicketPlan;
  total_cents: number;
  paid_cents?: number;
  status?: TicketStatus;
  source: string | null;
  notes?: string | null;
}) {
  const supabase = createAdminClient();
  // Reintenta si (muy raramente) el codigo ya existe.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase
      .from('tickets')
      .insert({ ...values, code: generateTicketCode() })
      .select('*')
      .single<DbTicket>();
    if (!error) return mapTicket(data);
    if (!/duplicate key|unique/i.test(error.message)) throw new Error(error.message);
  }
  throw new Error('TICKET_CODE_COLLISION');
}

export async function getTicketByCode(code: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('code', normalizeTicketCode(code))
    .maybeSingle<DbTicket>();
  assertNoError(error);
  return data ? mapTicket(data) : null;
}

export async function getTicketById(id: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('tickets').select('*').eq('id', id).maybeSingle<DbTicket>();
  assertNoError(error);
  return data ? mapTicket(data) : null;
}

// Entrada iniciada y sin pagar del mismo WhatsApp: se reutiliza si la persona
// vuelve a intentar, asi no se llena el admin de duplicados.
export async function findPendingTicketByPhone(phone: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('phone', phone)
    .eq('status', 'PENDIENTE')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<DbTicket>();
  assertNoError(error);
  return data ? mapTicket(data) : null;
}

export async function listTicketsByPhone(phone: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('phone', phone)
    .neq('status', 'CANCELADO')
    .order('created_at', { ascending: false })
    .limit(5);
  assertNoError(error);
  return ((data ?? []) as DbTicket[]).map(mapTicket);
}

export async function listTickets() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('tickets').select('*').order('created_at', { ascending: false });
  assertNoError(error);
  return ((data ?? []) as DbTicket[]).map(mapTicket);
}

export async function listTicketsByStatus(statuses: TicketStatus[]) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('tickets').select('*').in('status', statuses);
  assertNoError(error);
  return ((data ?? []) as DbTicket[]).map(mapTicket);
}

// Lugares ocupados: entradas con al menos un pago acreditado.
export async function countSoldTickets() {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .in('status', ['SENADO', 'PAGADO']);
  assertNoError(error);
  return count ?? 0;
}

export async function updateTicket(id: string, patch: Partial<Omit<DbTicket, 'id' | 'code' | 'created_at'>>) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('tickets').update(patch).eq('id', id).select('*').single<DbTicket>();
  assertNoError(error);
  return mapTicket(data);
}

/*
  Actualiza solo si el estado sigue siendo el que leimos. Si el webhook de
  Mercado Pago y la pagina de "gracias" procesan el mismo pago a la vez, solo
  uno gana y solo ese manda el WhatsApp.
*/
export async function updateTicketIfStatus(
  id: string,
  expectedStatus: TicketStatus,
  patch: Partial<Omit<DbTicket, 'id' | 'code' | 'created_at'>>
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('tickets')
    .update(patch)
    .eq('id', id)
    .eq('status', expectedStatus)
    .select('*');
  assertNoError(error);
  const rows = (data ?? []) as DbTicket[];
  return rows.length ? mapTicket(rows[0]) : null;
}

/* ----------------------------------------------------------------- payments */

export async function listTicketPayments(ticketId?: string) {
  const supabase = createAdminClient();
  let query = supabase.from('ticket_payments').select('*').order('created_at', { ascending: true });
  if (ticketId) query = query.eq('ticket_id', ticketId);
  const { data, error } = await query;
  assertNoError(error);
  return ((data ?? []) as DbTicketPayment[]).map(mapPayment);
}

export async function upsertMercadoPagoPayment(values: {
  ticket_id: string;
  installment: number;
  amount_cents: number;
  status: string;
  status_detail: string | null;
  mp_payment_id: string;
  payer_email: string | null;
  paid_at: string | null;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('ticket_payments')
    .upsert({ ...values, method: 'MERCADO_PAGO' }, { onConflict: 'mp_payment_id' });
  assertNoError(error);
}

export async function insertManualTicketPayment(values: {
  ticket_id: string;
  installment: number;
  amount_cents: number;
  method: 'TRANSFERENCIA' | 'EFECTIVO';
  recorded_by: string | null;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('ticket_payments')
    .insert({ ...values, status: 'approved', paid_at: new Date().toISOString() });
  assertNoError(error);
}

export async function deleteTicketPayment(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from('ticket_payments').delete().eq('id', id).neq('method', 'MERCADO_PAGO');
  assertNoError(error);
}

/* ----------------------------------------------------------------- checkins */

export async function listTicketCheckins(ticketId?: string) {
  const supabase = createAdminClient();
  let query = supabase.from('ticket_checkins').select('*').order('created_at', { ascending: true });
  if (ticketId) query = query.eq('ticket_id', ticketId);
  const { data, error } = await query;
  assertNoError(error);
  return ((data ?? []) as DbTicketCheckin[]).map(mapCheckin);
}

export async function insertTicketCheckin(ticketId: string, checkedInBy: string | null) {
  const supabase = createAdminClient();
  const { error } = await supabase.from('ticket_checkins').insert({ ticket_id: ticketId, checked_in_by: checkedInBy });
  assertNoError(error);
}

export async function deleteTicketCheckin(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from('ticket_checkins').delete().eq('id', id);
  assertNoError(error);
}

/* ----------------------------------------------------------------- whatsapp */

export async function insertWhatsAppMessage(values: {
  ticket_id: string | null;
  direction: 'OUT' | 'IN';
  phone: string;
  kind: string;
  body: string | null;
  provider: string;
  ok: boolean;
  error?: string | null;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from('whatsapp_messages').insert(values);
  assertNoError(error);
}

/*
  Guarda un mensaje recibido. Devuelve null si ese mensaje (mismo id de
  WhatsApp) ya estaba: WhatsApp / Evolution a veces reenvian el webhook y no
  queremos contestar dos veces.
*/
export async function insertIncomingWhatsApp(values: {
  ticket_id: string | null;
  phone: string;
  body: string;
  provider: string;
  external_id: string | null;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .insert({ ...values, direction: 'IN', kind: 'ENTRANTE', ok: true })
    .select('id')
    .single<{ id: string }>();
  if (error) {
    if ((error as { code?: string }).code === '23505') return null;
    throw new Error(error.message);
  }
  return data.id;
}

// Ultimo mensaje recibido de un numero: para esperar a que la persona
// termine de escribir y contestar una sola vez.
export async function getLatestIncomingId(phone: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('id')
    .eq('phone', phone)
    .eq('direction', 'IN')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();
  assertNoError(error);
  return data?.id ?? null;
}

// Conversacion reciente con un numero (lo mas viejo primero).
export async function listConversation(phone: string, sinceIso: string, limit = 20) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .eq('phone', phone)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(limit);
  assertNoError(error);
  return ((data ?? []) as DbWhatsAppMessage[]).map(mapMessage).reverse();
}

export async function listRecentWhatsAppMessages(limit = 500) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  assertNoError(error);
  return ((data ?? []) as DbWhatsAppMessage[]).map(mapMessage);
}

export async function hasSentMessageKind(ticketId: string, kind: string) {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from('whatsapp_messages')
    .select('id', { count: 'exact', head: true })
    .eq('ticket_id', ticketId)
    .eq('direction', 'OUT')
    .eq('kind', kind)
    .eq('ok', true);
  assertNoError(error);
  return (count ?? 0) > 0;
}

export async function countRecentBotReplies(phone: string, sinceIso: string) {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from('whatsapp_messages')
    .select('id', { count: 'exact', head: true })
    .eq('phone', phone)
    .eq('direction', 'OUT')
    .in('kind', ['BOT', 'IA'])
    .gte('created_at', sinceIso);
  assertNoError(error);
  return count ?? 0;
}
