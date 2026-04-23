'use server';

import { revalidatePath } from 'next/cache';

import { auth } from '@/auth';
import {
  isAdminRole,
  isSuperadminRole,
  normalizeEnrollmentStatus,
  normalizePaymentMethod,
  normalizePaymentStatus,
  normalizeUserStatus,
  parseMoneyToCents,
} from '@/app/lib/metamorfosis';
import {
  getEditionById,
  getEnrollmentById,
  getUserById,
  insertPayment,
  insertPointsTransaction,
  insertStatusEvent,
  saveEnrollment,
  updateUser,
} from '@/app/lib/supabase/db';

const REF_FASE1_POINTS = 100;

async function requireAdminSession() {
  const session = await auth();

  if (!session?.user?.id) throw new Error('UNAUTHENTICATED');
  if (!isAdminRole(session.user.role)) throw new Error('FORBIDDEN');

  return session;
}

async function assertNoReferralCycle(userId: string, referredById: string | null) {
  let currentId = referredById;

  while (currentId) {
    if (currentId === userId) {
      throw new Error('REFERRAL_CYCLE');
    }

    const current = await getUserById(currentId);

    currentId = current?.referredById ?? null;
  }
}

function refreshAdminViews() {
  revalidatePath('/admin');
  revalidatePath('/dashboard');
}

export async function updateUserStatus(formData: FormData) {
  const session = await requireAdminSession();

  const userId = String(formData.get('userId') ?? '').trim();
  const toStatus = normalizeUserStatus(String(formData.get('toStatus') ?? ''));
  const awardReferrer = String(formData.get('awardReferrer') ?? '') === 'on';

  if (!userId) throw new Error('INVALID_USER');

  const user = await getUserById(userId);

  if (!user) throw new Error('NOT_FOUND');
  if (user.status === toStatus) return;

  await updateUser(userId, { status: toStatus });
  await insertStatusEvent({
    user_id: userId,
    from_status: user.status,
    to_status: toStatus,
    actor_id: session.user.id,
  });

  if (awardReferrer && toStatus === 'FASE_1' && user.referredById) {
    const referrer = await getUserById(user.referredById);

    if (referrer) {
      await insertPointsTransaction({
        user_id: referrer.id,
        points: REF_FASE1_POINTS,
        reason: 'referral_fase1',
        metadata: JSON.stringify({ referredUserId: userId }),
      });

      await updateUser(referrer.id, {
        points_balance: referrer.pointsBalance + REF_FASE1_POINTS,
      });
    }
  }

  refreshAdminViews();
}

export async function upsertEnrollment(formData: FormData) {
  await requireAdminSession();

  const userId = String(formData.get('userId') ?? '').trim();
  const editionId = String(formData.get('editionId') ?? '').trim();
  const status = normalizeEnrollmentStatus(String(formData.get('status') ?? ''));
  const amountDueCents = parseMoneyToCents(String(formData.get('amountDue') ?? '0'));
  const currency = String(formData.get('currency') ?? 'ARS').trim().toUpperCase() || 'ARS';
  const notes = String(formData.get('notes') ?? '').trim() || null;

  if (!userId || !editionId) throw new Error('INVALID_ENROLLMENT');

  const [user, edition] = await Promise.all([getUserById(userId), getEditionById(editionId)]);

  if (!user || !edition) throw new Error('NOT_FOUND');

  await saveEnrollment({
    user_id: userId,
    edition_id: editionId,
    status,
    amount_due_cents: amountDueCents,
    currency,
    notes,
  });

  refreshAdminViews();
}

export async function recordPayment(formData: FormData) {
  const session = await requireAdminSession();

  const enrollmentId = String(formData.get('enrollmentId') ?? '').trim();
  const amountCents = parseMoneyToCents(String(formData.get('amount') ?? '0'));
  const currency = String(formData.get('currency') ?? 'ARS').trim().toUpperCase() || 'ARS';
  const method = normalizePaymentMethod(String(formData.get('method') ?? ''));
  const status = normalizePaymentStatus(String(formData.get('status') ?? ''));
  const reference = String(formData.get('reference') ?? '').trim() || null;
  const notes = String(formData.get('notes') ?? '').trim() || null;
  const paidAtRaw = String(formData.get('paidAt') ?? '').trim();

  if (!enrollmentId || amountCents <= 0) throw new Error('INVALID_PAYMENT');

  const enrollment = await getEnrollmentById(enrollmentId);

  if (!enrollment) throw new Error('NOT_FOUND');

  await insertPayment({
    enrollment_id: enrollmentId,
    amount_cents: amountCents,
    currency,
    method,
    status,
    reference,
    notes,
    paid_at: paidAtRaw ? new Date(`${paidAtRaw}T12:00:00.000Z`).toISOString() : new Date().toISOString(),
    recorded_by_id: session.user.id,
  });

  refreshAdminViews();
}

export async function linkUserReferrer(formData: FormData) {
  const session = await requireAdminSession();

  if (!isSuperadminRole(session.user.role)) {
    throw new Error('FORBIDDEN');
  }

  const userId = String(formData.get('userId') ?? '').trim();
  const referredByRaw = String(formData.get('referredById') ?? '').trim();
  const referredById = referredByRaw || null;

  if (!userId) throw new Error('INVALID_USER');
  if (referredById === userId) throw new Error('SELF_REFERRAL');

  const [user, referrer] = await Promise.all([getUserById(userId), referredById ? getUserById(referredById) : null]);

  if (!user) throw new Error('NOT_FOUND');
  if (referredById && !referrer) throw new Error('REFERRER_NOT_FOUND');

  await assertNoReferralCycle(userId, referredById);

  await updateUser(userId, { referred_by_id: referredById });

  refreshAdminViews();
}
