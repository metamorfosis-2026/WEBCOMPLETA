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

export type DbEditionPhase = {
  id: string;
  edition_id: string;
  slug: string;
  title: string;
  sequence: number;
  price_cents: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DbEnrollment = {
  id: string;
  user_id: string;
  edition_id: string;
  phase_id: string | null;
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

export type DbGiftInvitation = {
  id: string;
  giver_user_id: string;
  edition_id: string;
  recipient_first_name: string;
  recipient_last_name: string;
  recipient_phone: string;
  created_at: string;
  updated_at: string;
};

export type DbWeeklyTask = {
  id: string;
  edition_id: string | null;
  phase_id: string | null;
  phase_sequence: number | null;
  assigned_user_id: string | null;
  week_number: number;
  title: string;
  summary: string | null;
  body: string | null;
  resource_url: string | null;
  due_at: string | null;
  is_published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type DbNewsPost = {
  id: string;
  title: string;
  body: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  audience: string;
  edition_id: string | null;
  phase_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_pinned: boolean;
  is_published: boolean;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
};

export type DbSignup = {
  id: string;
  full_name: string;
  phone: string;
  social: string | null;
  edition_label: string | null;
  source: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DbGreekGod = {
  id: string;
  slug: string;
  name: string;
  epithet: string | null;
  description: string | null;
  pdf_url: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type DbUserAchievement = {
  id: string;
  user_id: string;
  edition_id: string | null;
  phase_id: string | null;
  title: string;
  description: string | null;
  icon: string | null;
  awarded_by_id: string | null;
  awarded_at: string;
  created_at: string;
  updated_at: string;
};

export type DbUserGodAssignment = {
  id: string;
  user_id: string;
  god_id: string;
  custom_pdf_url: string | null;
  notes: string | null;
  assigned_by_id: string | null;
  assigned_at: string;
  created_at: string;
  updated_at: string;
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
    phaseId: enrollment.phase_id,
    status: enrollment.status,
    amountDueCents: Number(enrollment.amount_due_cents ?? 0),
    currency: enrollment.currency,
    notes: enrollment.notes,
    createdAt: enrollment.created_at,
    updatedAt: enrollment.updated_at,
  };
}

export function mapEditionPhase(phase: DbEditionPhase) {
  return {
    id: phase.id,
    editionId: phase.edition_id,
    slug: phase.slug,
    title: phase.title,
    sequence: Number(phase.sequence),
    priceCents: Number(phase.price_cents ?? 0),
    notes: phase.notes,
    createdAt: phase.created_at,
    updatedAt: phase.updated_at,
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

export function mapGiftInvitation(invitation: DbGiftInvitation) {
  return {
    id: invitation.id,
    giverUserId: invitation.giver_user_id,
    editionId: invitation.edition_id,
    recipientFirstName: invitation.recipient_first_name,
    recipientLastName: invitation.recipient_last_name,
    recipientPhone: invitation.recipient_phone,
    createdAt: invitation.created_at,
    updatedAt: invitation.updated_at,
  };
}

export function mapWeeklyTask(task: DbWeeklyTask) {
  return {
    id: task.id,
    editionId: task.edition_id,
    phaseId: task.phase_id,
    phaseSequence: task.phase_sequence != null ? Number(task.phase_sequence) : null,
    assignedUserId: task.assigned_user_id,
    weekNumber: Number(task.week_number ?? 1),
    title: task.title,
    summary: task.summary,
    body: task.body,
    resourceUrl: task.resource_url,
    dueAt: task.due_at,
    isPublished: Boolean(task.is_published),
    sortOrder: Number(task.sort_order ?? 0),
    createdAt: task.created_at,
    updatedAt: task.updated_at,
  };
}

export function mapNewsPost(post: DbNewsPost) {
  return {
    id: post.id,
    title: post.title,
    body: post.body,
    imageUrl: post.image_url,
    ctaLabel: post.cta_label,
    ctaUrl: post.cta_url,
    audience: post.audience,
    editionId: post.edition_id,
    phaseId: post.phase_id,
    startsAt: post.starts_at,
    endsAt: post.ends_at,
    isPinned: Boolean(post.is_pinned),
    isPublished: Boolean(post.is_published),
    createdById: post.created_by_id,
    createdAt: post.created_at,
    updatedAt: post.updated_at,
  };
}

export function mapSignup(signup: DbSignup) {
  return {
    id: signup.id,
    fullName: signup.full_name,
    phone: signup.phone,
    social: signup.social,
    editionLabel: signup.edition_label,
    source: signup.source,
    status: signup.status,
    notes: signup.notes,
    createdAt: signup.created_at,
    updatedAt: signup.updated_at,
  };
}

export function mapGreekGod(god: DbGreekGod) {
  return {
    id: god.id,
    slug: god.slug,
    name: god.name,
    epithet: god.epithet,
    description: god.description,
    pdfUrl: god.pdf_url,
    imageUrl: god.image_url,
    sortOrder: Number(god.sort_order ?? 0),
    isActive: Boolean(god.is_active),
    createdAt: god.created_at,
    updatedAt: god.updated_at,
  };
}

export function mapUserAchievement(achievement: DbUserAchievement) {
  return {
    id: achievement.id,
    userId: achievement.user_id,
    editionId: achievement.edition_id,
    phaseId: achievement.phase_id,
    title: achievement.title,
    description: achievement.description,
    icon: achievement.icon,
    awardedById: achievement.awarded_by_id,
    awardedAt: achievement.awarded_at,
    createdAt: achievement.created_at,
    updatedAt: achievement.updated_at,
  };
}

export function mapUserGodAssignment(assignment: DbUserGodAssignment) {
  return {
    id: assignment.id,
    userId: assignment.user_id,
    godId: assignment.god_id,
    customPdfUrl: assignment.custom_pdf_url,
    notes: assignment.notes,
    assignedById: assignment.assigned_by_id,
    assignedAt: assignment.assigned_at,
    createdAt: assignment.created_at,
    updatedAt: assignment.updated_at,
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

export async function listEditionPhases() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('edition_phases').select('*').order('sequence', { ascending: true });
  assertNoError(error);
  return (data ?? []).map(mapEditionPhase);
}

export async function getEditionById(id: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('editions').select('*').eq('id', id).maybeSingle<DbEdition>();
  assertNoError(error);
  return data ? mapEdition(data) : null;
}

export async function getEditionPhaseById(id: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('edition_phases')
    .select('*')
    .eq('id', id)
    .maybeSingle<DbEditionPhase>();
  assertNoError(error);
  return data ? mapEditionPhase(data) : null;
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

export async function listGiftInvitations() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('gift_invitations')
    .select('*')
    .order('created_at', { ascending: false });
  assertNoError(error);
  return (data ?? []).map(mapGiftInvitation);
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
    .is('phase_id', null)
    .maybeSingle<DbEnrollment>();
  assertNoError(error);
  return data ? mapEnrollment(data) : null;
}

export async function getEnrollmentByUserEditionAndPhase(
  userId: string,
  editionId: string,
  phaseId: string | null
) {
  if (!phaseId) {
    return getEnrollmentByUserAndEdition(userId, editionId);
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('enrollments')
    .select('*')
    .eq('user_id', userId)
    .eq('edition_id', editionId)
    .eq('phase_id', phaseId)
    .maybeSingle<DbEnrollment>();
  assertNoError(error);
  return data ? mapEnrollment(data) : null;
}

export async function getGiftInvitationByGiverAndEdition(giverUserId: string, editionId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('gift_invitations')
    .select('*')
    .eq('giver_user_id', giverUserId)
    .eq('edition_id', editionId)
    .maybeSingle<DbGiftInvitation>();
  assertNoError(error);
  return data ? mapGiftInvitation(data) : null;
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

export async function createEdition(values: {
  slug: string;
  title: string;
  sequence: number;
  is_current?: boolean;
  notes?: string | null;
}) {
  const supabase = createAdminClient();

  if (values.is_current) {
    const { error: resetError } = await supabase.from('editions').update({ is_current: false }).neq('id', '');
    assertNoError(resetError);
  }

  const { data, error } = await supabase.from('editions').insert(values).select('*').single<DbEdition>();
  assertNoError(error);
  return mapEdition(data);
}

export async function updateEdition(
  id: string,
  values: Partial<DbEdition> & { title?: string; sequence?: number; notes?: string | null; is_current?: boolean }
) {
  const supabase = createAdminClient();

  if (values.is_current) {
    const { error: resetError } = await supabase.from('editions').update({ is_current: false }).neq('id', id);
    assertNoError(resetError);
  }

  const { data, error } = await supabase.from('editions').update(values).eq('id', id).select('*').single<DbEdition>();
  assertNoError(error);
  return mapEdition(data);
}

export async function createEditionPhase(values: {
  edition_id: string;
  slug: string;
  title: string;
  sequence: number;
  price_cents?: number;
  notes?: string | null;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('edition_phases')
    .insert(values)
    .select('*')
    .single<DbEditionPhase>();
  assertNoError(error);
  return mapEditionPhase(data);
}

export async function updateEditionPhase(
  id: string,
  values: Partial<DbEditionPhase> & {
    title?: string;
    sequence?: number;
    price_cents?: number;
    notes?: string | null;
  }
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('edition_phases')
    .update(values)
    .eq('id', id)
    .select('*')
    .single<DbEditionPhase>();
  assertNoError(error);
  return mapEditionPhase(data);
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

export async function saveEnrollment(
  values: Partial<DbEnrollment> & { user_id: string; edition_id: string; phase_id?: string | null }
) {
  const existing = await getEnrollmentByUserEditionAndPhase(
    values.user_id,
    values.edition_id,
    values.phase_id ?? null
  );
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

export async function deletePaymentById(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from('payments').delete().eq('id', id);
  assertNoError(error);
}

export async function saveGiftInvitation(
  values: Partial<DbGiftInvitation> & {
    giver_user_id: string;
    edition_id: string;
    recipient_first_name: string;
    recipient_last_name: string;
    recipient_phone: string;
  }
) {
  const existing = await getGiftInvitationByGiverAndEdition(values.giver_user_id, values.edition_id);
  const supabase = createAdminClient();

  if (existing) {
    const { data, error } = await supabase
      .from('gift_invitations')
      .update(values)
      .eq('id', existing.id)
      .select('*')
      .single<DbGiftInvitation>();
    assertNoError(error);
    return mapGiftInvitation(data);
  }

  const { data, error } = await supabase
    .from('gift_invitations')
    .insert(values)
    .select('*')
    .single<DbGiftInvitation>();
  assertNoError(error);
  return mapGiftInvitation(data);
}

export async function listWeeklyTasks() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('weekly_tasks')
    .select('*')
    .order('week_number', { ascending: true })
    .order('sort_order', { ascending: true });
  assertNoError(error);
  return (data ?? []).map(mapWeeklyTask);
}

export async function getWeeklyTaskById(id: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('weekly_tasks').select('*').eq('id', id).maybeSingle<DbWeeklyTask>();
  assertNoError(error);
  return data ? mapWeeklyTask(data) : null;
}

export async function insertWeeklyTask(values: Partial<DbWeeklyTask> & { title: string }) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('weekly_tasks').insert(values).select('*').single<DbWeeklyTask>();
  assertNoError(error);
  return mapWeeklyTask(data);
}

export async function updateWeeklyTask(id: string, values: Partial<DbWeeklyTask>) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('weekly_tasks')
    .update(values)
    .eq('id', id)
    .select('*')
    .single<DbWeeklyTask>();
  assertNoError(error);
  return mapWeeklyTask(data);
}

export async function deleteWeeklyTaskById(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from('weekly_tasks').delete().eq('id', id);
  assertNoError(error);
}

export async function listNewsPosts() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('news_posts')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });
  assertNoError(error);
  return (data ?? []).map(mapNewsPost);
}

export async function getNewsPostById(id: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('news_posts').select('*').eq('id', id).maybeSingle<DbNewsPost>();
  assertNoError(error);
  return data ? mapNewsPost(data) : null;
}

export async function insertNewsPost(values: Partial<DbNewsPost> & { title: string }) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('news_posts').insert(values).select('*').single<DbNewsPost>();
  assertNoError(error);
  return mapNewsPost(data);
}

export async function updateNewsPost(id: string, values: Partial<DbNewsPost>) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('news_posts')
    .update(values)
    .eq('id', id)
    .select('*')
    .single<DbNewsPost>();
  assertNoError(error);
  return mapNewsPost(data);
}

export async function deleteNewsPostById(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from('news_posts').delete().eq('id', id);
  assertNoError(error);
}

export async function listSignups() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('signups')
    .select('*')
    .order('created_at', { ascending: false });
  assertNoError(error);
  return (data ?? []).map(mapSignup);
}

export async function insertSignup(values: Partial<DbSignup> & { full_name: string; phone: string }) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('signups').insert(values).select('*').single<DbSignup>();
  assertNoError(error);
  return mapSignup(data);
}

export async function updateSignup(id: string, values: Partial<DbSignup>) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('signups')
    .update(values)
    .eq('id', id)
    .select('*')
    .single<DbSignup>();
  assertNoError(error);
  return mapSignup(data);
}

export async function deleteSignupById(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from('signups').delete().eq('id', id);
  assertNoError(error);
}

export async function listGreekGods() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('greek_gods')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  assertNoError(error);
  return (data ?? []).map(mapGreekGod);
}

