'use client';

import { useEffect, useMemo, useState } from 'react';

/*
  Carrusel infinito: se mueve solo, sin que haya que tocar nada.
  - En desktop se frena al pasar el mouse (para poder leer).
  - Al tocar una imagen se abre en grande (lightbox), que es donde
    realmente se lee el testimonio, con salida a Instagram.
*/
export function TestimonialsCarousel({
  imageUrls,
  href,
}: {
  imageUrls: string[];
  href: string;
}) {
  const safeUrls = useMemo(() => imageUrls.filter(Boolean), [imageUrls]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Duplicamos la lista: el track se desplaza -50% y vuelve al inicio
  // exactamente sobre la segunda copia, así el bucle no tiene corte.
  const looped = useMemo(() => [...safeUrls, ...safeUrls], [safeUrls]);

  useEffect(() => {
    if (openIndex === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenIndex(null);
      if (event.key === 'ArrowRight') setOpenIndex((i) => (i === null ? i : (i + 1) % safeUrls.length));
      if (event.key === 'ArrowLeft')
        setOpenIndex((i) => (i === null ? i : (i - 1 + safeUrls.length) % safeUrls.length));
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [openIndex, safeUrls.length]);

  if (safeUrls.length === 0) return null;

  return (
    <>
      <div className="marquee relative">
        {/* Difuminados laterales: el strip se funde con el fondo */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-night to-transparent sm:w-28"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-night to-transparent sm:w-28"
        />

        <div className="marquee-track">
          {looped.map((url, idx) => {
            const realIndex = idx % safeUrls.length;
            return (
              <button
                key={`${url}-${idx}`}
                type="button"
                onClick={() => setOpenIndex(realIndex)}
                className="marquee-item group"
                aria-label={`Abrir testimonio ${realIndex + 1}`}
              >
                <img
                  src={url}
                  alt={`Testimonio ${realIndex + 1}`}
                  className="h-full w-full rounded-[18px] object-contain transition duration-500 group-hover:scale-[1.03]"
                  loading="lazy"
                  draggable={false}
                />
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-7 text-center text-[11px] uppercase tracking-[0.18em] text-ivory/35">
        Tocá cualquiera para leerla completa
      </p>

      {openIndex !== null ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="Testimonio"
        >
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setOpenIndex(null)}
            className="absolute inset-0 h-full w-full cursor-default bg-night/90 backdrop-blur-md"
          />

          <div className="relative flex max-h-full w-full max-w-lg flex-col items-center">
            <img
              src={safeUrls[openIndex]}
              alt={`Testimonio ${openIndex + 1}`}
              className="max-h-[70vh] w-auto max-w-full rounded-[20px] border border-ivory/12 shadow-[0_40px_90px_-40px_rgba(0,0,0,0.95)]"
            />

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setOpenIndex((i) => (i === null ? i : (i - 1 + safeUrls.length) % safeUrls.length))
                }
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ivory/20 text-ivory/70 transition hover:border-celeste/60 hover:text-ivory"
                aria-label="Anterior"
              >
                ←
              </button>

              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center justify-center rounded-full border border-celeste/40 px-6 text-[11px] font-bold uppercase tracking-[0.14em] text-celeste transition hover:bg-celeste/10"
              >
                Ver más en Instagram
              </a>

              <button
                type="button"
                onClick={() => setOpenIndex((i) => (i === null ? i : (i + 1) % safeUrls.length))}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ivory/20 text-ivory/70 transition hover:border-celeste/60 hover:text-ivory"
                aria-label="Siguiente"
              >
                →
              </button>
            </div>

            <p className="mt-4 text-[11px] uppercase tracking-[0.16em] text-ivory/35">
              {openIndex + 1} / {safeUrls.length}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setOpenIndex(null)}
            aria-label="Cerrar"
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-ivory/20 bg-night/60 text-ivory/70 backdrop-blur transition hover:border-ivory/50 hover:text-ivory sm:right-8 sm:top-8"
          >
            ✕
          </button>
        </div>
      ) : null}
    </>
  );
}
