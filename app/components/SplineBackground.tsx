'use client';

import { useEffect, useState } from 'react';

/*
  Fondo 3D de Spline, solo donde se lo banca el equipo.

  La escena más el motor 3D pesan varios MB y usan WebGL: en celulares de
  gama baja y en los navegadores internos de Instagram/TikTok/Facebook (de
  donde llega la gente de los anuncios) traban o cierran la página. Ahí no se
  carga nada y queda el degradé que la página ya tiene detrás.

  El visor viene del paquete @splinetool/viewer (lo sirve Vercel junto con el
  resto del sitio) y se pide recién cuando la página terminó de cargar, para
  que no compita con el contenido.
*/

const IN_APP_BROWSER = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|TikTok|musical_ly|Bytedance|Line\/|Snapchat/i;

function canRunSpline() {
  if (typeof window === 'undefined') return false;

  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };

  if (IN_APP_BROWSER.test(nav.userAgent)) return false;
  if (!window.matchMedia?.('(min-width: 1024px) and (pointer: fine)').matches) return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  if (nav.connection?.saveData) return false;
  if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency < 4) return false;
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory < 4) return false;

  try {
    const canvas = document.createElement('canvas');
    if (!(canvas.getContext('webgl2') || canvas.getContext('webgl'))) return false;
  } catch {
    return false;
  }

  return true;
}

function whenPageIsIdle(callback: () => void) {
  let idleId: number | undefined;
  let timeoutId: number | undefined;

  const schedule = () => {
    // Safari no tiene requestIdleCallback.
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(callback, { timeout: 3000 });
    } else {
      timeoutId = window.setTimeout(callback, 1500);
    }
  };

  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule, { once: true });

  return () => {
    window.removeEventListener('load', schedule);
    if (idleId !== undefined) window.cancelIdleCallback(idleId);
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  };
}

export function SplineBackground({
  scene,
  className,
}: {
  scene: string;
  className?: string;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!canRunSpline()) return;

    let cancelled = false;
    const cancelIdle = whenPageIsIdle(() => {
      import('@splinetool/viewer')
        .then(() => {
          if (!cancelled) setReady(true);
        })
        .catch(() => {
          // Si el visor no carga, queda el degradé de fondo.
        });
    });

    return () => {
      cancelled = true;
      cancelIdle();
    };
  }, []);

  return (
    <div aria-hidden="true" className={className}>
      {ready ? <spline-viewer url={scene} /> : null}
    </div>
  );
}
