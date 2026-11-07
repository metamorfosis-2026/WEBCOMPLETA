/*
  Landing single-page (anclas), mobile-first.

  Diseño: oscuro premium con un único acento celeste, tipografía Outfit en
  pesos livianos a tamaño grande, halos suaves y grano fino para dar vida.
  Orden: enganchar -> identificarse -> entender -> creer (testimonios) ->
  ver el precio -> dejar los datos.

  Regla de legibilidad móvil: nada de texto por debajo de 15px, y los bloques
  de datos (sobre todo el precio) respiran en vez de amontonarse.
*/

'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Reveal } from './components/Reveal';
import { TicketCheckout, TicketCheckoutModal } from './components/TicketCheckout';
import { StickyInscripcionBar } from './components/StickyInscripcionBar';
import { Faq } from './components/Faq';
import { FloatingWhatsApp } from './components/FloatingWhatsApp';
import { TopNav } from './components/TopNav';
import { ButterflyOverlay } from './components/ButterflyOverlay';
import { SplineBackground } from './components/SplineBackground';
import { TestimonialsCarousel } from './components/TestimonialsCarousel';
import {
  CTA_LABEL,
  EDITION_DATE_LABEL,
  EDITION_DATE_SHORT,
  EDITION_NAME,
  EDITION_PLACE,
  FASE1_SCHEDULE,
  WAITLIST_MAX,
} from './lib/inscripcion';
import {
  BALANCE_DEADLINE_LABEL,
  EVENT_DATE_LABEL,
  FULL_PRICE_LABEL,
  SPLIT_INSTALLMENT_LABEL,
  SPLIT_TOTAL_LABEL,
} from './lib/entradas';

function envFlag(value: string | undefined, fallback = false) {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
}

function AutoplayVideo({
  src,
  poster,
  className,
}: {
  src: string;
  poster: string;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const didAutoPlayRef = useRef(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

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

  // Por si el navegador nunca dispara los eventos de carga: igual intentamos
  // darle play cuando entra entero en pantalla.
  useEffect(() => {
    if (isLoaded) return;
    const t = window.setTimeout(() => setIsLoaded(true), 900);
    return () => window.clearTimeout(t);
  }, [isLoaded]);

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
      {/* Visible desde el HTML del servidor, con poster: antes arrancaba con
          opacity 0 y se veía un rectángulo negro hasta que cargaba el JS. */}
      <video
        ref={videoRef}
        className={className}
        src={src}
        poster={poster}
        controls
        autoPlay
        muted={isMuted}
        playsInline
        preload="metadata"
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
            className="pointer-events-auto inline-flex items-center gap-2.5 rounded-full border border-celeste/40 bg-night/70 px-6 py-3.5 text-xs font-bold uppercase tracking-[0.16em] text-ivory backdrop-blur-md outline-none transition hover:border-celeste hover:bg-night/85"
            aria-label="Activar sonido"
          >
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4">
              <path
                d="M11 5.5L7.2 8.7H4.8c-.99 0-1.8.81-1.8 1.8v3c0 .99.81 1.8 1.8 1.8h2.4L11 18.5V5.5Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path d="M15.5 8.9c.8.7 1.3 1.8 1.3 3.1s-.5 2.4-1.3 3.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M18 6.7c1.6 1.4 2.6 3.3 2.6 5.3s-1 3.9-2.6 5.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            Activar sonido
          </button>
        </div>
      ) : null}
    </div>
  );
}

// Imágenes servidas por Vercel desde /public, no desde r2.dev: Cloudflare
// limita el acceso por r2.dev (devuelve 429 con mucho tráfico) y no lo
// recomienda para producción. Los logos están achicados (los PNG originales
// pesaban 12 MB y 5 MB).
const LOGO_URL = '/marca/logo-horizontal.png';
const WORDMARK_URL = '/marca/wordmark.png';
const PORTRAIT_URL = '/daiana.jpg';

// Fijo a propósito: antes salía de NEXT_PUBLIC_VERTICAL_VIDEO_URL y el valor
// viejo del .env/Vercel pisaba el video nuevo del hero.
// Sigue en r2.dev (31 MB): para producción conviene conectar un dominio propio
// al bucket (ej. media.metamorfosis.vip) y cambiar esta URL.
const VIDEO_URL =
  'https://pub-a6844436cdf343eca77a9769bb10e73e.r2.dev/videos/meta%20conocerte.mp4';
const VIDEO_POSTER_URL = '/video-poster.jpg';

const SPLINE_SCENE_URL =
  process.env.NEXT_PUBLIC_SPLINE_SCENE_URL ??
  'https://prod.spline.design/Mc-cIaYuCw4QPcKw/scene.splinecode';

const TESTIMONIALS_HIGHLIGHT_URL =
  'https://www.instagram.com/stories/highlights/18092573276053424/';

