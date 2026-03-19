/*
  Landing single-page (anclas), mobile-first.
*/

'use client';

import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Reveal } from './components/Reveal';
import { WhatsAppForm } from './components/WhatsAppForm';
import { Faq } from './components/Faq';
import { FloatingWhatsApp } from './components/FloatingWhatsApp';
import { TopNav } from './components/TopNav';
import { ButterflyOverlay } from './components/ButterflyOverlay';
import { SplineBackground } from './components/SplineBackground';
import { TestimonialsCarousel } from './components/TestimonialsCarousel';

function envFlag(value: string | undefined, fallback = false) {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
}

function FadeInAutoplayVideo({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const didAutoPlayRef = useRef(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;

    const update = () => setReduceMotion(Boolean(mq.matches));
    update();

    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }

    // Safari fallback
    // eslint-disable-next-line deprecation/deprecation
    mq.addListener(update);
    // eslint-disable-next-line deprecation/deprecation
    return () => mq.removeListener(update);
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (didAutoPlayRef.current) return;

    const attemptPlay = () => {
      if (didAutoPlayRef.current) return;
      didAutoPlayRef.current = true;
      el.play().catch(() => {
        // Autoplay can be blocked; keep controls so user can play.
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        // “Entero en pantalla” (casi 100%) con tolerancia por redondeo.
        if (entry.isIntersecting && entry.intersectionRatio >= 0.98) {
          if (isLoaded) attemptPlay();
        }
      },
      {
        threshold: [0, 0.5, 0.98, 1],
      }
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, [isLoaded]);

  // Safety: if browser never fires the load events, don't keep it invisible.
  useEffect(() => {
    if (reduceMotion) return;
    if (isLoaded) return;
    const t = window.setTimeout(() => setIsLoaded(true), 900);
    return () => window.clearTimeout(t);
  }, [reduceMotion, isLoaded]);

  const handleEnableSound = () => {
    const el = videoRef.current;
    if (!el) return;
    setIsMuted(false);
    el.muted = false;
    try {
      el.pause();
    } catch {
      // ignore
    }
    try {
      el.currentTime = 0;
    } catch {
      // Some browsers require metadata loaded before seeking.
    }
    try {
      el.volume = 1;
    } catch {
      // ignore
    }
    el.play().catch(() => {
      // Some browsers still block play with sound; controls remain available.
    });
  };

  return (
    <div className="relative h-full w-full">
      <video
        ref={videoRef}
        className={`${className ?? ''}${reduceMotion ? '' : ' transition-opacity duration-300 ease-out'}`}
        style={{
          opacity: reduceMotion ? 1 : isLoaded ? 1 : 0,
        }}
        src={src}
        controls
        autoPlay
        muted={isMuted}
        playsInline
        preload="auto"
        onLoadedMetadata={() => setIsLoaded(true)}
        onCanPlay={() => setIsLoaded(true)}
        onVolumeChange={(e) => {
          const el = e.currentTarget;
          setIsMuted(el.muted || el.volume === 0);
        }}
      />

      {isMuted ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <button
            type="button"
            onClick={handleEnableSound}
            className="pointer-events-auto inline-flex items-center justify-center rounded-2xl border border-white/10 bg-black/50 px-5 py-4 text-sm font-extrabold tracking-wide text-white backdrop-blur outline-none transition hover:bg-black/60 focus-visible:ring-2 focus-visible:ring-emerald-400/60"
            aria-label="Activar sonido"
          >
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5">
                <path
                  d="M11 5.5L7.2 8.7H4.8c-.99 0-1.8.81-1.8 1.8v3c0 .99.81 1.8 1.8 1.8h2.4L11 18.5V5.5Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <path
                  d="M15.5 8.9c.8.7 1.3 1.8 1.3 3.1s-.5 2.4-1.3 3.1"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path
                  d="M18 6.7c1.6 1.4 2.6 3.3 2.6 5.3s-1 3.9-2.6 5.3"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            Activar sonido
          </button>
        </div>
      ) : null}
    </div>
  );
}

const WORKSHOP_KICKER = 'TALLER VIVENCIAL · MARZO 2026';
const WORKSHOP_LABEL = 'Metamorfosis — Marzo 2026';
const WORKSHOP_TITLE_IMAGE_URL =
  'https://pub-a6844436cdf343eca77a9769bb10e73e.r2.dev/META%20TEXTO%20PNG.png';
const WORKSHOP_HOOK =
  '“Cuando entendés tu historia, empezás tu metamorfosis. Las heridas de la infancia no desaparecen con el tiempo… pero pueden transformarse con conciencia.”';
const VIDEO_URL =
  process.env.NEXT_PUBLIC_VERTICAL_VIDEO_URL ??
  'https://pub-a6844436cdf343eca77a9769bb10e73e.r2.dev/Que%20Es%20Bp.mp4';

const SPLINE_SCENE_URL =
  process.env.NEXT_PUBLIC_SPLINE_SCENE_URL ??
  'https://prod.spline.design/Mc-cIaYuCw4QPcKw/scene.splinecode';

const TESTIMONIALS_HIGHLIGHT_URL =
  'https://www.instagram.com/stories/highlights/18092573276053424/';

function Section({
  id,
  title,
  subtitle,
  kicker,
  headerVariant = 'default',
  headerClassName,
  titleClassName,
  subtitleClassName,
  children,
}: {
  id?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  kicker?: string;
  headerVariant?: 'default' | 'card';
  headerClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-6xl px-5">
        <Reveal>
          {headerVariant === 'card' ? (
            <div className="mx-auto max-w-3xl rounded-3xl border border-amber-400/40 bg-white/5 p-6 text-center backdrop-blur sm:p-7 relative overflow-hidden hero-card-main">
              {kicker ? (
                <p className="text-xs font-bold tracking-[0.22em] text-emerald-200/90">{kicker}</p>
              ) : null}
              <h2
                className={
                  `mt-2 text-2xl font-semibold tracking-tight sm:text-3xl${titleClassName ? ' ' + titleClassName : ''}`
                }
              >
                {title}
              </h2>
              {subtitle ? (
                <p
                  className={
                    `mt-3 text-base text-white/70 sm:text-lg${subtitleClassName ? ' ' + subtitleClassName : ''}`
                  }
                >
                  {subtitle}
                </p>
              ) : null}
              <div className="mt-5 flex justify-center">
                <a
                  href="#contacto-form"
                  className="inline-flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-400/90 to-cyan-300/90 px-7 text-sm font-extrabold tracking-wide text-slate-950 outline-none transition hover:from-emerald-300/90 hover:to-cyan-200/90 focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                >
                  Inscripciónes para MARZO..!
                </a>
              </div>
            </div>
          ) : (
            <div className={`max-w-3xl${headerClassName ? ' ' + headerClassName : ''}`}
            >
              <h2
                className={
                  `text-2xl font-semibold tracking-tight sm:text-3xl${titleClassName ? ' ' + titleClassName : ''}`
                }
              >
                {title}
              </h2>
              {subtitle ? (
                <p
                  className={
                    `mt-3 text-base text-white/70 sm:text-lg${
                      subtitleClassName ? ' ' + subtitleClassName : ''
                    }`
                  }
                >
                  {subtitle}
                </p>
              ) : null}
            </div>
          )}
        </Reveal>
        <div className="mt-7">{children}</div>
      </div>
    </section>
  );
}

function TrustCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-2 text-sm text-white/70">{text}</p>
    </div>
  );
}

