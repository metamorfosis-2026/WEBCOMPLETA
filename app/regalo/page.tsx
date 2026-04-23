import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { GiftCouponPanel } from '@/app/components/GiftCouponPanel';
import { getGiftCouponState } from '@/app/lib/gifts';

export default async function GiftPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?from=${encodeURIComponent('/regalo')}`);
  }

  const giftState = await getGiftCouponState(session.user.id);
  if (!giftState?.canGiftEditionSix) {
    redirect('/dashboard');
  }

  return (
    <main className="min-h-screen text-white">
      <div className="mx-auto w-full max-w-5xl px-5 py-10">
        <GiftCouponPanel giftInvitation={giftState.editionSixGift} />
      </div>
    </main>
  );
}
