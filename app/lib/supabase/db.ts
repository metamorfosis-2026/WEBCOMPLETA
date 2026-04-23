import { nanoid } from 'nanoid';

import {
  DEFAULT_SUPERADMIN_EMAIL,
  normalizeEmail,
  normalizeRole,
  normalizeUserStatus,
} from '@/app/lib/metamorfosis';

import { createAdminClient } from './admin';

export type DbUser = {
  id: string;
  supabase_auth_id: string | null;
  name: string | null;
  email: string | null;
  image: string | null;
  email_verified: string | null;
  role: string;
  status: string;
  referral_code: string | null;
  referred_by_id: string | null;
  points_balance: number;
  created_at: string;
  updated_at: string;
};

export type DbEdition = {
  id: string;
  slug: string;
  title: string;
  sequence: number;
  is_current: boolean;
  starts_at: string | null;
  ends_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DbEnrollment = {
  id: string;
  user_id: string;
  edition_id: string;
  status: string;
  amount_due_cents: number;
  currency: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DbPayment = {
  id: string;
  enrollment_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  method: string;
  reference: string | null;
  notes: string | null;
  paid_at: string;
  recorded_by_id: string | null;
  created_at: string;
  updated_at: string;
};

export type DbStatusEvent = {
  id: string;
  user_id: string;
  from_status: string;
  to_status: string;
  actor_id: string | null;
  created_at: string;
};

export type DbPointsTransaction = {
  id: string;
  user_id: string;
  points: number;
  reason: string;
  metadata: string | null;
  created_at: string;
};

function assertNoError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export function mapUser(user: DbUser) {
  return {
    id: user.id,
    supabaseAuthId: user.supabase_auth_id,
    name: user.name,
    email: user.email,
    image: user.image,
    emailVerified: user.email_verified ? new Date(user.email_verified) : null,
    role: normalizeRole(user.role),
    status: normalizeUserStatus(user.status),
    referralCode: user.referral_code,
    referredById: user.referred_by_id,
    pointsBalance: Number(user.points_balance ?? 0),
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

export function mapEdition(edition: DbEdition) {
  return {
    id: edition.id,
    slug: edition.slug,
    title: edition.title,
    sequence: Number(edition.sequence),
    isCurrent: Boolean(edition.is_current),
    startsAt: edition.starts_at,
    endsAt: edition.ends_at,
    notes: edition.notes,
    createdAt: edition.created_at,
    updatedAt: edition.updated_at,
  };
}

export function mapEnrollment(enrollment: DbEnrollment) {
  return {
    id: enrollment.id,
    userId: enrollment.user_id,
    editionId: enrollment.edition_id,
    status: enrollment.status,
    amountDueCents: Number(enrollment.amount_due_cents ?? 0),
    currency: enrollment.currency,
    notes: enrollment.notes,
    createdAt: enrollment.created_at,
    updatedAt: enrollment.updated_at,
  };
}

export function mapPayment(payment: DbPayment) {
  return {
    id: payment.id,
    enrollmentId: payment.enrollment_id,
    amountCents: Number(payment.amount_cents ?? 0),
    currency: payment.currency,
    status: payment.status,
    method: payment.method,
    reference: payment.reference,
    notes: payment.notes,
    paidAt: payment.paid_at,
    recordedById: payment.recorded_by_id,
    createdAt: payment.created_at,
    updatedAt: payment.updated_at,
  };
}

export function mapStatusEvent(event: DbStatusEvent) {
  return {
    id: event.id,
    userId: event.user_id,
    fromStatus: event.from_status,
    toStatus: event.to_status,
    actorId: event.actor_id,
    createdAt: event.created_at,
  };
}

export function mapPointsTransaction(transaction: DbPointsTransaction) {
  return {
    id: transaction.id,
    userId: transaction.user_id,
    points: Number(transaction.points ?? 0),
    reason: transaction.reason,
    metadata: transaction.metadata,
    createdAt: transaction.created_at,
  };
}

export async function getUserById(id: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle<DbUser>();
  assertNoError(error);
  return data ? mapUser(data) : null;
}

export async function getUserByReferralCode(referralCode: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('referral_code', referralCode)
    .maybeSingle<DbUser>();
  assertNoError(error);
  return data ? mapUser(data) : null;
}

export async function getUserByAuthIdOrEmail(supabaseAuthId: string, email: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .or(`supabase_auth_id.eq.${supabaseAuthId},email.eq.${email}`)
    .limit(1)
    .maybeSingle<DbUser>();
  assertNoError(error);
  return data ? mapUser(data) : null;
}

export async function updateUser(id: string, patch: Partial<DbUser>) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('users').update(patch).eq('id', id).select('*').single<DbUser>();
  assertNoError(error);
  return mapUser(data);
}

export async function createUser(values: Partial<DbUser> & { email: string; role: string; status: string }) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('users')
    .insert(values)
    .select('*')
    .single<DbUser>();
  assertNoError(error);
  return mapUser(data);
}

export async function listUsers() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: true });
  assertNoError(error);
  return (data ?? []).map(mapUser);
}