export async function getGreekGodById(id: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('greek_gods').select('*').eq('id', id).maybeSingle<DbGreekGod>();
  assertNoError(error);
  return data ? mapGreekGod(data) : null;
}

export async function insertGreekGod(values: Partial<DbGreekGod> & { slug: string; name: string }) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('greek_gods').insert(values).select('*').single<DbGreekGod>();
  assertNoError(error);
  return mapGreekGod(data);
}

export async function updateGreekGod(id: string, values: Partial<DbGreekGod>) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('greek_gods')
    .update(values)
    .eq('id', id)
    .select('*')
    .single<DbGreekGod>();
  assertNoError(error);
  return mapGreekGod(data);
}

export async function deleteGreekGodById(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from('greek_gods').delete().eq('id', id);
  assertNoError(error);
}

export async function listUserAchievements() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('user_achievements')
    .select('*')
    .order('awarded_at', { ascending: false });
  assertNoError(error);
  return (data ?? []).map(mapUserAchievement);
}

export async function listUserAchievementsByUserId(userId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('user_achievements')
    .select('*')
    .eq('user_id', userId)
    .order('awarded_at', { ascending: false });
  assertNoError(error);
  return (data ?? []).map(mapUserAchievement);
}

export async function insertUserAchievement(
  values: Partial<DbUserAchievement> & { user_id: string; title: string }
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('user_achievements')
    .insert(values)
    .select('*')
    .single<DbUserAchievement>();
  assertNoError(error);
  return mapUserAchievement(data);
}

