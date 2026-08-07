'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

import { ButterflyMark } from './ButterflyMark';

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
  const [mounted, setMounted] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => setMounted(true), []);

  const sectionIds = useMemo(
    () => items.filter((i) => (i.type ?? 'anchor') === 'anchor').map((i) => i.id),
    [items]
  );

  const anchors = useMemo(() => items.filter((i) => (i.type ?? 'anchor') === 'anchor'), [items]);
  const links = useMemo(() => items.filter((i) => (i.type ?? 'anchor') === 'link'), [items]);

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

  // Bloquear el scroll del fondo y salir con Escape mientras el panel está abierto.
  useEffect(() => {
    if (!mobileOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileOpen]);

  const onAnchorClick = (item: NavItem) => {
    const targetId = item.scrollToId ?? item.id;
    setActiveId(item.id);
    setMobileOpen(false);
    // Esperamos a que se cierre el panel para que el scroll calcule bien.
    window.setTimeout(() => scrollToId(targetId), 220);
  };

  return (
    <nav className="mt-5 flex justify-center">
      <div className="w-full max-w-5xl">
        {/* ------------------------------------------------------- Mobile */}
        <div className="sm:hidden">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="group inline-flex h-11 items-center gap-2.5 rounded-full border border-ivory/15 pl-2.5 pr-5 text-[11px] font-bold uppercase tracking-[0.18em] text-ivory/75 outline-none transition duration-300 hover:border-celeste/50 hover:text-ivory"
              aria-expanded={mobileOpen}
              aria-controls="topnav-mobile-panel"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-celeste/12 text-celeste transition-transform duration-500 group-hover:scale-110">
                <ButterflyMark className="h-4 w-4" strokeWidth={5} />
              </span>
              Menú
            </button>

            {links.slice(0, 1).map((item) => (
              <Link
                key={item.id}
                href={item.href ?? '/dashboard'}
                className="inline-flex h-11 items-center justify-center rounded-full border border-celeste/40 px-5 text-[11px] font-bold uppercase tracking-[0.18em] text-celeste outline-none transition hover:bg-celeste/10"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Panel a pantalla completa.
            Va por portal a <body>: dentro del <header> (que tiene backdrop-blur)
            un hijo `fixed` queda contenido en la caja del header y no tapa la
            página. Fondo 100% sólido, sin alpha. */}
        {mounted
          ? createPortal(
              <AnimatePresence>
          {mobileOpen ? (
            <motion.div
              id="topnav-mobile-panel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ backgroundColor: '#04070E' }}
              className="fixed inset-0 z-[65] flex flex-col overflow-hidden sm:hidden"
            >
              {/* Mariposa de marca de agua */}
              <motion.div
                aria-hidden="true"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="pointer-events-none absolute inset-x-0 top-[22%] flex justify-center"
              >
                <ButterflyMark
                  className="h-[24rem] w-[24rem] text-celeste/[0.07]"
                  strokeWidth={1.2}
                  filled
                />
              </motion.div>

              <div
                aria-hidden="true"
                className="aura aura-celeste absolute left-1/2 top-1/3 h-[22rem] w-[22rem] -translate-x-1/2 opacity-60"
              />

              {/* Cabecera del panel */}
              <div className="relative z-10 flex items-center justify-between px-6 pt-6">
                <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-ivory/35">
                  Metamorfosis
                </span>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Cerrar menú"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ivory/15 text-ivory/70 transition hover:border-celeste/50 hover:text-ivory"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              {/* Links */}
              <div className="relative z-10 flex flex-1 flex-col justify-center px-6">
                {anchors.map((item, i) => {
                  const isActive = activeId === item.id;
                  return (
                    <motion.a
                      key={item.id}
                      href={`#${item.id}`}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.06 + i * 0.055, duration: 0.4, ease: 'easeOut' }}
                      onClick={(e) => {
                        e.preventDefault();
                        onAnchorClick(item);
                      }}
                      className="flex items-baseline gap-5 border-b border-ivory/[0.08] py-5"
                    >
                      <span className="numeric text-[11px] font-semibold text-celeste/70">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span
                        className={`display text-[2rem] lowercase first-letter:uppercase transition-colors duration-300 ${
                          isActive ? 'text-celeste' : 'text-ivory'
                        }`}
                      >
                        {item.label}
                      </span>
                    </motion.a>
                  );
                })}
              </div>

              {/* Pie del panel */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
                className="relative z-10 px-6 pb-10"
                style={{ paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom, 0px))' }}
              >
                {links.slice(0, 1).map((item) => (
                  <Link
                    key={item.id}
                    href={item.href ?? '/dashboard'}
                    onClick={() => setMobileOpen(false)}
                    className="flex h-14 items-center justify-center rounded-full border border-celeste/40 text-[12px] font-bold uppercase tracking-[0.18em] text-celeste transition hover:bg-celeste/10"
                  >
                    {item.label}
                  </Link>
                ))}
              </motion.div>
            </motion.div>
          ) : null}
              </AnimatePresence>,
              document.body
            )
          : null}

        {/* ------------------------------------------------------ Desktop */}
        <div className="hidden justify-center sm:flex">
          <div className="flex flex-wrap items-center justify-center gap-x-9 gap-y-2">
            {items.map((item) => {
              const isActive = activeId === item.id;

              if ((item.type ?? 'anchor') === 'link') {
                return (
                  <Link
                    key={item.id}
                    href={item.href ?? '/dashboard'}
                    className={
                      item.variant === 'inverted'
                        ? 'select-none rounded-full border border-celeste/40 px-5 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-celeste outline-none transition duration-300 hover:bg-celeste/10'
                        : 'select-none text-[11px] font-bold uppercase tracking-[0.18em] text-ivory/60 outline-none transition hover:text-ivory'
                    }
                  >
                    {item.label}
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
                  className={
                    'relative select-none py-2 text-[11px] font-bold uppercase tracking-[0.18em] outline-none transition duration-300 ' +
                    (isActive ? 'text-ivory' : 'text-ivory/50 hover:text-ivory/85')
                  }
                >
                  {item.label}
                  {isActive ? (
                    <motion.span
                      layoutId="nav-underline"
                      className="absolute -bottom-0.5 left-0 right-0 h-px bg-celeste"
                      transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                    />
                  ) : null}
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
