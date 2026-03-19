'use client';

import { useEffect, useMemo, useRef } from 'react';

type ButterflyOverlayProps = {
  baseUrl?: string;
  prefix?: string;
  digits?: number;
  start?: number;
  count?: number;
  fps?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  maxWidthPx?: number;
};

function pad(num: number, digits: number) {
  const s = String(num);
  return s.length >= digits ? s : '0'.repeat(digits - s.length) + s;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function ButterflyOverlay({
  baseUrl =
    process.env.NEXT_PUBLIC_BUTTERFLY_FRAMES_BASE_URL ??
    'https://pub-a6844436cdf343eca77a9769bb10e73e.r2.dev/maripoani',
  prefix = process.env.NEXT_PUBLIC_BUTTERFLY_FRAMES_PREFIX ?? 'maripometaweb',
  digits = Number(process.env.NEXT_PUBLIC_BUTTERFLY_FRAMES_DIGITS ?? 3),
  start = Number(process.env.NEXT_PUBLIC_BUTTERFLY_FRAMES_START ?? 0),
  count = Number(process.env.NEXT_PUBLIC_BUTTERFLY_FRAMES_COUNT ?? 220),
  fps = Number(process.env.NEXT_PUBLIC_BUTTERFLY_FPS ?? 24),
  minDelayMs = Number(process.env.NEXT_PUBLIC_BUTTERFLY_MIN_DELAY_MS ?? 12000),
  maxDelayMs = Number(process.env.NEXT_PUBLIC_BUTTERFLY_MAX_DELAY_MS ?? 22000),
  maxWidthPx = Number(process.env.NEXT_PUBLIC_BUTTERFLY_MAX_WIDTH_PX ?? 420),
}: ButterflyOverlayProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const playingRef = useRef(false);

  const frames = useMemo(() => {
    const safeCount = clamp(Number.isFinite(count) ? count : 0, 0, 600);
    const safeDigits = clamp(Number.isFinite(digits) ? digits : 3, 1, 6);
    const urls: string[] = [];

    const base = String(baseUrl || '').replace(/\/+$/, '');
    const filePrefix = String(prefix || '').trim();

    for (let i = 0; i < safeCount; i++) {
      const n = start + i;
      urls.push(`${base}/${filePrefix}${pad(n, safeDigits)}.png`);
    }

    return urls;
  }, [baseUrl, prefix, digits, start, count]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (reduceMotion) return;

    if (!frames.length) return;

    const img = imgRef.current;
    if (!img) return;

    // Preload frames (best-effort). Uses idle time to avoid blocking.
    const preloaded: HTMLImageElement[] = [];
    let cancelled = false;

    const preload = () => {
      if (cancelled) return;
      for (const url of frames) {
        const im = new Image();
        im.decoding = 'async';
        im.loading = 'eager';
        im.src = url;
        preloaded.push(im);
      }
    };

    const idle = (window as any).requestIdleCallback as undefined | ((cb: () => void) => void);
    if (idle) idle(preload);
    else window.setTimeout(preload, 800);

    const safeFps = clamp(Number.isFinite(fps) ? fps : 24, 6, 60);
    const frameMs = 1000 / safeFps;

    const scheduleNext = () => {
      if (cancelled) return;
      const delay = Math.round(rand(minDelayMs, maxDelayMs));
      timerRef.current = window.setTimeout(() => {
        startPlay();
      }, delay);
    };

    const stopRaf = () => {
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    const startPlay = () => {
      if (cancelled) return;
      if (playingRef.current) return;
      playingRef.current = true;

      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Path params
      const y = Math.round(rand(vh * 0.18, vh * 0.72));
      const scale = rand(0.7, 1.05);
      const durationMs = Math.max(900, Math.round((frames.length * frameMs) * rand(0.9, 1.15)));

      const startX = vw * 1.15;
      const endX = -vw * 0.25;

      const startTime = performance.now();
      let lastFrameTime = startTime;
      let frameIndex = 0;

      // show
      img.style.opacity = '0';
      img.style.display = 'block';

      const tick = (t: number) => {
        if (cancelled) return;

        const elapsed = t - startTime;
        const p = clamp(elapsed / durationMs, 0, 1);

        // frame advance
        if (t - lastFrameTime >= frameMs) {
          frameIndex = (frameIndex + 1) % frames.length;
          const src = preloaded[frameIndex]?.src ?? frames[frameIndex];
          if (img.src !== src) img.src = src;
          lastFrameTime = t;
        }

        // position
        const x = startX + (endX - startX) * p;

        // fade in/out
        const fadeIn = clamp(p / 0.08, 0, 1);
        const fadeOut = clamp((1 - p) / 0.1, 0, 1);
        const alpha = Math.min(fadeIn, fadeOut);

        img.style.opacity = String(alpha);
        img.style.transform = `translate3d(${Math.round(x)}px, ${y}px, 0) scale(${scale})`;

        if (p >= 1) {
          playingRef.current = false;
          img.style.opacity = '0';
          img.style.display = 'none';
          stopRaf();
          scheduleNext();
          return;
        }

        rafRef.current = window.requestAnimationFrame(tick);
      };

      // set first frame asap
      img.src = preloaded[0]?.src ?? frames[0];
      rafRef.current = window.requestAnimationFrame(tick);
    };

    // Start loop after a short delay (lets page settle).
    timerRef.current = window.setTimeout(() => startPlay(), 2500);

    return () => {
      cancelled = true;
      playingRef.current = false;
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      stopRaf();
    };
  }, [frames, fps, minDelayMs, maxDelayMs]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden"
    >
      <img
        ref={imgRef}
        alt=""
        className="absolute left-0 top-0 select-none"
        style={{
          display: 'none',
          opacity: 0,
          willChange: 'transform, opacity',
          maxWidth: `${maxWidthPx}px`,
          height: 'auto',
        }}
        draggable={false}
      />
    </div>
  );
}
