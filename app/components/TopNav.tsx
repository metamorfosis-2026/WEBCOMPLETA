'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';

export type NavItem = {
  id: string;
  label: string;
  scrollToId?: string;
  type?: 'anchor' | 'link';
  href?: string;
  variant?: 'default' | 'inverted';
};

function getHeaderOffset() {
  const header = document.getElementById('site-header');
  const headerHeight = header?.getBoundingClientRect().height ?? 112;
  return Math.max(0, Math.round(headerHeight + 12));
}

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;

  const offset = getHeaderOffset();
  const top = window.scrollY + el.getBoundingClientRect().top - offset;
  window.scrollTo({ top, behavior: 'smooth' });
}

export function TopNav({ items }: { items: NavItem[] }) {
  const firstAnchor = items.find((i) => (i.type ?? 'anchor') === 'anchor');
  const [activeId, setActiveId] = useState(firstAnchor?.id ?? '');
  const [mobileOpen, setMobileOpen] = useState(false);
  const rafRef = useRef<number | null>(null);

  const sectionIds = useMemo(
    () => items.filter((i) => (i.type ?? 'anchor') === 'anchor').map((i) => i.id),
    [items]
  );

  useEffect(() => {
    if (!sectionIds.length) return;

    const computeActive = () => {
      const offset = getHeaderOffset();

      const sections = sectionIds
        .map((id) => {
          const el = document.getElementById(id);
          if (!el) return null;
          return { id, top: el.getBoundingClientRect().top };
        })
        .filter(Boolean) as Array<{ id: string; top: number }>;

      if (!sections.length) return;

      // Section activa: la última que ya "pasó" el header.
      const passed = sections
        .filter((s) => s.top <= offset)
        .sort((a, b) => b.top - a.top);

      const nextActive = passed[0]?.id ?? sections[0].id;
      setActiveId(nextActive);
    };

    const onScroll = () => {
      if (rafRef.current != null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        computeActive();
      });
    };

    computeActive();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [sectionIds]);

  const onAnchorClick = (item: NavItem) => {
    const targetId = item.scrollToId ?? item.id;
    setActiveId(item.id);
    scrollToId(targetId);
    setMobileOpen(false);
  };

  const onLinkClick = () => {
    setMobileOpen(false);
  };

  return (
    <nav className="mt-5 flex justify-center">
      <div className="w-full max-w-5xl">
        {/* Mobile (cajón) */}
        <div className="sm:hidden">
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur">
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-black/20 px-4 text-sm font-semibold tracking-wide text-white/80 outline-none transition hover:bg-black/30 hover:text-white focus-visible:ring-2 focus-visible:ring-emerald-400/60"
              aria-expanded={mobileOpen}
              aria-controls="topnav-mobile-drawer"
            >
              {mobileOpen ? 'CERRAR' : 'MENÚ'}
            </button>

            {/* CTA (si existe) */}
            {items
              .filter((i) => (i.type ?? 'anchor') === 'link')
              .slice(0, 1)
              .map((item) => (
                <Link
                  key={item.id}
                  href={item.href ?? '/dashboard'}
                  onClick={onLinkClick}
                  className={
                    item.variant === 'inverted'
                      ? 'nav-cta relative inline-flex h-10 items-center justify-center rounded-xl border border-emerald-300/35 bg-slate-950/70 px-4 text-sm font-semibold tracking-wide text-emerald-200 outline-none transition hover:bg-slate-950/90 hover:text-emerald-100 focus-visible:ring-2 focus-visible:ring-emerald-400/60'
                      : 'inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold tracking-wide text-white/80 outline-none transition hover:text-white focus-visible:ring-2 focus-visible:ring-emerald-400/60'
                  }
                >
                  <span className="relative z-10">{item.label}</span>
                  {item.variant === 'inverted' ? (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-400/10 to-cyan-300/10"
                    />
                  ) : null}
                </Link>
              ))}
          </div>

          {mobileOpen ? (
            <div
              id="topnav-mobile-drawer"
              className="mt-2 rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur"
            >
              <div className="grid gap-2">
                {items
                  .filter((i) => (i.type ?? 'anchor') === 'anchor')
                  .map((item) => {
                    const isActive = activeId === item.id;
                    return (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          onAnchorClick(item);
                        }}
                        className={
                          isActive
                            ? 'rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold tracking-wide text-white outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60'
                            : 'rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold tracking-wide text-white/80 outline-none transition hover:bg-black/30 hover:text-white focus-visible:ring-2 focus-visible:ring-emerald-400/60'
                        }
                      >
                        {item.label}
                      </a>
                    );
                  })}
              </div>
            </div>
          ) : null}
        </div>

        {/* Desktop (menú normal) */}
        <div className="hidden sm:flex justify-center">
          <div className="relative flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur">
            {items.map((item) => {
              const isActive = activeId === item.id;

              if ((item.type ?? 'anchor') === 'link') {
                return (
                  <Link
                    key={item.id}
                    href={item.href ?? '/dashboard'}
                    className={
                      item.variant === 'inverted'
                        ? 'nav-cta relative select-none rounded-xl border border-emerald-300/35 bg-slate-950/70 px-4 py-2 text-sm font-semibold tracking-wide text-emerald-200 outline-none transition hover:bg-slate-950/90 hover:text-emerald-100 focus-visible:ring-2 focus-visible:ring-emerald-400/60'
                        : 'relative select-none rounded-xl px-4 py-2 text-sm font-semibold tracking-wide text-white/80 outline-none transition hover:text-white focus-visible:ring-2 focus-visible:ring-emerald-400/60'
                    }
                  >
                    <span className="relative z-10">{item.label}</span>
                    {item.variant === 'inverted' ? (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-400/10 to-cyan-300/10"
                      />
                    ) : null}
                  </Link>
                );
              }

              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    onAnchorClick(item);
                  }}
                  className="relative select-none rounded-xl px-4 py-2 text-sm font-semibold tracking-wide text-white/80 outline-none transition hover:text-white focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                >
                  {isActive ? (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-400/90 to-cyan-300/90"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  ) : null}

                  <span className={isActive ? 'relative z-10 text-slate-950' : 'relative z-10'}>
                    {item.label}
                  </span>
                </a>
              );
            })}

            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-2xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>
    </nav>
  );
}