const TESTIMONIALS_BASE_URL = '/testimonios';

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const header = document.getElementById('site-header');
  const offset = Math.max(0, Math.round((header?.getBoundingClientRect().height ?? 112) + 16));
  window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - offset, behavior: 'smooth' });
}

/* ---------------------------------------------------------------- primitivas */

function Eyebrow({ num, children }: { num?: string; children: React.ReactNode }) {
  return (
    <p className="eyebrow">
      {num ? <span className="eyebrow-num">{num}</span> : null}
      {children}
    </p>
  );
}

function SectionHeading({
  num,
  eyebrow,
  title,
  lead,
  align = 'left',
}: {
  num?: string;
  eyebrow: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  align?: 'left' | 'center';
}) {
  const isCenter = align === 'center';
  return (
    <div className={isCenter ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
      <div className={isCenter ? 'flex justify-center' : ''}>
        <Eyebrow num={num}>{eyebrow}</Eyebrow>
      </div>
      <h2 className="display mt-6 text-[2.15rem] sm:text-[2.9rem] lg:text-[3.4rem]">{title}</h2>
      {lead ? (
        <p
          className={`mt-6 text-[17px] leading-relaxed text-ivory/65 sm:text-lg${
            isCenter ? ' mx-auto max-w-prose' : ' max-w-prose'
          }`}
        >
          {lead}
        </p>
      ) : null}
    </div>
  );
}

function Section({
  id,
  children,
  className,
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`relative scroll-mt-28 py-20 sm:py-28${className ? ' ' + className : ''}`}
    >
      <div className="relative z-[1] mx-auto w-full max-w-6xl px-6 sm:px-8">{children}</div>
    </section>
  );
}

/*
  Con `href` es un link: antes de que cargue React (celular lento) lleva a esa
  pagina; ya cargado, hace lo de onClick (por ejemplo, abrir el modal).
*/
function PrimaryButton({
  onClick,
  href,
  children,
  className,
}: {
  onClick: () => void;
  href?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const Tag = href ? 'a' : 'button';
  return (
    <Tag
      {...(href
        ? {
            href,
            onClick: (event: React.MouseEvent) => {
              event.preventDefault();
              onClick();
            },
          }
        : { type: 'button' as const, onClick })}
      className={`group inline-flex min-h-[3.5rem] items-center justify-center gap-2.5 rounded-full bg-celeste px-8 py-4 text-center text-[13px] font-extrabold uppercase leading-tight tracking-[0.1em] text-night shadow-[0_18px_44px_-18px_rgba(124,201,236,0.75)] transition duration-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celeste/60 focus-visible:ring-offset-2 focus-visible:ring-offset-night${
        className ? ' ' + className : ''
      }`}
    >
      {children}
      <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
        →
      </span>
    </Tag>
  );
}

function GhostButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-[3.5rem] items-center justify-center rounded-full border border-ivory/20 px-8 py-4 text-[13px] font-bold uppercase tracking-[0.1em] text-ivory/80 transition duration-300 hover:border-celeste/60 hover:text-ivory"
    >
      {children}
    </button>
  );
}

function MetaLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-celeste">{children}</span>
  );
}

/* ------------------------------------------------------------------- página */

