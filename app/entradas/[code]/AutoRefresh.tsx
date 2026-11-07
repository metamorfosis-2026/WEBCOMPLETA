'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Mientras Mercado Pago confirma el pago, recarga la entrada unas cuantas veces.
export function AutoRefresh({ everyMs = 4000, maxTimes = 10 }: { everyMs?: number; maxTimes?: number }) {
  const router = useRouter();

  useEffect(() => {
    let count = 0;
    const timer = window.setInterval(() => {
      count += 1;
      if (count > maxTimes) {
        window.clearInterval(timer);
        return;
      }
      router.refresh();
    }, everyMs);
    return () => window.clearInterval(timer);
  }, [router, everyMs, maxTimes]);

  return null;
}
