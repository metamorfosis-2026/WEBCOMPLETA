'use server';

import { revalidatePath } from 'next/cache';

import { auth } from '@/auth';
import { normalizePaymentStatus } from '@/app/lib/metamorfosis';
import {
  getEditionById,
  getUserById,
  listEditionPhases,
  listEditions,
  listEnrollments,
  listPayments,
  saveGiftInvitation,
} from '@/app/lib/supabase/db';

function normalizePhone(value: string) {
  return value.replace(/[^\d+\s()-]/g, '').trim();
}

export async function saveGiftRecipient(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('UNAUTHENTICATED');
  }

  const firstName = String(formData.get('recipientFirstName') ?? '').trim();
  const lastName = String(formData.get('recipientLastName') ?? '').trim();
  const phone = normalizePhone(String(formData.get('recipientPhone') ?? ''));

  if (!firstName || !lastName || !phone) {
    throw new Error('INVALID_GIFT_RECIPIENT');
  }

  const [user, editions, phases, enrollments, payments] = await Promise.all([
    getUserById(session.user.id),
    listEditions(),
    listEditionPhases(),
    listEnrollments(),
    listPayments(),
  ]);

  if (!user) {
    throw new Error('NOT_FOUND');
  }

  const editionSix = editions.find((edition) => edition.sequence === 6);
  if (!editionSix) {
    throw new Error('EDITION_NOT_FOUND');
  }

  const phaseById = new Map(phases.map((phase) => [phase.id, phase]));
  const userEnrollments = enrollments.filter((enrollment) => enrollment.userId === user.id);
  const canGiftInvitation = userEnrollments.some((enrollment) => {
    const phase = enrollment.phaseId ? phaseById.get(enrollment.phaseId) ?? null : null;
    const isPhaseTwo = phase ? phase.sequence === 2 || phase.title.toLowerCase().includes('fase 2') : false;
    if (!isPhaseTwo) return false;

    return payments.some(
      (payment) =>
        payment.enrollmentId === enrollment.id &&
        normalizePaymentStatus(payment.status) === 'CONFIRMADO' &&
        Number(payment.amountCents ?? 0) > 0
    );
  });

  if (!canGiftInvitation) {
    throw new Error('GIFT_NOT_ALLOWED');
  }

  const edition = await getEditionById(editionSix.id);
  if (!edition) {
    throw new Error('EDITION_NOT_FOUND');
  }

  await saveGiftInvitation({
    giver_user_id: user.id,
    edition_id: edition.id,
    recipient_first_name: firstName,
    recipient_last_name: lastName,
    recipient_phone: phone,
  });

  revalidatePath('/dashboard');
  revalidatePath('/regalo');
  revalidatePath('/admin');
}