export default function Page() {
  // ?preview=1 y ?embed=1 son solo para diseñar. Se leen después de montar y
  // no con useSearchParams(): ese hook sin <Suspense> hacía que Next mandara
  // la página vacía (BAILOUT_TO_CLIENT_SIDE_RENDERING) y todo se armaba en el
  // navegador. Mientras cargaba el JS se veía negro, y si fallaba (navegador
  // interno de Instagram/TikTok, celulares viejos) quedaba negro para siempre.
  const [isPreview, setIsPreview] = useState(false);
  const [isEmbed, setIsEmbed] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIsPreview(params.get('preview') === '1');
    setIsEmbed(params.get('embed') === '1');
  }, []);

  const isVerticalMp4 = /\.mp4($|\?)/i.test(VIDEO_URL);
  const enableButterflyOverlay = envFlag(process.env.NEXT_PUBLIC_ENABLE_BUTTERFLY_OVERLAY, false);

  if (isPreview && !isEmbed) {
    return (
      <main className="min-h-screen bg-night text-ivory">
        <div className="mx-auto w-full max-w-6xl px-6 py-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Eyebrow>Vista previa</Eyebrow>
              <h1 className="display mt-4 text-3xl sm:text-4xl">Desktop + Mobile</h1>
              <p className="mt-3 text-sm text-ivory/50">
                Esto es solo para diseñar. Usá <span className="text-ivory/80">/?preview=1</span>.
              </p>
            </div>
            <a
              href="/?embed=1"
              className="inline-flex h-11 items-center justify-center rounded-full border border-ivory/15 px-5 text-xs font-bold uppercase tracking-[0.14em] text-ivory/70 hover:border-celeste/50 hover:text-ivory"
            >
              Abrir normal
            </a>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <div className="surface p-4">
              <MetaLabel>Desktop</MetaLabel>
              <div className="mt-3 overflow-hidden rounded-2xl border border-ivory/10 bg-black/30">
                <div className="h-[720px] w-full">
                  <iframe title="Preview Desktop" className="h-full w-full" src="/?embed=1" />
                </div>
              </div>
            </div>

            <div className="surface p-4">
              <MetaLabel>Mobile</MetaLabel>
              <div className="mt-3 flex justify-center">
                <div className="w-[390px] max-w-full">
                  <div className="rounded-[2.75rem] border border-ivory/10 bg-black/30 p-3">
                    <div className="overflow-hidden rounded-[2.3rem] border border-ivory/10 bg-black/20">
                      <div className="aspect-[9/19.5] w-full">
                        <iframe title="Preview Mobile" className="h-full w-full" src="/?embed=1" />
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-center text-xs text-ivory/35">390×844 (estilo iPhone)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const navItems = [
    { id: 'inicio', label: 'INICIO' },
    { id: 'que-es-meta', label: 'QUÉ ES' },
    { id: 'testimonios', label: 'TESTIMONIOS' },
    { id: 'fase-1', label: 'FASE 1' },
    { id: 'conocenos', label: 'DAIANA' },
    { id: 'mi-cuenta', label: 'MI CUENTA', type: 'link' as const, href: '/dashboard', variant: 'inverted' as const },
  ];

  const faqItems = [
    {
      question: '¿Cuándo es la 7ma edición?',
      answer: `La Fase 1 es el ${EVENT_DATE_LABEL.toLowerCase()} de 2026 (${FASE1_SCHEDULE.toLowerCase()}), en ${EDITION_PLACE}. La dirección exacta te la mandamos por WhatsApp junto con tu entrada.`,
    },
    {
      question: '¿Cuánto sale la Fase 1?',
      answer: `La entrada sale ${FULL_PRICE_LABEL} en un solo pago. Si preferís dividirlo, son ${SPLIT_TOTAL_LABEL} en dos pagos de ${SPLIT_INSTALLMENT_LABEL}: el primero reserva tu lugar y el segundo lo pagás ${BALANCE_DEADLINE_LABEL}. Todo se paga desde esta web con Mercado Pago.`,
    },
    {
      question: '¿Qué es la Fase 1?',
      answer: `Es la puerta de entrada a Metamorfosis: un fin de semana intensivo y presencial (${FASE1_SCHEDULE.toLowerCase()}) de trabajo vivencial donde exploramos tu historia emocional, los patrones aprendidos en la infancia, las heridas no resueltas y cómo todo eso se repite hoy en tu vida. Es una experiencia intensa, movilizadora y profundamente enriquecedora.`,
    },
    {
      question: '¿Estoy obligado a seguir después de la Fase 1?',
      answer:
        'No. Una vez finalizada la Primera Fase, cada persona elige libremente si desea seguir avanzando en el proceso o dar por finalizada su experiencia. Quienes deciden continuar suman 8 encuentros (uno por semana, presenciales o por Meet) hasta llegar a la Segunda Fase.',
    },
    {
      question: '¿Esto es terapia?',
      answer:
        'No. Es un proceso vivencial con psicología aplicada y herramientas prácticas. No reemplaza un proceso terapéutico individual, pero puede complementarlo.',
    },
    {
      question: '¿Cómo pago y cómo recibo mi entrada?',
      answer:
        'Elegís si pagás en uno o en dos pagos, dejás tu nombre y tu WhatsApp, y pagás dentro de Mercado Pago (tarjeta, débito, dinero en cuenta o efectivo). Esta web nunca ve los datos de tu tarjeta. Apenas se acredita el pago te llega tu entrada con un QR por WhatsApp: ese QR se escanea en la puerta.',
    },
    {
      question: '¿Hay cupos?',
      answer:
        `Sí. El grupo es de hasta ${WAITLIST_MAX} personas y el lugar queda tuyo cuando se acredita tu pago (o el primero de los dos). Cuando se completan los lugares, la venta se cierra.`,
    },
    {
      question: '¿Puedo participar si nunca hice un taller así?',
      answer:
        'Claro que sí. La Fase 1 está pensada como tu puerta de entrada. Daiana te guía paso a paso durante todo el proceso vivencial. No necesitás experiencia previa.',
    },
    {
      question: '¿Puedo participar si ya hice otros talleres vivenciales?',
      answer:
        'Sí, absolutamente. Metamorfosis está diseñado también para personas que ya vienen haciendo trabajo personal. Tu experiencia previa enriquece el espacio grupal.',
    },
    {
      question: '¿Hay requisitos de edad?',
      answer:
        'Sí. Solo pueden participar mayores de 18 años. Esto asegura un espacio de madurez emocional y responsabilidad individual.',
    },
  ];

  // Los testimonios nuevos (7ma edición) van primero; después los históricos.
  const testimonialImageUrls = [
    ...Array.from({ length: 17 }, (_, i) => `${TESTIMONIALS_BASE_URL}/nueva-${i + 1}.jpeg`),
    ...Array.from({ length: 8 }, (_, i) => `${TESTIMONIALS_BASE_URL}/${i + 1}.jpg`),
  ];

  const senales = [
    'Entendés lo que te pasa, pero igual lo repetís.',
    'Te cuesta poner límites sin sentir culpa.',
    'Cargás con cosas de tu historia que nunca terminaste de mirar.',
    'Sentís que en tus vínculos siempre termina pasando lo mismo.',
    'Estás bien, pero sabés que podrías estar de otra manera.',
  ];

  const loQueVivis = [
    {
      k: 'Detenerte',
      d: 'Dos días completos fuera del piloto automático, con un grupo que atraviesa lo mismo que vos.',
    },
    {
      k: 'Tu historia',
      d: 'Explorás tu historia emocional y los patrones que aprendiste en la infancia, sin diagnósticos.',
    },
    {
      k: 'Tus vínculos',
      d: 'Entendés por qué te relacionás como te relacionás, con vos y con los demás.',
    },
    {
      k: 'Lo que se repite',
      d: 'Reconocés qué se repite en tu vida y qué heridas siguen sosteniendo esa repetición.',
    },
    {
      k: 'Herramientas',
      d: 'Salís con recursos concretos para llevar lo trabajado a tu vida real, no solo a la sala.',
    },
  ];

  const openSignup = () => setSignupOpen(true);

  return (
    <main className="grain relative min-h-screen text-ivory">
      {enableButterflyOverlay ? <ButterflyOverlay /> : null}

      <SplineBackground
        scene={SPLINE_SCENE_URL}
        className="pointer-events-none fixed inset-0 z-0 [&_spline-viewer]:h-full [&_spline-viewer]:w-full"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-night/45 via-night/85 to-night"
      />

      {/* pb-28: deja aire para la barra fija de inscripción */}
      <div className="relative z-10 pb-28">
        <header
          id="site-header"
          className="sticky top-0 z-30 border-b border-ivory/[0.07] bg-night/85 backdrop-blur-xl"
        >
          <div className="mx-auto w-full max-w-6xl px-6 py-4 sm:px-8">
            <div className="flex justify-center">
              <Image
                src={LOGO_URL}
                alt="Metamorfosis"
                width={300}
                height={84}
                sizes="(min-width: 640px) 300px, 220px"
                priority
                className="h-auto w-[220px] sm:w-[300px]"
              />
            </div>
            <TopNav items={navItems} />
          </div>
        </header>

        {/* ---------------------------------------------------------- HERO */}
        <section id="inicio" className="relative scroll-mt-28 pt-12 sm:pt-16">
          <div
            aria-hidden="true"
            className="aura aura-celeste aura-breathe left-[-10%] top-[-6rem] h-[26rem] w-[26rem]"
          />
          <div
            aria-hidden="true"
            className="aura aura-deep right-[-12%] top-[10rem] h-[30rem] w-[30rem]"
          />

          <div className="relative z-[1] mx-auto w-full max-w-6xl px-6 sm:px-8">
            <div className="grid items-center gap-14 lg:grid-cols-[0.92fr,1.08fr] lg:gap-16">
              {/* En mobile el video va primero; en desktop se corre a la derecha. */}
              <Reveal className="lg:order-2">
                <div className="mx-auto w-full max-w-[330px] sm:max-w-[360px] lg:mx-0 lg:ml-auto">
                  <div className="relative overflow-hidden rounded-[24px] border border-ivory/12 bg-black/40 shadow-[0_50px_100px_-45px_rgba(0,0,0,0.95),0_0_70px_-40px_rgba(124,201,236,0.6)]">
                    <div className="aspect-[9/16]">
                      {isVerticalMp4 ? (
                        <AutoplayVideo
                          className="h-full w-full object-cover"
                          src={VIDEO_URL}
                          poster={VIDEO_POSTER_URL}
                        />
                      ) : (
                        <iframe
                          className="h-full w-full"
                          src={VIDEO_URL}
                          title="Video Metamorfosis"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      )}
                    </div>
                  </div>
                </div>
              </Reveal>

              <Reveal delay={0.1} className="lg:order-1">
                <div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <Eyebrow num="7ma">Edición</Eyebrow>
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-ivory/45">
                      {EDITION_DATE_SHORT} · {EDITION_PLACE}
                    </span>
                  </div>

                  <div className="mt-9">
                    <Image
                      src={WORDMARK_URL}
                      alt="Metamorfosis"
                      width={420}
                      height={117}
                      sizes="(min-width: 640px) 420px, 280px"
                      priority
                      className="meta-title-motion h-auto w-[270px] select-none sm:w-[390px] lg:w-[420px]"
                      draggable={false}
                    />
                  </div>

                  <h1 className="display mt-8 text-[2.6rem] sm:text-[3.5rem] lg:text-[4rem]">
                    Taller de <br className="hidden sm:block" />
                    <em>Inteligencia Emocional</em>
                  </h1>

                  <p className="mt-8 max-w-prose text-[17px] leading-relaxed text-ivory/70 sm:text-lg">
                    Un fin de semana para mirar de verdad lo que venís cargando hace años, entender de
                    dónde viene y empezar a transformarlo.
                  </p>

                  <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <PrimaryButton href="/entradas" onClick={openSignup}>Comprar entrada</PrimaryButton>
                    <GhostButton onClick={() => scrollToSection('fase-1')}>Cómo es la Fase 1</GhostButton>
                  </div>

                  <dl className="mt-14 grid grid-cols-3 gap-4 border-t border-ivory/[0.12] pt-7">
                    {[
                      ['+6', 'ediciones'],
                      ['2', 'días presenciales'],
                      ['3', 'fases en total'],
                    ].map(([value, label]) => (
                      <div key={label}>
                        <dt className="numeric text-3xl font-light text-ivory sm:text-4xl">{value}</dt>
                        <dd className="mt-2 text-[11px] uppercase leading-snug tracking-[0.14em] text-ivory/45">
                          {label}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* --------------------------------------------- 01 · IDENTIFICACIÓN */}
        <Section id="senales">
          <div className="grid gap-12 lg:grid-cols-[0.85fr,1.15fr] lg:gap-20">
            <Reveal>
              <SectionHeading
                num="01"
                eyebrow="Quizás te suene"
                title={
                  <>
                    Nada está <em>mal</em>. Pero algo pide ser mirado.
                  </>
                }
              />
            </Reveal>

            <Reveal delay={0.08}>
              <ul>
                {senales.map((item, i) => (
                  <li
                    key={item}
                    className="flex items-baseline gap-5 border-b border-ivory/[0.1] py-6 first:pt-0"
                  >
                    <span className="numeric flex-none text-sm font-semibold text-celeste/80">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-[17px] leading-relaxed text-ivory/80">{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-8 text-[15px] italic leading-relaxed text-ivory/50">
                Hay momentos en la vida donde algo dentro tuyo pide ser mirado de verdad. Si estás leyendo
                esto, quizás sea ahora.
              </p>
            </Reveal>
          </div>
        </Section>

        {/* --------------------------------------------------- 02 · QUÉ ES */}
        <Section id="que-es-meta">
          <div
            aria-hidden="true"
            className="aura aura-celeste right-[-8%] top-[20%] h-[24rem] w-[24rem] opacity-70"
          />

          <Reveal>
            <SectionHeading
              num="02"
              eyebrow="La promesa"
              title={
                <>
                  Acá te convertís en esa persona{' '}
                  <em className="uppercase tracking-normal">emocionalmente inteligente</em>
                </>
              }
              lead="No es entender más sobre emociones: es poder reconocer lo que sentís, saber de dónde viene y elegir qué hacer con eso. En tu vida real, en el medio de una discusión o de un mal día, no solo cuando estás tranquila leyendo sobre el tema."
            />
          </Reveal>

          {/* Tres tarjetas con textos de largo parejo: si uno es el doble que
              otro, la fila se ve desbalanceada. */}
          <div className="mt-16 grid gap-5 sm:grid-cols-3">
            {[
              {
                label: 'Cómo se trabaja',
                title: 'Dinámicas vivenciales, no una clase',
                body: 'Ejercicios prácticos y espacios de reflexión donde reconocés los patrones que hoy están limitando distintas áreas de tu vida.',
              },
              {
                label: 'Qué miramos',
                title: 'Tu historia, no tu diagnóstico',
                body: 'De dónde viene lo que sentís: los patrones que aprendiste, muchos de ellos en la infancia, y lo que hacés hoy con eso.',
              },
              {
                label: 'A dónde llegás',
                title: 'Cambios concretos, no solo entender',
                body: 'Sostener el cambio en lo cotidiano: en cómo respondés, cómo ponés límites y cómo te hablás a vos misma.',
              },
            ].map((card, i) => (
              <Reveal key={card.title} delay={i * 0.07}>
                <div className="surface flex h-full flex-col p-8 sm:p-9">
                  <div className="flex items-baseline gap-3">
                    <span className="numeric text-sm font-semibold text-celeste">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-ivory/45">
                      {card.label}
                    </span>
                  </div>

                  <h3 className="display-sm mt-6 text-[1.45rem] leading-snug [text-wrap:balance]">
                    {card.title}
                  </h3>

                  <p className="mt-5 text-[16px] leading-[1.65] text-ivory/65">{card.body}</p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* EL DIFERENCIAL: pocas herramientas, pero las que ordenan al resto */}
          <Reveal>
            <div className="surface surface-accent mt-6 grid gap-9 p-8 sm:p-12 lg:grid-cols-[auto,1fr] lg:items-center lg:gap-16">
              <div className="text-center lg:text-left">
                <p className="numeric text-[4.5rem] font-light leading-none text-celeste sm:text-[6.5rem]">
                  1–2
                </p>
                <p className="mt-3 text-[11px] font-bold uppercase leading-relaxed tracking-[0.2em] text-ivory/45">
                  herramientas
                  <br />
                  no cien
                </p>
              </div>

              <div>
                <h3 className="display text-[1.75rem] leading-tight sm:text-[2.3rem]">
                  No te llenamos de técnicas. Te damos <em>la que ordena todas las demás.</em>
                </h3>
                <p className="mt-6 text-[17px] leading-relaxed text-ivory/70">
                  La mayoría de los espacios te dan decenas de técnicas que después, en el medio de una
                  discusión o de un mal día, no sabés cuál usar. Acá hacemos lo contrario: trabajamos una o
                  dos herramientas centrales, y son esas las que te permiten ordenar todo el resto —lo que
                  ya sabías, lo que vas a aprender después y lo que usás sin darte cuenta.
                </p>
                <p className="mt-5 text-[17px] leading-relaxed text-ivory/85">
                  Esa es la diferencia entre saber mucho sobre emociones y{' '}
                  <span className="font-semibold text-celeste">
                    ser, de verdad, una persona emocionalmente inteligente.
                  </span>
                </p>
              </div>
            </div>
          </Reveal>

          {/* Aclaración a todo el ancho: como nota al pie de la sección */}
          <div className="mt-12 border-t border-ivory/[0.1] pt-7">
            <p className="text-center text-[14px] leading-relaxed text-ivory/45 [text-wrap:balance]">
              No trabajamos desde el diagnóstico ni desde la patología, sino desde el desarrollo personal y
              emocional. No reemplaza un proceso terapéutico, pero sí ofrece herramientas de conciencia,
              introspección y transformación.
            </p>
          </div>
        </Section>

        {/* ---------------------------------------------- 03 · TESTIMONIOS */}
        <Section id="testimonios">
          <Reveal>
            <SectionHeading
              num="03"
              eyebrow="Prueba social"
              title={
                <>
                  No lo decimos <em>nosotros</em>
                </>
              }
              lead="Lo que nos escribieron quienes ya atravesaron Metamorfosis, en sus propias palabras."
              align="center"
            />
          </Reveal>

          <div className="mt-14">
            <Reveal>
              <TestimonialsCarousel imageUrls={testimonialImageUrls} href={TESTIMONIALS_HIGHLIGHT_URL} />
            </Reveal>
          </div>
        </Section>

        {/* -------------------------------------------------- 04 · FASE 1 */}
        <Section id="fase-1">
          <div
            aria-hidden="true"
            className="aura aura-celeste aura-breathe left-[-10%] top-[35%] h-[28rem] w-[28rem]"
          />

          <Reveal>
            <SectionHeading
              num="04"
              eyebrow="La puerta de entrada"
              title={
                <>
                  La Fase 1 es tu <em>punto de partida</em>
                </>
              }
              lead="Un fin de semana intensivo, presencial y movilizador, diseñado para que descubras aspectos tuyos que muchas veces quedan tapados por la rutina."
            />
          </Reveal>

          {/* MODALIDAD — franja de datos a todo el ancho, para que no quede
              una tarjeta corta con un hueco al lado */}
          <Reveal>
            <div className="surface mt-14 grid divide-y divide-ivory/10 sm:mt-16 sm:grid-cols-3 sm:divide-y-0 sm:divide-x">
              {[
                ['Cuándo', FASE1_SCHEDULE, 'ambos días'],
                ['Dónde', 'Presencial', EDITION_PLACE],
                ['Fecha', EDITION_DATE_LABEL, `hasta ${WAITLIST_MAX} personas`],
              ].map(([term, main, detail]) => (
                <div key={term} className="px-7 py-7 sm:px-8 sm:py-9">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-celeste">{term}</p>
                  <p className="display-sm mt-4 text-[1.15rem] leading-snug text-ivory">{main}</p>
                  <p className="mt-2 text-[14px] leading-relaxed text-ivory/50">{detail}</p>
                </div>
              ))}
            </div>
          </Reveal>

          {/* QUÉ VAS A VIVIR — grilla numerada, más ordenada que la lista larga */}
          <div className="mt-16 sm:mt-20">
            <Reveal>
              <MetaLabel>Qué vas a vivir ese fin de semana</MetaLabel>
            </Reveal>

            <div className="mt-9 grid gap-x-10 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              {loQueVivis.map((item, i) => (
                <Reveal key={item.k} delay={(i % 3) * 0.06}>
                  <div className="h-full border-t border-ivory/[0.12] pt-6">
                    <span className="numeric text-sm font-semibold text-celeste/80">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <p className="display-sm mt-3 text-[1.2rem] text-ivory">{item.k}</p>
                    <p className="mt-3 pb-6 text-[15px] leading-relaxed text-ivory/65">{item.d}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          {/* PRECIO — centrado abajo, como cierre de la sección */}
          <Reveal delay={0.1}>
            <div className="mx-auto mt-14 max-w-xl sm:mt-16">
              <div className="surface surface-accent p-7 text-center sm:p-10">
                <div className="flex justify-center">
                  <MetaLabel>Tu entrada a la Fase 1</MetaLabel>
                </div>

                <p className="mt-8 text-[13px] uppercase tracking-[0.16em] text-ivory/50">En un solo pago</p>

                <p className="numeric mt-4 text-[3.5rem] font-light leading-none text-white sm:text-[4.5rem]">
                  {FULL_PRICE_LABEL}
                </p>

                <p className="mt-5 text-[15px] text-ivory/50">{EVENT_DATE_LABEL}</p>

                <div className="mx-auto mt-10 max-w-md border-t border-ivory/12 pt-9">
                  <p className="display-sm text-[1.2rem] text-ivory">¿Preferís pagarlo en dos partes?</p>
                  <p className="mt-4 text-[16px] leading-relaxed text-ivory/70">
                    Son <span className="font-semibold text-celeste">2 pagos de {SPLIT_INSTALLMENT_LABEL}</span>: el
                    primero reserva tu lugar y el segundo lo pagás {BALANCE_DEADLINE_LABEL}.
                  </p>
                  <p className="mt-4 text-[13px] leading-relaxed text-ivory/40">
                    Total en dos pagos: {SPLIT_TOTAL_LABEL}.
                  </p>
                </div>

                <PrimaryButton href="/entradas" onClick={openSignup} className="mt-10 w-full">
                  Comprar mi entrada
                </PrimaryButton>

                <p className="mt-5 text-[13px] leading-relaxed text-ivory/40">
                  Pagás con Mercado Pago y tu entrada con QR te llega por WhatsApp.
                </p>
              </div>
            </div>
          </Reveal>
        </Section>

        {/* --------------------------------------------------- INSCRIPCIÓN */}
        <section id="inscribirme" className="relative scroll-mt-28 py-20 sm:py-24">
          <div
            aria-hidden="true"
            className="aura aura-celeste left-1/2 top-1/4 h-[26rem] w-[26rem] -translate-x-1/2 opacity-70"
          />
          <div className="relative z-[1] mx-auto w-full max-w-xl px-6 sm:px-8">
            <Reveal>
              <div className="surface surface-accent p-8 sm:p-10">
                <TicketCheckout source="seccion-inscripcion" />
              </div>
            </Reveal>
          </div>
        </section>

        {/* ------------------------------------------------- 05 · CONOCENOS */}
        <Section id="conocenos">
          <div className="grid gap-12 lg:grid-cols-[0.8fr,1.2fr] lg:items-start lg:gap-20">
            <Reveal>
              {/* Sin recorte: la foto es 624x1157, cualquier marco fijo le corta la cabeza. */}
              <div className="mx-auto max-w-[300px] overflow-hidden rounded-[24px] border border-ivory/12 bg-black/30 sm:max-w-[360px] lg:mx-0 lg:max-w-none">
                <Image
                  src={PORTRAIT_URL}
                  alt="Daiana Duartte"
                  width={624}
                  height={1157}
                  sizes="(min-width: 1024px) 380px, (min-width: 640px) 360px, 300px"
                  className="h-auto w-full"
                />
              </div>
            </Reveal>

            <Reveal delay={0.08}>
              <div>
                <Eyebrow num="05">Quién te acompaña</Eyebrow>
                <h2 className="display mt-6 text-[2.15rem] sm:text-[2.75rem]">Daiana Duartte</h2>
                <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-celeste">
                  Coach · Facilitadora · Estudiante de Psicología
                </p>

                <div className="mt-8 grid max-w-prose gap-5 text-[17px] leading-relaxed text-ivory/70">
                  <p>
                    Acompaño a personas que desean comprender sus patrones de conducta, cuestionar sus
                    creencias y construir una relación más consciente y amorosa consigo mismas.
                  </p>
                  <p>
                    Creo profundamente que muchas de nuestras formas de actuar nacen de nuestra historia y
                    de cómo aprendimos a vincularnos con el mundo.
                  </p>
                  <p>
                    A través de talleres creo espacios seguros de reflexión y autoconocimiento donde cada
                    persona puede mirarse con mayor claridad, recuperar su poder personal y empezar a
                    elegir desde un lugar más auténtico.
                  </p>
                  <p className="border-l-2 border-celeste/50 pl-6 italic text-ivory/85">
                    Mi propósito es acompañar procesos de transformación reales, sostenibles y
                    profundamente humanos, donde puedas reconocer tu verdad.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </Section>

        {/* ------------------------------------------ 06 · SIGUIENTES FASES */}
        <Section id="siguientes-fases">
          <Reveal>
            <SectionHeading
              num="06"
              eyebrow="Después de la Fase 1"
              title={
                <>
                  Y si querés, el camino <em>continúa</em>
                </>
              }
              lead="Primero se vive la Fase 1. Recién después, y solo si vos querés, se abre el resto del proceso. Nada se vende como paquete cerrado."
            />
          </Reveal>

          <div className="mt-14 grid gap-8 sm:grid-cols-3">
            {[
              {
                n: '01',
                t: '8 encuentros semanales',
                d: 'Quienes deciden continuar tienen 8 encuentros, uno por semana, presenciales o por Meet, para seguir profundizando hasta llegar a la Segunda Fase.',
              },
              {
                n: '02',
                t: 'Fases 2 y 3',
                d: 'Metamorfosis está pensado como un proceso de 4 meses dividido en 3 fases. Se ingresa siempre por la Fase 1 y después decidís cómo continuar.',
              },
              {
                n: '03',
                t: 'Sin obligación',
                d: 'Una vez finalizada la Primera Fase, cada persona elige libremente si desea seguir avanzando o dar por finalizada su experiencia.',
              },
            ].map((step, i) => (
              <Reveal key={step.t} delay={i * 0.07}>
                <div className="border-t border-celeste/25 pt-7">
                  <span className="numeric text-sm font-semibold text-celeste/80">{step.n}</span>
                  <h3 className="display-sm mt-4 text-[1.35rem]">{step.t}</h3>
                  <p className="mt-4 text-[15px] leading-relaxed text-ivory/65">{step.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* ------------------------------------------------------ 07 · FAQ */}
        <Section id="preguntas">
          <div className="grid gap-12 lg:grid-cols-[0.75fr,1.25fr] lg:gap-20">
            <Reveal>
              <div className="lg:sticky lg:top-40">
                <SectionHeading num="07" eyebrow="Dudas" title="Preguntas frecuentes" />
              </div>
            </Reveal>

            <Reveal delay={0.08}>
              <Faq items={faqItems} />
            </Reveal>
          </div>
        </Section>

        {/* ---------------------------------------------------------- CIERRE */}
        <section className="relative scroll-mt-28 pb-24 pt-4">
          <div className="relative z-[1] mx-auto w-full max-w-6xl px-6 sm:px-8">
            <Reveal>
              <div className="surface surface-accent overflow-hidden px-7 py-16 text-center sm:px-16 sm:py-20">
                <p className="display mx-auto max-w-2xl text-[1.9rem] leading-[1.2] sm:text-[2.5rem]">
                  Si sentís que este puede ser tu momento para conocerte más y generar cambios reales,{' '}
                  <em>va a ser un placer acompañarte.</em>
                </p>
                <div className="mt-11 flex justify-center">
                  <PrimaryButton href="/entradas" onClick={openSignup}>{CTA_LABEL}</PrimaryButton>
                </div>
                <p className="mt-7 text-[11px] uppercase tracking-[0.18em] text-ivory/40">
                  {EDITION_DATE_SHORT} · {EDITION_PLACE} · Cupos reducidos
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        <footer className="border-t border-ivory/[0.08]">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-10 text-xs text-ivory/40 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p>
              © {new Date().getFullYear()} Metamorfosis{' '}
              <span className="text-ivory/30">·</span> Daiana &amp; Sebastiam
            </p>
            <p className="uppercase tracking-[0.16em]">
              {EDITION_NAME} · {EDITION_PLACE}
            </p>
          </div>
        </footer>

        <FloatingWhatsApp />
      </div>

      <StickyInscripcionBar onOpen={openSignup} />
      <TicketCheckoutModal open={signupOpen} onClose={() => setSignupOpen(false)} />
    </main>
  );
}
