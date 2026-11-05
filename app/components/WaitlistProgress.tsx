'use client';

import { useEffect, useState } from 'react';

import type { WaitlistPublicState } from '@/app/api/waitlist/route';
import { WAITLIST_MAX, WAITLIST_MIN } from '@/app/lib/inscripcion';

/*
  Prueba social + urgencia junto al formulario:
  - pocos anotados: mensaje sin numero ("grupo en formacion").
  - entre el umbral y el minimo: "ya se sumaron X, faltan Y" (efecto meta cercana).
  - minimo alcanzado: "quedan Z lugares" (escasez).
  - cupo lleno: lista de reserva.
*/
export function WaitlistProgress({ className = '' }: { className?: string }) {
  const [state, setState] = useState<WaitlistPublicState | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/waitlist')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: WaitlistPublicState | null) => {
        if (alive && data) setState(data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const phase = state?.phase ?? 'forming';

  let headline: string;
  let detail: string;
  let percent: number | null = null;

  if (state?.phase === 'filling') {
    headline = `Ya se sumaron ${state.count} personas`;
    detail = `Faltan ${state.missing} para confirmar el fin de semana`;
    percent = Math.round((state.count / WAITLIST_MIN) * 100);
  } else if (state?.phase === 'confirmed') {
    headline = `Quedan ${state.left} lugares`;
    detail = `Grupo confirmado · máximo ${WAITLIST_MAX} personas`;
    percent = Math.round((state.count / WAITLIST_MAX) * 100);
  } else if (phase === 'full') {
    headline = 'Cupo completo';
    detail = 'Anotate igual: quedás primero en la lista de reserva';
  } else {
    headline = 'Grupo en formación';
    detail = `Confirmamos la fecha al llegar a ${WAITLIST_MIN} lugares · máximo ${WAITLIST_MAX}`;
  }

  return (
    <div
      className={`rounded-2xl border border-celeste/25 bg-celeste/[0.06] px-4 py-3.5 ${className}`}
      aria-live="polite"
    >
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className="relative flex h-2.5 w-2.5 flex-none">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-celeste opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-celeste" />
        </span>
        <p className="text-[15px] font-semibold leading-snug text-ivory">{headline}</p>
      </div>
      <p className="mt-1.5 pl-5 text-[13px] leading-relaxed text-ivory/55">{detail}</p>
      {percent !== null ? (
        <div className="ml-5 mt-3 h-1.5 overflow-hidden rounded-full bg-ivory/10">
          <div
            className="h-full rounded-full bg-celeste transition-[width] duration-700"
            style={{ width: `${Math.max(6, Math.min(100, percent))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
