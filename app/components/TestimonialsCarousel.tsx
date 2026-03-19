'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function TestimonialsCarousel({
  imageUrls,
  href,
}: {
  imageUrls: string[];
  href: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const rafRef = useRef<number | null>(null);
  const isAutoScrollingRef = useRef(false);
  const activeIndexRef = useRef(0);
  const hasUserInteractedRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isInView, setIsInView] = useState(false);

  const safeUrls = useMemo(() => imageUrls.filter(Boolean), [imageUrls]);

  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, safeUrls.length);
    setActiveIndex((prev) => clamp(prev, 0, Math.max(0, safeUrls.length - 1)));
  }, [safeUrls.length]);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  const scrollToIndex = (nextIndex: number) => {
    const idx = clamp(nextIndex, 0, Math.max(0, safeUrls.length - 1));
    const target = itemRefs.current[idx];
    if (target) {
      isAutoScrollingRef.current = true;
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      window.setTimeout(() => {
        isAutoScrollingRef.current = false;
      }, 700);
    }
    setActiveIndex(idx);
  };

  const updateActiveFromScroll = () => {
    const track = trackRef.current;
    if (!track) return;

    const center = track.scrollLeft + track.clientWidth / 2;
    let closestIdx = 0;
    let closestDist = Number.POSITIVE_INFINITY;

    for (let i = 0; i < safeUrls.length; i += 1) {
      const item = itemRefs.current[i];
      if (!item) continue;
      const itemCenter = item.offsetLeft + item.clientWidth / 2;
      const dist = Math.abs(itemCenter - center);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }

    setActiveIndex(closestIdx);
  };

  const handleScroll = () => {
    if (!isAutoScrollingRef.current) {
      hasUserInteractedRef.current = true;
    }
    if (rafRef.current != null) {
      window.cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = window.requestAnimationFrame(updateActiveFromScroll);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        setIsInView(entry.isIntersecting);
      },
      {
        threshold: [0, 0.15, 0.35, 0.6, 1],
        // Trigger a bit before it's fully centered on screen.
        rootMargin: '0px 0px -20% 0px',
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isInView) return;
    if (hasUserInteractedRef.current) return;
    if (safeUrls.length <= 1) return;

    // First move shortly after it appears (so it's noticeable).
    const first = window.setTimeout(() => {
      if (!isInView) return;
      if (hasUserInteractedRef.current) return;
      const next = (activeIndexRef.current + 1) % safeUrls.length;
      scrollToIndex(next);
    }, 900);

    const id = window.setInterval(() => {
      if (!trackRef.current) return;
      if (!isInView) return;
      if (hasUserInteractedRef.current) return;
      const next = (activeIndexRef.current + 1) % safeUrls.length;
      scrollToIndex(next);
    }, 6500);

    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [isInView, safeUrls.length]);

  if (safeUrls.length === 0) return null;

  const btnBase =
    'inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-extrabold tracking-wide text-white/90 backdrop-blur outline-none transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className={btnBase}
          onClick={() => scrollToIndex(activeIndex - 1)}
          disabled={activeIndex <= 0}
          aria-label="Anterior"
        >
          ←
        </button>
        <button
          type="button"
          className={btnBase}
          onClick={() => scrollToIndex(activeIndex + 1)}
          disabled={activeIndex >= safeUrls.length - 1}
          aria-label="Siguiente"
        >
          →
        </button>
      </div>

      <div
        ref={trackRef}
        onScroll={handleScroll}
        onPointerDown={() => {
          hasUserInteractedRef.current = true;
        }}
        onTouchStart={() => {
          hasUserInteractedRef.current = true;
        }}
        onWheel={() => {
          hasUserInteractedRef.current = true;
        }}
        className="mt-4 flex snap-x snap-mandatory items-stretch overflow-x-auto scroll-smooth pb-4 pt-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {safeUrls.map((url, idx) => {
          const isActive = idx === activeIndex;
          const cardClassName =
            'group relative snap-center shrink-0 rounded-3xl border border-white/10 bg-white/5 p-2 outline-none transition will-change-transform ' +
            'focus-visible:ring-2 focus-visible:ring-emerald-400/60 ' +
            // Size
            'w-[84%] sm:w-[60%] lg:w-[40%] ' +
            // Overlap/stacking
            (idx === 0 ? 'ml-0' : '-ml-10 sm:-ml-14 lg:-ml-16 ') +
            // Depth
            (isActive
              ? 'z-20 scale-[1.02] -translate-y-1 bg-white/10 shadow-2xl shadow-indigo-500/10'
              : 'z-10 scale-[0.94] translate-y-1 opacity-80 hover:z-20 hover:opacity-100 hover:scale-[0.98] hover:-translate-y-0.5') +
            ' motion-reduce:transform-none motion-reduce:transition-none';

          return (
          <a
            key={url}
            ref={(el) => {
              itemRefs.current[idx] = el;
            }}
            href={href}
            target="_blank"
            rel="noreferrer"
            className={cardClassName}
            aria-label={`Abrir historias (imagen ${idx + 1})`}
            aria-current={isActive ? 'true' : undefined}
          >
            <img
              src={url}
              alt={`Imagen ${idx + 1}`}
              className="h-auto w-full select-none rounded-2xl"
              loading="lazy"
              draggable={false}
            />
          </a>
          );
        })}
      </div>
    </div>
  );
}