function GlowCard({
  kicker,
  title,
  text,
}: {
  kicker: React.ReactNode;
  title?: React.ReactNode;
  text: React.ReactNode;
}) {
  return (
    <div className="glow-card">
      <div className="glow-card-inner p-6 text-center">
        <p className="text-lg font-black uppercase tracking-[-0.02em] leading-tight sm:text-xl [text-wrap:balance] [-webkit-text-stroke:0.5px_rgba(255,255,255,0.1)]">
          {typeof kicker === 'string' ? (
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent [-webkit-text-stroke:0.5px_rgba(255,255,255,0.3)]">
              {kicker}
            </span>
          ) : (
            kicker
          )}
        </p>
        {title ? <p className="glow-card-title mt-2 text-base font-semibold tracking-normal text-white">{title}</p> : null}
        <div className="mt-2 text-sm font-medium text-white/70">{text}</div>
      </div>
    </div>
  );
}

function AnimatedKicker({ children, className }: { children: string; className?: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (isActive) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          setIsActive(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isActive]);

  return (
    <span
      ref={ref}
      className={[
        'inline-block bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent [-webkit-text-stroke:0.5px_rgba(255,255,255,0.3)]',
        className,
        isActive ? 'tracking-in-contract-bck' : undefined,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  );
}

function KickerLoop({ children }: { children: string }) {
  return (
    <span className="tracking-in-expand-fwd-loop inline-block bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent [-webkit-text-stroke:0.5px_rgba(255,255,255,0.3)]">
      {children}
    </span>
  );
}

export default function Page() {
  const searchParams = useSearchParams();
  const isPreview = searchParams?.get('preview') === '1';
  const isEmbed = searchParams?.get('embed') === '1';

  const isVerticalMp4 = /\.mp4($|\?)/i.test(VIDEO_URL);
  const enableButterflyOverlay = envFlag(process.env.NEXT_PUBLIC_ENABLE_BUTTERFLY_OVERLAY, false);

  if (isPreview && !isEmbed) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto w-full max-w-6xl px-5 py-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-[0.22em] text-emerald-200/90">VISTA PREVIA</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Desktop + Mobile</h1>
              <p className="mt-2 text-sm text-white/60">
                Esto es solo para diseñar. Usá <span className="font-semibold text-white/80">/?preview=1</span>.
              </p>
            </div>
            <a
              href="/?embed=1"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/80 hover:bg-white/10"
            >
              Abrir normal
            </a>
          </div>

          <div className="mt-7 grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold text-white/60">Desktop</p>
              <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                <div className="h-[720px] w-full">
                  <iframe
                    title="Preview Desktop"
                    className="h-full w-full"
                    src="/?embed=1"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold text-white/60">Mobile</p>
              <div className="mt-3 flex justify-center">
                <div className="w-[390px] max-w-full">
                  <div className="rounded-[2.75rem] border border-white/10 bg-black/30 p-3">
                    <div className="overflow-hidden rounded-[2.3rem] border border-white/10 bg-black/20">
                      <div className="aspect-[9/19.5] w-full">
                        <iframe
                          title="Preview Mobile"
                          className="h-full w-full"
                          src="/?embed=1"
                        />
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-center text-xs text-white/40">390×844 (estilo iPhone)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const navItems = [
    { id: 'que-es-meta', label: 'QUE ES META?', scrollToId: 'que-es-meta-video' },
    { id: 'testimonios', label: 'TESTIMONIOS' },
    { id: 'conocenos', label: 'CONOCENOS' },
    { id: 'contacto-form', label: 'CONTACTANOS' },
    { id: 'mi-cuenta', label: 'MI CUENTA', type: 'link' as const, href: '/dashboard', variant: 'inverted' as const },
  ];

  const faqItems = [
    {
      question: '¿Esto es terapia?',
      answer:
        'No. Es un proceso vivencial con psicología aplicada y herramientas prácticas. No reemplaza un proceso terapéutico individual, pero puede complementarlo.',
    },
    {
      question: '¿Cuánto dura Metamorfosis?',
      answer:
        'Metamorfosis está pensado como un proceso de 4 meses. Se organiza en 3 fases, pero siempre se inicia por la Fase 1 (la puerta de entrada).',
    },
    {
      question: '¿Qué es la Fase 1?',
      answer:
        'La Fase 1 es la puerta de entrada a Metamorfosis. Consiste en 2 días intensivos presenciales de trabajo vivencial donde exploramos tu historia emocional, patrones aprendidos en la infancia, heridas no resueltas y cómo todo esto se repite en tu vida actual. Después, 45 días de acompañamiento y seguimiento para integrar lo vivido. Tu primera paso para entender tu historia y decidir si el proceso es para vos.',
    },
    {
      question: '¿Cómo sé que es confiable?',
      answer:
        'Porque el primer paso es hablar por WhatsApp y despejar dudas. Esta web no pide pagos ni datos bancarios.',
    },
    {
      question: '¿Hay cupos?',
      answer:
        'Sí. Para cuidar la calidad del proceso y el acompañamiento. Pedí info y te contamos disponibilidad.',
    },
    {
      question: '¿Puedo participar si hice otros talleres vivenciales?',
      answer:
        'Sí, absoluto. Metamorfosis está diseñado para personas que ya han hecho procesos de trabajo personal. Tu experiencia previa enriquece el espacio grupal.',
    },
    {
      question: '¿Quiénes pueden participar?',
      answer:
        'Cualquier persona mayor de 18 años que esté dispuesta a expandir su autoconocimiento y trabajar sus patrones emocionales. No necesitas experiencia previa.',
    },
    {
      question: '¿Puedo participar si nunca hice un taller así?',
      answer:
        'Claro que sí. La Fase 1 está pensada como tu puerta de entrada. Daiana te guiará paso a paso en todo el proceso vivencial.',
    },
    {
      question: '¿Hay requisitos de edad?',
      answer:
        'Sí. Solo pueden participar mayores de 18 años. Esto asegura un espacio de madurez emocional y responsabilidad individual.',
    },
  ];

  const testimonialImageUrls = Array.from({ length: 8 }, (_, i) => {
    const n = i + 1;
    return `https://pub-a6844436cdf343eca77a9769bb10e73e.r2.dev/testi/${n}.jpg`;
  });

  return (
    <main className="min-h-screen text-white">
      {enableButterflyOverlay ? <ButterflyOverlay /> : null}
      {/* Spline background */}
      <SplineBackground
        scene={SPLINE_SCENE_URL}
        className="pointer-events-none fixed inset-0 z-0 [&_spline-viewer]:h-full [&_spline-viewer]:w-full"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-slate-950/40 via-slate-950/75 to-slate-950"
      />

      <div className="relative z-10">
        {/* Header */}
        <header
          id="site-header"
          className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/70 backdrop-blur"
        >
          <div className="mx-auto w-full max-w-6xl px-5 py-4">
            <div className="flex justify-center">
              <Image
                src="/logo-horizontal.png"
                alt="Metamorfosis"
                width={360}
                height={88}
                priority
                className="h-auto w-[280px] sm:w-[360px]"
              />
            </div>
            <TopNav items={navItems} />
          </div>
        </header>

        {/* QUE ES META? (arranca con video + form) */}
        <Section
          id="que-es-meta"
          title={
            <img
              src={WORKSHOP_TITLE_IMAGE_URL}
              alt="Metamorfosis"
              className="meta-title-motion mx-auto h-auto w-[240px] select-none sm:w-[320px]"
              draggable={false}
              loading="eager"
            />
          }
          subtitle={WORKSHOP_HOOK}
          kicker={WORKSHOP_KICKER}
          headerVariant="card"
          titleClassName="flex justify-center"
        >
          <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
            <Reveal>
              <div
                id="que-es-meta-video"
                className="mx-auto w-full max-w-[320px] scroll-mt-28 sm:max-w-[360px] lg:mx-0"
              >
                <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/30 shadow-2xl shadow-indigo-500/10">
                  <div className="aspect-[9/16]">
                    {VIDEO_URL ? (
                      isVerticalMp4 ? (
                        <FadeInAutoplayVideo className="h-full w-full object-cover" src={VIDEO_URL} />
                      ) : (
                        <iframe
                          className="h-full w-full"
                          src={VIDEO_URL}
                          title="Video Metamorfosis"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      )
                    ) : (
                      <div className="flex h-full w-full items-center justify-center p-8 text-center">
                        <div>
                          <p className="text-sm font-semibold">Sumá tu video vertical</p>
                          <p className="mt-2 text-sm text-white/60">
                            Configurá `NEXT_PUBLIC_VERTICAL_VIDEO_URL` para mostrarlo acá.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.08}>
              <div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <GlowCard
                    kicker={<KickerLoop>QUÉ ES META?</KickerLoop>}
                    title="Proceso Vivencial + Acompañamiento"

                    text={
                      <>
                        <span className="block">
                          
                          Metamorfosis es un espacio de trabajo personal profundo para explorar tu historia emocional,
                          reconocer patrones aprendidos en la infancia y comenzar a transformar la relación con lo vivido.
                        </span>
                        <span className="mt-3 block text-xs font-semibold text-white/55">
                          No reemplaza un proceso terapéutico, pero sí ofrece herramientas de conciencia, introspección y
                          transformación personal.
                        </span>
                      </>
                    }
                  />
                  <GlowCard
                    kicker={<KickerLoop>FASE 1 · EL INICIO</KickerLoop>}
                    title="2 Días Intensivos Presenciales + 45 Días de Integración y Acompañamiento"
                    text={
                      <>
                        <span className="block">
                          Hay momentos en la vida donde algo dentro tuyo pide ser mirado de verdad.
                        </span>
                        <span className="mt-3 block">
                          Esta fase comienza con dos días presenciales de inmersión profunda. Un espacio para detenerte, sentir, entender tus vínculos, tus heridas y esos patrones que se repiten.
                        </span>
                        <span className="mt-3 block">
                          Pero no termina ahí.
                        </span>
                        <span className="mt-3 block">
                          Durante 45 días más, el proceso continúa con encuentros y acompañamiento para integrar lo vivido, sostener los cambios y llevar lo trabajado a tu vida real.
                        </span>
                        <span className="mt-3 block text-xs font-semibold text-white/55">
                          Porque abrir conciencia es importante. Pero sostenerla… es lo que transforma.
                        </span>
                      </>
                    }
                  />
                  <GlowCard
                    kicker={<KickerLoop>CUÁNTO DURA?</KickerLoop>}
                    title="Decisiones progresivas"
                    text={
                      <>
                        <span className="block">
                          Metamorfosis es un Proceso de <span className="font-semibold text-white">4 Meses</span> dividido en
                          <span className="font-semibold text-white"> 3 Fases</span>.
                        </span>
                        <span className="mt-3 block">
                          No se vende como paquete: ingresás por la <span className="font-semibold text-white">Fase 1</span> y
                          luego decidís cómo continuar, según tu momento y tu proceso personal.
                        </span>
                      </>
                    }
                  />
                  <GlowCard
                    kicker={<KickerLoop>PUNTOS PRINCIPALES</KickerLoop>}
                    title={null}
                    text={
                      <>
                        <ul className="grid gap-2">
                          <li>
                            👉 La <span className="font-semibold text-white">conciencia</span> (entender qué te pasa y por qué)
                          </li>
                          <li>
                            👉 Los <span className="font-semibold text-white">patrones aprendidos</span> (muchos de ellos en la infancia)
                          </li>
                          <li>
                            👉 La <span className="font-semibold text-white">responsabilidad personal</span>
                          </li>
                          <li>
                            👉 La <span className="font-semibold text-white">transformación</span> presente y futura
                          </li>
                        </ul>
                        <p className="mt-4 text-xs font-semibold text-white/55">
                          No trabaja desde el diagnóstico ni desde la patología, sino desde el desarrollo personal y emocional.
                        </p>
                      </>
                    }
                  />
                </div>

                <div id="contacto-form" className="mt-6 scroll-mt-28 -mx-5 px-5 py-10 sm:-mx-8 sm:px-8 bg-gradient-to-b from-slate-950/0 via-emerald-950/15 to-slate-950/0">
                  <WhatsAppForm workshopLabel={WORKSHOP_LABEL} />
                </div>
              </div>
            </Reveal>
          </div>
        </Section>

        {/* TESTIMONIOS */}
        <Section
          id="testimonios"
          title={
            <span className="font-black uppercase tracking-[0.22em]">
              <KickerLoop>TESTIMONIOS</KickerLoop>
            </span>
          }
          headerClassName="mx-auto text-center"
        >
          <Reveal>
            <TestimonialsCarousel imageUrls={testimonialImageUrls} href={TESTIMONIALS_HIGHLIGHT_URL} />
          </Reveal>
        </Section>

        {/* CONOCENOS */}
        <Section
          id="conocenos"
          title="Conocenos"
        >
          <div className="mx-auto max-w-3xl">
            <Reveal>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-7">
                <p className="text-sm font-semibold">Quién guía Metamorfosis</p>
                <div className="mt-5">
                  <div className="mx-auto overflow-hidden rounded-3xl border border-white/10 bg-black/20">
                    <div className="aspect-[4/5] w-full">
                      <img
                        src="https://pub-a6844436cdf343eca77a9769bb10e73e.r2.dev/paraweb.jpg"
                        alt="Daiana Duartte"
                        className="h-full w-full object-contain"
                        loading="lazy"
                      />
                    </div>
                  </div>
                  <p className="mt-4 text-center text-xs font-extrabold tracking-[0.22em] text-white/80">
                    DAIANA DUARTTE
                  </p>
                  <div className="mt-4 text-center text-sm text-white/70">
                    <p>
                      Hola soy Daiana, estudiante de Psicología, coach y facilitadora de procesos de desarrollo personal.
                      Acompaño a personas que desean comprender sus patrones de conducta, cuestionar sus creencias y
                      construir una relación más consciente y amorosa consigo mismas.
                    </p>
                    <p className="mt-4">
                      Creo profundamente que muchas de nuestras formas de actuar nacen de nuestra historia y de cómo
                      aprendimos a vincularnos con el mundo.
                    </p>
                    <p className="mt-4">
                      A través de talleres,creo espacios seguros de reflexión y autoconocimiento donde cada persona puede
                      mirarse con mayor claridad, recuperar su poder personal y empezar a elegir desde un lugar más
                      auténtico.
                    </p>
                    <p className="mt-4">
                      Mi propósito es acompañar procesos de transformación reales, sostenibles y profundamente humanos
                      donde puedas reconocer tu verdad.
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </Section>

        {/* FAQ (extra) */}
        <Section title="Preguntas frecuentes" headerClassName="mx-auto text-center">
          <Reveal>
            <Faq items={faqItems} />
          </Reveal>
        </Section>

        <footer className="border-t border-white/10 py-10">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 text-sm text-white/60 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Metamorfosis</p>
          </div>
        </footer>

        <FloatingWhatsApp />
      </div>
    </main>
  );

}
