'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

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
  createEdition,
  createEditionPhase,
  deletePaymentById,
  getEditionById,
  getEditionPhaseById,
  getEnrollmentById,
  getUserById,
  insertPayment,
  insertPointsTransaction,
  insertStatusEvent,
  saveEnrollment,
  updateEdition,
  updateEditionPhase,
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

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildAdminReturnPath({
  editionSlug,
  phaseSlug,
  tab,
  notice,
}: {
  editionSlug?: string | null;
  phaseSlug?: string | null;
  tab?: string | null;
  notice?: string | null;
}) {
  const params = new URLSearchParams();
  if (editionSlug) params.set('edition', editionSlug);
  if (phaseSlug) params.set('phase', phaseSlug);
  if (tab) params.set('tab', tab);
  if (notice) params.set('notice', notice);
  return `/admin?${params.toString()}`;
}

export async function createAdminEdition(formData: FormData) {
  await requireAdminSession();

  const title = String(formData.get('title') ?? '').trim();
  const sequence = Number(String(formData.get('sequence') ?? '').trim());
  const notes = String(formData.get('notes') ?? '').trim() || null;
  const isCurrent = String(formData.get('isCurrent') ?? '') === 'on';

  if (!title || !Number.isFinite(sequence)) {
    throw new Error('INVALID_EDITION');
  }

  const baseSlug = slugify(title) || `edicion-${sequence}`;
  await createEdition({
    title,
    sequence,
    slug: baseSlug,
    notes,
    is_current: isCurrent,
  });

  refreshAdminViews();
  redirect(buildAdminReturnPath({ tab: 'settings', notice: 'Edicion guardada correctamente.' }));
}

export async function createAdminEditionPhase(formData: FormData) {
  await requireAdminSession();

  const editionId = String(formData.get('editionId') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const sequence = Number(String(formData.get('sequence') ?? '').trim());
  const priceCents = parseMoneyToCents(String(formData.get('price') ?? '0'));
  const notes = String(formData.get('notes') ?? '').trim() || null;

  if (!editionId || !title || !Number.isFinite(sequence)) {
    throw new Error('INVALID_PHASE');
  }

  const edition = await getEditionById(editionId);
  if (!edition) throw new Error('NOT_FOUND');

  const baseSlug = `${edition.slug}-${slugify(title) || `fase-${sequence}`}`;
  await createEditionPhase({
    edition_id: editionId,
    title,
    sequence,
    slug: baseSlug,
    price_cents: priceCents,
    notes,
  });

  refreshAdminViews();
  redirect(
    buildAdminReturnPath({
      editionSlug: edition.slug,
      phaseSlug: baseSlug,
      tab: 'settings',
      notice: 'Fase creada correctamente.',
    })
  );
}

export async function updateAdminEdition(formData: FormData) {
  await requireAdminSession();

  const id = String(formData.get('editionId') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const sequence = Number(String(formData.get('sequence') ?? '').trim());
  const notes = String(formData.get('notes') ?? '').trim() || null;
  const isCurrent = String(formData.get('isCurrent') ?? '') === 'on';

  if (!id || !title || !Number.isFinite(sequence)) {
    throw new Error('INVALID_EDITION');
  }

  await updateEdition(id, {
    title,
    sequence,
    notes,
    is_current: isCurrent,
  });

  refreshAdminViews();
  redirect(buildAdminReturnPath({ tab: 'settings', notice: 'Edicion actualizada correctamente.' }));
}

export async function updateAdminEditionPhase(formData: FormData) {
  await requireAdminSession();

  const id = String(formData.get('phaseId') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const sequence = Number(String(formData.get('sequence') ?? '').trim());
  const priceCents = parseMoneyToCents(String(formData.get('price') ?? '0'));
  const notes = String(formData.get('notes') ?? '').trim() || null;

  if (!id || !title || !Number.isFinite(sequence)) {
    throw new Error('INVALID_PHASE');
  }

  await updateEditionPhase(id, {
    title,
    sequence,
    price_cents: priceCents,
    notes,
  });

  refreshAdminViews();
  redirect(buildAdminReturnPath({ tab: 'settings', notice: 'Fase actualizada correctamente.' }));
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
  const phaseIdRaw = String(formData.get('phaseId') ?? '').trim();
  const phaseId = phaseIdRaw || null;
  const status = normalizeEnrollmentStatus(String(formData.get('status') ?? ''));
  const amountDueRaw = String(formData.get('amountDue') ?? '0');
  const currency = String(formData.get('currency') ?? 'ARS').trim().toUpperCase() || 'ARS';
  const notes = String(formData.get('notes') ?? '').trim() || null;
  const returnTab = String(formData.get('returnTab') ?? 'finance').trim() || 'finance';

  if (!userId || !editionId || !phaseId) throw new Error('INVALID_ENROLLMENT');

  const [user, edition, phase] = await Promise.all([
    getUserById(userId),
    getEditionById(editionId),
    getEditionPhaseById(phaseId),
  ]);

  if (!user || !edition || !phase || phase.editionId !== edition.id) throw new Error('NOT_FOUND');

  const parsedAmountDueCents = parseMoneyToCents(amountDueRaw);
  const amountDueCents = parsedAmountDueCents > 0 ? parsedAmountDueCents : Number(phase.priceCents ?? 0);

  await saveEnrollment({
    user_id: userId,
    edition_id: editionId,
    phase_id: phaseId,
    status,
    amount_due_cents: amountDueCents,
    currency,
    notes,
  });

  refreshAdminViews();
  redirect(
    buildAdminReturnPath({
      editionSlug: edition.slug,
      phaseSlug: phase.slug,
      tab: returnTab,
      notice: 'Ficha guardada correctamente.',
    })
  );
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
  const returnTab = String(formData.get('returnTab') ?? 'finance').trim() || 'finance';

  if (!enrollmentId || amountCents <= 0) throw new Error('INVALID_PAYMENT');

  const enrollment = await getEnrollmentById(enrollmentId);

  if (!enrollment) throw new Error('NOT_FOUND');

  const phase = enrollment.phaseId ? await getEditionPhaseById(enrollment.phaseId) : null;
  const edition = await getEditionById(enrollment.editionId);

  if (phase && Number(enrollment.amountDueCents ?? 0) <= 0 && Number(phase.priceCents ?? 0) > 0) {
    await saveEnrollment({
      user_id: enrollment.userId,
      edition_id: enrollment.editionId,
      phase_id: enrollment.phaseId,
      status: enrollment.status,
      amount_due_cents: Number(phase.priceCents ?? 0),
      currency: enrollment.currency,
      notes: enrollment.notes,
    });
  }

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
  if (edition && phase) {
    redirect(
      buildAdminReturnPath({
        editionSlug: edition.slug,
        phaseSlug: phase.slug,
        tab: returnTab,
        notice: 'Pago guardado correctamente.',
      })
    );
  }
}

export async function deletePayment(formData: FormData) {
  await requireAdminSession();

  const paymentId = String(formData.get('paymentId') ?? '').trim();
  const editionSlug = String(formData.get('editionSlug') ?? '').trim() || null;
  const phaseSlug = String(formData.get('phaseSlug') ?? '').trim() || null;
  const returnTab = String(formData.get('returnTab') ?? 'finance').trim() || 'finance';

  if (!paymentId) throw new Error('INVALID_PAYMENT');

  await deletePaymentById(paymentId);
  refreshAdminViews();
  redirect(
    buildAdminReturnPath({
      editionSlug,
      phaseSlug,
      tab: returnTab,
      notice: 'Pago eliminado correctamente.',
    })
  );
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
