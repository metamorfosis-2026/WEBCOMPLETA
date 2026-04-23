import { sumConfirmedPayments } from '@/app/lib/metamorfosis';
import { getDashboardData } from '@/app/lib/supabase/views';

export async function getGiftCouponState(userId: string) {
  const user = await getDashboardData(userId);
  if (!user) return null;

  const enrollments = [...user.enrollments].sort((left, right) => {
    return Number(left.edition.sequence) - Number(right.edition.sequence);
  });

  const phaseTwoPaidEnrollment = enrollments.find((enrollment) => {
    const phase = enrollment.phase;
    const isPhaseTwo = phase ? phase.sequence === 2 || phase.title.toLowerCase().includes('fase 2') : false;
    return isPhaseTwo && sumConfirmedPayments(enrollment.payments) > 0;
  });

  const editionSixGift = user.giftInvitations.find((invitation) => invitation.edition?.sequence === 6) ?? null;

  return {
    user,
    enrollments,
    canGiftEditionSix: Boolean(phaseTwoPaidEnrollment),
    editionSixGift,
  };
}