export async function listEditions() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('editions').select('*').order('sequence', { ascending: true });
  assertNoError(error);
  return (data ?? []).map(mapEdition);
}

export async function getEditionById(id: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('editions').select('*').eq('id', id).maybeSingle<DbEdition>();
  assertNoError(error);
  return data ? mapEdition(data) : null;
}

export async function listEnrollments() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('enrollments').select('*').order('created_at', { ascending: true });
  assertNoError(error);
  return (data ?? []).map(mapEnrollment);
}

export async function listPayments() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('payments').select('*').order('paid_at', { ascending: false });
  assertNoError(error);
  return (data ?? []).map(mapPayment);
}

export async function listStatusEventsByUserId(userId: string, limit = 8) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('user_status_events')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  assertNoError(error);
  return (data ?? []).map(mapStatusEvent);
}

export async function listPointsTransactionsByUserId(userId: string, limit = 8) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('points_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  assertNoError(error);
  return (data ?? []).map(mapPointsTransaction);
}

export async function listReferralsByUserIds(userIds: string[]) {
  if (!userIds.length) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .in('referred_by_id', userIds)
    .order('created_at', { ascending: false });
  assertNoError(error);
  return (data ?? []).map(mapUser);
}

export async function getReferredUser(userId: string | null) {
  if (!userId) return null;
  return getUserById(userId);
}

export async function getEnrollmentById(id: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('enrollments').select('*').eq('id', id).maybeSingle<DbEnrollment>();
  assertNoError(error);
  return data ? mapEnrollment(data) : null;
}

export async function getEnrollmentByUserAndEdition(userId: string, editionId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('enrollments')
    .select('*')
    .eq('user_id', userId)
    .eq('edition_id', editionId)
    .maybeSingle<DbEnrollment>();
  assertNoError(error);
  return data ? mapEnrollment(data) : null;
}

export async function upsertEdition(values: Partial<DbEdition> & { slug: string; title: string; sequence: number }) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('editions')
    .upsert(values, { onConflict: 'slug' })
    .select('*')
    .single<DbEdition>();
  assertNoError(error);
  return mapEdition(data);
}

export async function insertStatusEvent(values: Partial<DbStatusEvent> & { user_id: string; from_status: string; to_status: string }) {
  const supabase = createAdminClient();
  const { error } = await supabase.from('user_status_events').insert(values);
  assertNoError(error);
}

export async function insertPointsTransaction(values: Partial<DbPointsTransaction> & { user_id: string; points: number; reason: string }) {
  const supabase = createAdminClient();
  const { error } = await supabase.from('points_transactions').insert(values);
  assertNoError(error);
}

export async function saveEnrollment(values: Partial<DbEnrollment> & { user_id: string; edition_id: string }) {
  const existing = await getEnrollmentByUserAndEdition(values.user_id, values.edition_id);
  const supabase = createAdminClient();

  if (existing) {
    const { data, error } = await supabase
      .from('enrollments')
      .update(values)
      .eq('id', existing.id)
      .select('*')
      .single<DbEnrollment>();
    assertNoError(error);
    return mapEnrollment(data);
  }

  const { data, error } = await supabase.from('enrollments').insert(values).select('*').single<DbEnrollment>();
  assertNoError(error);
  return mapEnrollment(data);
}

export async function insertPayment(values: Partial<DbPayment> & { enrollment_id: string; amount_cents: number }) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('payments').insert(values).select('*').single<DbPayment>();
  assertNoError(error);
  return mapPayment(data);
}

export async function generateReferralCode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = nanoid(10);
    const existing = await getUserByReferralCode(code);
    if (!existing) return code;
  }

  throw new Error('REFERRAL_CODE_GENERATION_FAILED');
}

function getAdminEmails() {
  const emails = new Set<string>();

  for (const email of (process.env.ADMIN_EMAILS ?? '').split(',')) {
    const normalized = normalizeEmail(email);
    if (normalized) emails.add(normalized);
  }

  return emails;
}

function getSuperadminEmails() {
  const emails = new Set<string>([DEFAULT_SUPERADMIN_EMAIL]);

  const owner = normalizeEmail(process.env.OWNER_EMAIL);
  if (owner) emails.add(owner);

  for (const email of (process.env.SUPERADMIN_EMAILS ?? '').split(',')) {
    const normalized = normalizeEmail(email);
    if (normalized) emails.add(normalized);
  }

  return emails;
}

function getConfiguredRole(email: string) {
  if (getSuperadminEmails().has(email)) return 'SUPERADMIN' as const;
  if (getAdminEmails().has(email)) return 'ADMIN' as const;
  return null;
}

export function resolveRole(email: string, currentRole?: string | null) {
  const configuredRole = getConfiguredRole(email);
  if (configuredRole) return configuredRole;

  const normalizedCurrent = normalizeRole(currentRole);
  if (normalizedCurrent === 'SUPERADMIN' || normalizedCurrent === 'ADMIN') {
    return normalizedCurrent;
  }

  return 'USER' as const;
}
