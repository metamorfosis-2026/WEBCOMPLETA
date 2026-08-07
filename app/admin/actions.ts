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
  normalizeSignupStatus,
  normalizeUserStatus,
  parseMoneyToCents,
  type UserStatus,
} from '@/app/lib/metamorfosis';
import {
  createEdition,
  createEditionPhase,
  deleteGreekGodById,
  deleteNewsPostById,
  deletePaymentById,
  deleteSignupById,
  deleteUserAchievementById,
  deleteUserGodAssignmentByUserId,
  deleteWeeklyTaskById,
  getEditionById,
  getEditionPhaseById,
  getEnrollmentById,
  getEnrollmentByUserEditionAndPhase,
  getGreekGodById,
  getNewsPostById,
  getUserById,
  getWeeklyTaskById,
  insertGreekGod,
  insertNewsPost,
  insertPayment,
  insertPointsTransaction,
  insertStatusEvent,
  insertUserAchievement,
  insertWeeklyTask,
  listEditionPhases,
  listEnrollments,
  saveEnrollment,
  updateEdition,
  updateEditionPhase,
  updateGreekGod,
  updateNewsPost,
  updateSignup,
  updateUser,
  updateWeeklyTask,
  upsertUserGodAssignment,
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

  const isFree = String(formData.get('isFree') ?? '') === 'on';
  const parsedAmountDueCents = parseMoneyToCents(amountDueRaw);
  const amountDueCents = isFree
    ? 0
    : parsedAmountDueCents > 0
    ? parsedAmountDueCents
    : Number(phase.priceCents ?? 0);

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

export async function updatePayment(formData: FormData) {
  await requireAdminSession();

  const paymentId = String(formData.get('paymentId') ?? '').trim();
  const amountCents = parseMoneyToCents(String(formData.get('amount') ?? '0'));
  const currency = String(formData.get('currency') ?? 'ARS').trim().toUpperCase() || 'ARS';
  const method = normalizePaymentMethod(String(formData.get('method') ?? ''));
  const status = normalizePaymentStatus(String(formData.get('status') ?? ''));
  const reference = String(formData.get('reference') ?? '').trim() || null;
  const notes = String(formData.get('notes') ?? '').trim() || null;
  const paidAtRaw = String(formData.get('paidAt') ?? '').trim();
  const editionSlug = String(formData.get('editionSlug') ?? '').trim() || null;
  const phaseSlug = String(formData.get('phaseSlug') ?? '').trim() || null;
  const returnTab = String(formData.get('returnTab') ?? 'finance').trim() || 'finance';

  if (!paymentId || amountCents <= 0) throw new Error('INVALID_PAYMENT');

  const supabase = (await import('@/app/lib/supabase/admin')).createAdminClient();
  const { error } = await supabase
    .from('payments')
    .update({
      amount_cents: amountCents,
      currency,
      method,
      status,
      reference,
      notes,
      paid_at: paidAtRaw ? new Date(`${paidAtRaw}T12:00:00.000Z`).toISOString() : new Date().toISOString(),
    })
    .eq('id', paymentId);
  if (error) throw new Error(error.message);

  refreshAdminViews();
  redirect(
    buildAdminReturnPath({
      editionSlug,
      phaseSlug,
      tab: returnTab,
      notice: 'Pago actualizado correctamente.',
    })
  );
}

export async function createWeeklyTask(formData: FormData) {
  await requireAdminSession();

  const scope = String(formData.get('scope') ?? 'GENERAL').trim().toUpperCase();
  const title = String(formData.get('title') ?? '').trim();
  const summary = String(formData.get('summary') ?? '').trim() || null;
  const body = String(formData.get('body') ?? '').trim() || null;
  const resourceUrl = String(formData.get('resourceUrl') ?? '').trim() || null;
  const weekNumber = Number(String(formData.get('weekNumber') ?? '1').trim()) || 1;
  const dueAtRaw = String(formData.get('dueAt') ?? '').trim();
  const isPublished = String(formData.get('isPublished') ?? 'on') === 'on';

  if (!title) throw new Error('INVALID_TASK');

  let phaseSequence: number | null = null;
  let assignedUserId: string | null = null;

  if (scope === 'PERSONAL') {
    assignedUserId = String(formData.get('assignedUserId') ?? '').trim() || null;
    if (!assignedUserId) throw new Error('INVALID_TASK');
  } else {
    const phaseSeqRaw = String(formData.get('phaseSequence') ?? '').trim();
    if (!phaseSeqRaw) throw new Error('INVALID_TASK');
    phaseSequence = Number(phaseSeqRaw);
    if (!Number.isFinite(phaseSequence) || phaseSequence <= 0) throw new Error('INVALID_TASK');
  }

  await insertWeeklyTask({
    edition_id: null,
    phase_id: null,
    phase_sequence: phaseSequence,
    assigned_user_id: assignedUserId,
    title,
    summary,
    body,
    resource_url: resourceUrl,
    week_number: weekNumber,
    due_at: dueAtRaw ? new Date(`${dueAtRaw}T12:00:00.000Z`).toISOString() : null,
    is_published: isPublished,
    sort_order: 0,
  });

  refreshAdminViews();
  redirect(buildAdminReturnPath({ tab: 'aula', notice: 'Tarea creada correctamente.' }));
}

export async function updateWeeklyTaskAction(formData: FormData) {
  await requireAdminSession();

  const id = String(formData.get('taskId') ?? '').trim();
  if (!id) throw new Error('INVALID_TASK');

  const title = String(formData.get('title') ?? '').trim();
  const summary = String(formData.get('summary') ?? '').trim() || null;
  const body = String(formData.get('body') ?? '').trim() || null;
  const resourceUrl = String(formData.get('resourceUrl') ?? '').trim() || null;
  const weekNumber = Number(String(formData.get('weekNumber') ?? '1').trim()) || 1;
  const dueAtRaw = String(formData.get('dueAt') ?? '').trim();
  const isPublished = String(formData.get('isPublished') ?? '') === 'on';
  const phaseSeqRaw = String(formData.get('phaseSequence') ?? '').trim();
  const assignedUserIdRaw = String(formData.get('assignedUserId') ?? '').trim();

  const existing = await getWeeklyTaskById(id);
  if (!existing) throw new Error('NOT_FOUND');

  await updateWeeklyTask(id, {
    title: title || existing.title,
    summary,
    body,
    resource_url: resourceUrl,
    week_number: weekNumber,
    phase_sequence: phaseSeqRaw ? Number(phaseSeqRaw) || null : null,
    assigned_user_id: assignedUserIdRaw || null,
    due_at: dueAtRaw ? new Date(`${dueAtRaw}T12:00:00.000Z`).toISOString() : null,
    is_published: isPublished,
  });

  refreshAdminViews();
  redirect(buildAdminReturnPath({ tab: 'aula', notice: 'Tarea actualizada.' }));
}

export async function deleteWeeklyTaskAction(formData: FormData) {
  await requireAdminSession();
  const id = String(formData.get('taskId') ?? '').trim();
  if (!id) throw new Error('INVALID_TASK');

  await deleteWeeklyTaskById(id);
  refreshAdminViews();
  redirect(buildAdminReturnPath({ tab: 'aula', notice: 'Tarea eliminada.' }));
}

export async function createNewsPost(formData: FormData) {
  const session = await requireAdminSession();

  const title = String(formData.get('title') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim() || null;
  const imageUrl = String(formData.get('imageUrl') ?? '').trim() || null;
  const ctaLabel = String(formData.get('ctaLabel') ?? '').trim() || null;
  const ctaUrl = String(formData.get('ctaUrl') ?? '').trim() || null;
  const audience = String(formData.get('audience') ?? 'ALL').trim().toUpperCase() || 'ALL';
  const editionId = String(formData.get('editionId') ?? '').trim() || null;
  const phaseId = String(formData.get('phaseId') ?? '').trim() || null;
  const isPinned = String(formData.get('isPinned') ?? '') === 'on';
  const isPublished = String(formData.get('isPublished') ?? 'on') === 'on';

  if (!title) throw new Error('INVALID_NEWS');

  await insertNewsPost({
    title,
    body,
    image_url: imageUrl,
    cta_label: ctaLabel,
    cta_url: ctaUrl,
    audience,
    edition_id: editionId,
    phase_id: phaseId,
    is_pinned: isPinned,
    is_published: isPublished,
    created_by_id: session.user.id,
  });

  refreshAdminViews();
  redirect(buildAdminReturnPath({ tab: 'news', notice: 'Noticia publicada.' }));
}

export async function updateNewsPostAction(formData: FormData) {
  await requireAdminSession();

  const id = String(formData.get('newsId') ?? '').trim();
  if (!id) throw new Error('INVALID_NEWS');

  const existing = await getNewsPostById(id);
  if (!existing) throw new Error('NOT_FOUND');

  const title = String(formData.get('title') ?? '').trim() || existing.title;
  const body = String(formData.get('body') ?? '').trim() || null;
  const imageUrl = String(formData.get('imageUrl') ?? '').trim() || null;
  const ctaLabel = String(formData.get('ctaLabel') ?? '').trim() || null;
  const ctaUrl = String(formData.get('ctaUrl') ?? '').trim() || null;
  const isPinned = String(formData.get('isPinned') ?? '') === 'on';
  const isPublished = String(formData.get('isPublished') ?? '') === 'on';

  await updateNewsPost(id, {
    title,
    body,
    image_url: imageUrl,
    cta_label: ctaLabel,
    cta_url: ctaUrl,
    is_pinned: isPinned,
    is_published: isPublished,
  });

  refreshAdminViews();
  redirect(buildAdminReturnPath({ tab: 'news', notice: 'Noticia actualizada.' }));
}

export async function deleteNewsPostAction(formData: FormData) {
  await requireAdminSession();
  const id = String(formData.get('newsId') ?? '').trim();
  if (!id) throw new Error('INVALID_NEWS');

  await deleteNewsPostById(id);
  refreshAdminViews();
  redirect(buildAdminReturnPath({ tab: 'news', notice: 'Noticia eliminada.' }));
}

export async function updateSignupAction(formData: FormData) {
  await requireAdminSession();

  const id = String(formData.get('signupId') ?? '').trim();
  if (!id) throw new Error('INVALID_SIGNUP');

  const status = normalizeSignupStatus(String(formData.get('status') ?? ''));
  const notes = String(formData.get('notes') ?? '').trim() || null;

  await updateSignup(id, { status, notes });

  refreshAdminViews();
  redirect(buildAdminReturnPath({ tab: 'signups', notice: 'Inscripto actualizado.' }));
}

export async function deleteSignupAction(formData: FormData) {
  await requireAdminSession();

  const id = String(formData.get('signupId') ?? '').trim();
  if (!id) throw new Error('INVALID_SIGNUP');

  await deleteSignupById(id);
  refreshAdminViews();
  redirect(buildAdminReturnPath({ tab: 'signups', notice: 'Inscripto eliminado.' }));
}

export async function createGreekGod(formData: FormData) {
  await requireAdminSession();

  const name = String(formData.get('name') ?? '').trim();
  const epithet = String(formData.get('epithet') ?? '').trim() || null;
  const description = String(formData.get('description') ?? '').trim() || null;
  const pdfUrl = String(formData.get('pdfUrl') ?? '').trim() || null;
  const imageUrl = String(formData.get('imageUrl') ?? '').trim() || null;
  const sortOrder = Number(String(formData.get('sortOrder') ?? '0').trim()) || 0;

  if (!name) throw new Error('INVALID_GOD');

  await insertGreekGod({
    name,
    slug: slugify(name),
    epithet,
    description,
    pdf_url: pdfUrl,
    image_url: imageUrl,
    sort_order: sortOrder,
    is_active: true,
  });

  refreshAdminViews();
  redirect(buildAdminReturnPath({ tab: 'gods', notice: 'Dios cargado correctamente.' }));
}

export async function updateGreekGodAction(formData: FormData) {
  await requireAdminSession();

  const id = String(formData.get('godId') ?? '').trim();
  if (!id) throw new Error('INVALID_GOD');

  const existing = await getGreekGodById(id);
  if (!existing) throw new Error('NOT_FOUND');

  const name = String(formData.get('name') ?? '').trim() || existing.name;
  const epithet = String(formData.get('epithet') ?? '').trim() || null;
  const description = String(formData.get('description') ?? '').trim() || null;
  const pdfUrl = String(formData.get('pdfUrl') ?? '').trim() || null;
  const imageUrl = String(formData.get('imageUrl') ?? '').trim() || null;
  const sortOrder = Number(String(formData.get('sortOrder') ?? String(existing.sortOrder)).trim()) || 0;
  const isActive = String(formData.get('isActive') ?? '') === 'on';

  await updateGreekGod(id, {
    name,
    epithet,
    description,
    pdf_url: pdfUrl,
    image_url: imageUrl,
    sort_order: sortOrder,
    is_active: isActive,
  });

  refreshAdminViews();
  redirect(buildAdminReturnPath({ tab: 'gods', notice: 'Dios actualizado.' }));
}

export async function deleteGreekGodAction(formData: FormData) {
  await requireAdminSession();
  const id = String(formData.get('godId') ?? '').trim();
  if (!id) throw new Error('INVALID_GOD');

  await deleteGreekGodById(id);
  refreshAdminViews();
  redirect(buildAdminReturnPath({ tab: 'gods', notice: 'Dios eliminado.' }));
}

export async function assignGodToUser(formData: FormData) {
  const session = await requireAdminSession();

  const userId = String(formData.get('userId') ?? '').trim();
  const godIdRaw = String(formData.get('godId') ?? '').trim();
  const customPdfUrl = String(formData.get('customPdfUrl') ?? '').trim() || null;
  const notes = String(formData.get('notes') ?? '').trim() || null;

  if (!userId) throw new Error('INVALID_USER');

  if (!godIdRaw) {
    await deleteUserGodAssignmentByUserId(userId);
    refreshAdminViews();
    redirect(buildAdminReturnPath({ tab: 'gods', notice: 'Asignacion eliminada.' }));
    return;
  }

  const god = await getGreekGodById(godIdRaw);
  if (!god) throw new Error('GOD_NOT_FOUND');

  await upsertUserGodAssignment({
    user_id: userId,
    god_id: godIdRaw,
    custom_pdf_url: customPdfUrl,
    notes,
    assigned_by_id: session.user.id,
  });

  refreshAdminViews();
  redirect(buildAdminReturnPath({ tab: 'gods', notice: 'Dios asignado.' }));
}

export async function setUserStage(formData: FormData) {
  const session = await requireAdminSession();

  const userId = String(formData.get('userId') ?? '').trim();
  const editionId = String(formData.get('editionId') ?? '').trim();
  const phaseSequenceRaw = String(formData.get('phaseSequence') ?? '').trim();
  const stageStatus = String(formData.get('stageStatus') ?? '').trim().toUpperCase();

  if (!userId || !editionId || !phaseSequenceRaw || !stageStatus) {
    throw new Error('INVALID_STAGE');
  }

  const phaseSequence = Number(phaseSequenceRaw);
  if (!Number.isFinite(phaseSequence) || phaseSequence <= 0) {
    throw new Error('INVALID_STAGE');
  }

  const [user, edition, allPhases] = await Promise.all([
    getUserById(userId),
    getEditionById(editionId),
    listEditionPhases(),
  ]);

  if (!user) throw new Error('USER_NOT_FOUND');
  if (!edition) throw new Error('EDITION_NOT_FOUND');

  const targetPhase = allPhases.find(
    (phase) => phase.editionId === editionId && phase.sequence === phaseSequence
  );
  if (!targetPhase) throw new Error('PHASE_NOT_FOUND_FOR_EDITION');

  let enrollmentStatus: 'CURSANDO' | 'FINALIZADO' | 'CANCELADO';
  switch (stageStatus) {
    case 'CURSANDO':
      enrollmentStatus = 'CURSANDO';
      break;
    case 'FINALIZADA':
    case 'FINALIZADO':
      enrollmentStatus = 'FINALIZADO';
      break;
    case 'ABANDONO':
    case 'CANCELADO':
      enrollmentStatus = 'CANCELADO';
      break;
    default:
      throw new Error('INVALID_STAGE_STATUS');
  }

  await saveEnrollment({
    user_id: userId,
    edition_id: editionId,
    phase_id: targetPhase.id,
    status: enrollmentStatus,
    amount_due_cents: Number(targetPhase.priceCents ?? 0),
    currency: 'ARS',
  });

  let newGlobalStatus: UserStatus = user.status;
  if (stageStatus === 'ABANDONO' || stageStatus === 'CANCELADO') {
    newGlobalStatus = 'ABANDONO';
  } else if (enrollmentStatus === 'FINALIZADO' && phaseSequence >= 3) {
    newGlobalStatus = 'EGRESADO';
  } else if (enrollmentStatus === 'CURSANDO') {
    if (phaseSequence === 1) newGlobalStatus = 'FASE_1';
    else if (phaseSequence === 2) newGlobalStatus = 'FASE_2';
    else if (phaseSequence === 3) newGlobalStatus = 'FASE_3';
    else newGlobalStatus = 'PROCESO_ACTIVO';
  } else if (enrollmentStatus === 'FINALIZADO') {
    if (phaseSequence === 1) newGlobalStatus = 'FASE_1';
    else if (phaseSequence === 2) newGlobalStatus = 'FASE_2';
  }

  if (newGlobalStatus !== user.status) {
    await updateUser(userId, { status: newGlobalStatus });
    await insertStatusEvent({
      user_id: userId,
      from_status: user.status,
      to_status: newGlobalStatus,
      actor_id: session.user.id,
    });
  }

  refreshAdminViews();
}

export async function setUserEditionProgress(formData: FormData) {
  const session = await requireAdminSession();

  const userId = String(formData.get('userId') ?? '').trim();
  const editionId = String(formData.get('editionId') ?? '').trim();
  if (!userId || !editionId) throw new Error('INVALID_PROGRESS');

  const [user, edition, allPhases] = await Promise.all([
    getUserById(userId),
    getEditionById(editionId),
    listEditionPhases(),
  ]);

  if (!user) throw new Error('USER_NOT_FOUND');
  if (!edition) throw new Error('EDITION_NOT_FOUND');

  const editionPhases = allPhases.filter((phase) => phase.editionId === editionId);

  type Stage = 'SIN_CURSAR' | 'CURSANDO' | 'FINALIZADA' | 'ABANDONO';
  function parseStage(value: FormDataEntryValue | null): Stage {
    const upper = String(value ?? '').trim().toUpperCase();
    if (upper === 'CURSANDO' || upper === 'FINALIZADA' || upper === 'ABANDONO') {
      return upper as Stage;
    }
    return 'SIN_CURSAR';
  }

  const stages: Record<1 | 2 | 3, Stage> = {
    1: parseStage(formData.get('phase1')),
    2: parseStage(formData.get('phase2')),
    3: parseStage(formData.get('phase3')),
  };

  for (const seq of [1, 2, 3] as const) {
    const stage = stages[seq];
    const targetPhase = editionPhases.find((phase) => phase.sequence === seq);
    if (!targetPhase) continue;

    if (stage === 'SIN_CURSAR') {
      const existing = await getEnrollmentByUserEditionAndPhase(
        userId,
        editionId,
        targetPhase.id
      );
      if (existing) {
        await saveEnrollment({
          user_id: userId,
          edition_id: editionId,
          phase_id: targetPhase.id,
          status: 'PENDIENTE',
          amount_due_cents: existing.amountDueCents,
          currency: existing.currency,
          notes: existing.notes,
        });
      }
      continue;
    }

    const enrollmentStatus =
      stage === 'CURSANDO' ? 'CURSANDO' : stage === 'FINALIZADA' ? 'FINALIZADO' : 'CANCELADO';

    await saveEnrollment({
      user_id: userId,
      edition_id: editionId,
      phase_id: targetPhase.id,
      status: enrollmentStatus,
      amount_due_cents: Number(targetPhase.priceCents ?? 0),
      currency: 'ARS',
    });
  }

  const allEnrollments = await listEnrollments();
  const userEnrolls = allEnrollments.filter((entry) => entry.userId === userId);

  let bestSeq = 0;
  let bestType: 'CURSANDO' | 'FINALIZADO' | 'CANCELADO' | null = null;

  for (const entry of userEnrolls) {
    const phase = allPhases.find((candidate) => candidate.id === entry.phaseId);
    if (!phase) continue;
    const status = String(entry.status).toUpperCase();
    if (!['CURSANDO', 'FINALIZADO', 'CANCELADO'].includes(status)) continue;
    if (
      phase.sequence > bestSeq ||
      (phase.sequence === bestSeq && status === 'FINALIZADO' && bestType !== 'FINALIZADO')
    ) {
      bestSeq = phase.sequence;
      bestType = status as 'CURSANDO' | 'FINALIZADO' | 'CANCELADO';
    }
  }

  let newGlobalStatus: UserStatus = 'INTERESADO';
  if (bestSeq === 3 && bestType === 'FINALIZADO') newGlobalStatus = 'EGRESADO';
  else if (bestSeq === 3 && bestType === 'CURSANDO') newGlobalStatus = 'FASE_3';
  else if (bestSeq === 3 && bestType === 'CANCELADO') newGlobalStatus = 'ABANDONO';
  else if (bestSeq === 2 && bestType === 'CANCELADO') newGlobalStatus = 'ABANDONO';
  else if (bestSeq === 2) newGlobalStatus = 'FASE_2';
  else if (bestSeq === 1 && bestType === 'CANCELADO') newGlobalStatus = 'ABANDONO';
  else if (bestSeq === 1) newGlobalStatus = 'FASE_1';

  if (newGlobalStatus !== user.status) {
    await updateUser(userId, { status: newGlobalStatus });
    await insertStatusEvent({
      user_id: userId,
      from_status: user.status,
      to_status: newGlobalStatus,
      actor_id: session.user.id,
    });
  }

  refreshAdminViews();
}

export async function createUserAchievement(formData: FormData) {
  const session = await requireAdminSession();

  const userId = String(formData.get('userId') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  const icon = String(formData.get('icon') ?? '').trim() || null;
  const editionId = String(formData.get('editionId') ?? '').trim() || null;
  const phaseId = String(formData.get('phaseId') ?? '').trim() || null;

  if (!userId || !title) throw new Error('INVALID_ACHIEVEMENT');

  await insertUserAchievement({
    user_id: userId,
    title,
    description,
    icon,
    edition_id: editionId,
    phase_id: phaseId,
    awarded_by_id: session.user.id,
  });

  refreshAdminViews();
  redirect(buildAdminReturnPath({ tab: 'finance', notice: 'Logro agregado.' }));
}

export async function deleteUserAchievement(formData: FormData) {
  await requireAdminSession();
  const id = String(formData.get('achievementId') ?? '').trim();
  if (!id) throw new Error('INVALID_ACHIEVEMENT');

  await deleteUserAchievementById(id);
  refreshAdminViews();
  redirect(buildAdminReturnPath({ tab: 'finance', notice: 'Logro eliminado.' }));
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
