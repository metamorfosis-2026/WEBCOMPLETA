'use client';

import { useEffect, useState } from 'react';

/*
  Fondo con movimiento, en dos niveles:

  - spline: la escena 3D de Spline (WebGL). Se carga en compu y tambien en
    celulares capaces (4+ nucleos, 4+ GB si el navegador lo informa, WebGL,
    sin ahorro de datos). En pantallas chicas se dibuja a media resolucion y
    se agranda: queda detras de un degradé oscuro, asi que no se nota y el
    celular hace la cuarta parte del trabajo.
  - motion: halos celestes que se mueven con CSS (casi no consume). Es lo que
    se ve mientras carga Spline y donde Spline no conviene: navegadores
    internos de Instagram/TikTok/Facebook (de donde llega la gente de los
    anuncios; ahi el 3D puede trabar o cerrar la pagina), equipos de gama
    baja o con ahorro de datos. Con "reducir movimiento" quedan quietos.

  El visor viene del paquete @splinetool/viewer (lo sirve Vercel junto con el
  resto del sitio) y se pide recien cuando la pagina termino de cargar, para
  que no compita con el contenido.
*/

const IN_APP_BROWSER = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|TikTok|musical_ly|Bytedance|Line\/|Snapchat/i;

type Mode = 'spline' | 'motion';

function pickMode(): Mode {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };

  if (IN_APP_BROWSER.test(nav.userAgent)) return 'motion';
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 'motion';
  if (nav.connection?.saveData) return 'motion';
  if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency < 4) return 'motion';
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory < 4) return 'motion';

  try {
    const canvas = document.createElement('canvas');
    if (!(canvas.getContext('webgl2') || canvas.getContext('webgl'))) return 'motion';
  } catch {
    return 'motion';
  }

  return 'spline';
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
  // null hasta montar: el servidor no sabe que equipo es (y asi no hay diferencias al hidratar).
  const [mode, setMode] = useState<Mode | null>(null);
  const [ready, setReady] = useState(false);
  const [lowRes, setLowRes] = useState(false);

  useEffect(() => {
    const picked = pickMode();
    setMode(picked);
    if (picked !== 'spline') return;
    setLowRes(!window.matchMedia('(min-width: 1024px)').matches);

    let cancelled = false;
    const cancelIdle = whenPageIsIdle(() => {
      import('@splinetool/viewer')
        .then(() => {
          if (!cancelled) setReady(true);
        })
        .catch(() => {
          // Si el visor no carga, quedan los halos con movimiento.
        });
    });

    return () => {
      cancelled = true;
      cancelIdle();
    };
  }, []);

  return (
    <div aria-hidden="true" className={className}>
      {mode && !ready ? <div className="bg-motion" /> : null}
      {ready ? (
        lowRes ? (
          // Media resolucion agrandada al doble: misma imagen, un cuarto de pixeles.
          <div className="origin-top-left" style={{ width: '50%', height: '50%', transform: 'scale(2)' }}>
            <spline-viewer url={scene} />
          </div>
        ) : (
          <spline-viewer url={scene} />
        )
      ) : null}
    </div>
  );
}
