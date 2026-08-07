'use client';

import {
  CTA_LABEL,
  CTA_LINE_BOTTOM,
  CTA_LINE_TOP,
  EDITION_DATE_SHORT,
  EDITION_PLACE,
} from '@/app/lib/inscripcion';

/*
  Barra fija al pie. Siempre visible (sobre todo en celular): es el camino
  mas corto entre "estoy leyendo" y "dejo mis datos".
*/
export function StickyInscripcionBar({ onOpen }: { onOpen: () => void }) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t border-ivory/10 bg-night/90 backdrop-blur-xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="mx-auto flex w-full max-w-3xl items-center gap-5 px-4 py-3 sm:px-5">
        <div className="hidden min-w-0 flex-1 lg:block">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-celeste">Fase 1</p>
          <p className="mt-1 truncate text-[11px] uppercase tracking-[0.14em] text-ivory/40">
            {EDITION_DATE_SHORT} · {EDITION_PLACE}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpen}
          aria-label={CTA_LABEL}
          className="group relative w-full flex-1 overflow-hidden rounded-2xl bg-gradient-to-br from-white via-celeste to-celeste-deep p-[1px] shadow-[0_16px_40px_-16px_rgba(124,201,236,0.85)] transition duration-300 hover:shadow-[0_20px_50px_-14px_rgba(124,201,236,1)] lg:w-auto lg:flex-none"
        >
          {/* Relleno propio: el borde de arriba queda como filete de luz */}
          <span className="relative flex items-center justify-between gap-4 rounded-[15px] bg-celeste px-5 py-2.5">
            {/* Brillo que cruza al pasar el mouse */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent transition-transform duration-700 group-hover:translate-x-full"
            />

            <span className="relative flex min-w-0 flex-col items-start text-left">
              <span className="text-[10px] font-extrabold uppercase leading-none tracking-[0.2em] text-night/60 sm:text-[11px]">
                {CTA_LINE_TOP}
              </span>
              <span className="display-sm mt-1.5 text-[1.05rem] font-bold leading-tight text-night sm:text-[1.3rem]">
                {CTA_LINE_BOTTOM}
              </span>
            </span>

            <span
              aria-hidden="true"
              className="relative flex h-10 w-10 flex-none items-center justify-center rounded-full bg-night text-celeste transition-transform duration-300 group-hover:translate-x-1"
            >
              →
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}
