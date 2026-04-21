'use server';

import { revalidatePath } from 'next/cache';

import { auth } from '@/auth';
import { prisma } from '@/app/lib/prisma';
import {
  isAdminRole,
  isSuperadminRole,
  normalizeEnrollmentStatus,
  normalizePaymentMethod,
  normalizePaymentStatus,
  normalizeUserStatus,
  parseMoneyToCents,
} from '@/app/lib/metamorfosis';

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

    const current = await prisma.user.findUnique({
      where: { id: currentId },
      select: { referredById: true },
    });

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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true, referredById: true },
  });

  if (!user) throw new Error('NOT_FOUND');
  if (user.status === toStatus) return;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { status: toStatus },
    });

    await tx.userStatusEvent.create({
      data: {
        userId,
        fromStatus: user.status,
        toStatus,
        actorId: session.user.id,
      },
    });

    if (awardReferrer && toStatus === 'FASE_1' && user.referredById) {
      await tx.pointsTransaction.create({
        data: {
          userId: user.referredById,
          points: REF_FASE1_POINTS,
          reason: 'referral_fase1',
          metadata: JSON.stringify({ referredUserId: userId }),
        },
      });

      await tx.user.update({
        where: { id: user.referredById },
        data: { pointsBalance: { increment: REF_FASE1_POINTS } },
      });
    }
  });

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

  const [user, edition] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
    prisma.edition.findUnique({ where: { id: editionId }, select: { id: true } }),
  ]);

  if (!user || !edition) throw new Error('NOT_FOUND');

  await prisma.enrollment.upsert({
    where: {
      userId_editionId: {
        userId,
        editionId,
      },
    },
    update: {
      status,
      amountDueCents,
      currency,
      notes,
    },
    create: {
      userId,
      editionId,
      status,
      amountDueCents,
      currency,
      notes,
    },
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

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { id: true },
  });

  if (!enrollment) throw new Error('NOT_FOUND');

  await prisma.payment.create({
    data: {
      enrollmentId,
      amountCents,
      currency,
      method,
      status,
      reference,
      notes,
      paidAt: paidAtRaw ? new Date(`${paidAtRaw}T12:00:00.000Z`) : new Date(),
      recordedById: session.user.id,
    },
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

  const [user, referrer] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
    referredById
      ? prisma.user.findUnique({ where: { id: referredById }, select: { id: true } })
      : Promise.resolve(null),
  ]);

  if (!user) throw new Error('NOT_FOUND');
  if (referredById && !referrer) throw new Error('REFERRER_NOT_FOUND');

  await assertNoReferralCycle(userId, referredById);

  await prisma.user.update({
    where: { id: userId },
    data: { referredById },
  });

  refreshAdminViews();
}