export async function deleteUserAchievementById(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from('user_achievements').delete().eq('id', id);
  assertNoError(error);
}

export async function listUserGodAssignments() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('user_god_assignments')
    .select('*')
    .order('assigned_at', { ascending: false });
  assertNoError(error);
  return (data ?? []).map(mapUserGodAssignment);
}

export async function getUserGodAssignmentByUserId(userId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('user_god_assignments')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle<DbUserGodAssignment>();
  assertNoError(error);
  return data ? mapUserGodAssignment(data) : null;
}

export async function upsertUserGodAssignment(
  values: Partial<DbUserGodAssignment> & { user_id: string; god_id: string }
) {
  const supabase = createAdminClient();
  const existing = await getUserGodAssignmentByUserId(values.user_id);

  if (existing) {
    const { data, error } = await supabase
      .from('user_god_assignments')
      .update(values)
      .eq('id', existing.id)
      .select('*')
      .single<DbUserGodAssignment>();
    assertNoError(error);
    return mapUserGodAssignment(data);
  }

  const { data, error } = await supabase
    .from('user_god_assignments')
    .insert(values)
    .select('*')
    .single<DbUserGodAssignment>();
  assertNoError(error);
  return mapUserGodAssignment(data);
}

export async function deleteUserGodAssignmentByUserId(userId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from('user_god_assignments').delete().eq('user_id', userId);
  assertNoError(error);
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
