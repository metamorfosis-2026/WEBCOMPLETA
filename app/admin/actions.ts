'use server';

import { auth } from '@/auth';
import { prisma } from '@/app/lib/prisma';

const REF_FASE1_POINTS = 100;

function normalizeStatus(value: string) {
  const v = value.trim().toUpperCase();
  const allowed = new Set(['INTERESADO', 'FASE_1', 'PROCESO_ACTIVO', 'EGRESADO']);
  return allowed.has(v) ? v : 'INTERESADO';
}

export async function updateUserStatus(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('UNAUTHENTICATED');
  if (session.user.role !== 'ADMIN') throw new Error('FORBIDDEN');

  const userId = String(formData.get('userId') ?? '').trim();
  const toStatus = normalizeStatus(String(formData.get('toStatus') ?? ''));
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

    // Puntos por hito (ética: reconocimiento simbólico)
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
}
