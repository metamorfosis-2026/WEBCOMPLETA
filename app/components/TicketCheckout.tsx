'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';

import { startTicketCheckout, type CheckoutError } from '@/app/actions/entradas';
import {
  BALANCE_DEADLINE_LABEL,
  EVENT_DATE_LABEL,
  EVENT_HOURS_LABEL,
  EVENT_PLACE,
  FULL_PRICE_LABEL,
  SPLIT_INSTALLMENT_LABEL,
  SPLIT_TOTAL_LABEL,
  TICKET_PLANS,
  formatPesos,
  type TicketPlan,
} from '@/app/lib/entradas';
import { EDITION_DATE_LABEL, INSTAGRAM_DM_URL } from '@/app/lib/inscripcion';
import { isValidWhatsAppNumber, prettyPhone, toWhatsAppNumber } from '@/app/lib/phone';

// NETWORK / NO_URL los detecta el navegador (no vienen del servidor).
type ErrorCode = CheckoutError | 'NETWORK' | 'NO_URL';

const ERROR_TEXT: Record<ErrorCode, string> = {
  INVALID: 'Revisá tu nombre y tu email.',
  PHONE: 'Revisá tu WhatsApp: código de área sin el 0 y el número sin el 15 (ej: 11 6445 0430).',
  SOLD_OUT: 'Se agotaron las entradas de esta edición. Escribinos por Instagram y te sumamos a la lista de espera.',
  PAYMENTS_OFF: 'El pago online todavía no está habilitado. Escribinos por Instagram y te pasamos cómo pagar.',
  FAILED: 'No pudimos abrir Mercado Pago. Probá de nuevo en un momento.',
  RETRY: 'No pudimos procesar el pedido. Esperá unos segundos y volvé a tocar el botón.',
  NETWORK:
    'No pudimos conectarnos. Revisá tu conexión y probá de nuevo. Si estás en el navegador de Instagram o Facebook, abrí esta página en tu navegador (menú ··· → Abrir en el navegador).',
  NO_URL: 'No recibimos el link de Mercado Pago. Probá de nuevo en un momento.',
};

// Si a los 6 s el navegador sigue en la pagina, mostramos el link a mano.
const REDIRECT_FALLBACK_MS = 6000;

// text-[16px] es obligatorio: por debajo de eso iOS hace zoom al enfocar.
const inputClass =
  'h-[52px] w-full rounded-xl border border-ivory/12 bg-ivory/[0.05] px-4 text-[16px] text-ivory outline-none transition duration-300 placeholder:text-ivory/25 focus:border-celeste/70 focus:bg-ivory/[0.09]';
const labelClass = 'mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-ivory/45';

const PLAN_COPY: Record<TicketPlan, { price: string; detail: string; badge?: string }> = {
  FULL: {
    price: FULL_PRICE_LABEL,
    detail: 'Un solo pago y listo.',
    badge: `Ahorrás ${formatPesos(TICKET_PLANS.SPLIT.totalCents - TICKET_PLANS.FULL.totalCents)}`,
  },
  SPLIT: {
    price: `2 × ${SPLIT_INSTALLMENT_LABEL}`,
    detail: `Pagás ${SPLIT_INSTALLMENT_LABEL} ahora para reservar y el resto ${BALANCE_DEADLINE_LABEL}. Total ${SPLIT_TOTAL_LABEL}.`,
  },
};

export function TicketCheckout({
  source = 'web',
  compact = false,
  remaining,
}: {
  source?: string;
  compact?: boolean;
  remaining?: number | null;
}) {
  const [plan, setPlan] = useState<TicketPlan>('FULL');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [showManualLink, setShowManualLink] = useState(false);
  // Hasta que React hidrata el boton queda deshabilitado: si no, un toque en
  // un celular lento hacia un submit nativo que recargaba la pagina.
  const [hydrated, setHydrated] = useState(false);
  const mountedAt = useRef(0);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    mountedAt.current = Date.now();
    setHydrated(true);

    // Safari restaura la pagina desde su cache al volver de Mercado Pago:
    // sin esto el boton quedaba trabado en "Abriendo Mercado Pago…".
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setRedirectUrl(null);
        setShowManualLink(false);
      }
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  useEffect(() => {
    if (!redirectUrl) return;
    const timer = window.setTimeout(() => setShowManualLink(true), REDIRECT_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [redirectUrl]);

  const waNumber = useMemo(() => toWhatsAppNumber(phone), [phone]);
  const phoneOk = isValidWhatsAppNumber(waNumber);
  const emailOk = !email.trim() || /^\S+@\S+\.\S+$/.test(email.trim());
  const isValid = fullName.trim().length >= 3 && phoneOk && emailOk;
  const firstPayment = plan === 'FULL' ? FULL_PRICE_LABEL : SPLIT_INSTALLMENT_LABEL;
  const redirecting = Boolean(redirectUrl);
  const busy = isPending || redirecting;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    setError(null);
    if (!hydrated || !isValid || busy) return;

    startTransition(async () => {
      try {
        // El campo oculto va al servidor como senal; nunca cortamos aca en silencio.
        const result = await startTicketCheckout({
          plan,
          fullName: fullName.trim(),
          phone: waNumber,
          email: email.trim(),
          source,
          hp: honeypot,
          elapsedMs: Date.now() - mountedAt.current,
        });
        if (!result.ok) {
          setError(result.error ?? 'FAILED');
          return;
        }
        if (!result.url) {
          setError('NO_URL');
          return;
        }
        setRedirectUrl(result.url);
        window.location.assign(result.url);
      } catch (failure) {
        console.error('[entradas] no se pudo iniciar el pago:', failure);
        setError('NETWORK');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} method="post" noValidate>
      {!compact ? (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-celeste">Entradas · 7ma edición</p>
          <h3 className="display mt-4 text-[1.9rem] leading-tight sm:text-[2.25rem]">Asegurá tu lugar en la Fase 1</h3>
          <p className="mt-4 max-w-prose text-[16px] leading-relaxed text-ivory/65">
            {EVENT_DATE_LABEL} · {EVENT_HOURS_LABEL} · {EVENT_PLACE}. Pagás con Mercado Pago y tu entrada con QR te
            llega por WhatsApp.
          </p>
        </div>
      ) : null}

      {typeof remaining === 'number' && remaining > 0 && remaining <= 15 ? (
        <p className={`chip chip-sand ${compact ? '' : 'mt-6'}`}>
          {remaining === 1 ? 'Queda 1 lugar' : `Quedan ${remaining} lugares`}
        </p>
      ) : null}

      <fieldset className={compact ? 'mt-5' : 'mt-7'}>
        <legend className={labelClass}>¿Cómo querés pagar?</legend>
        <div className="grid gap-3">
          {(Object.keys(PLAN_COPY) as TicketPlan[]).map((id) => {
            const copy = PLAN_COPY[id];
            const active = plan === id;
            return (
              <label
                key={id}
                className={`flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition duration-300 ${
                  active ? 'border-celeste/70 bg-celeste/[0.1]' : 'border-ivory/12 bg-ivory/[0.03] hover:border-ivory/25'
                }`}
              >
                <input
                  type="radio"
                  name="plan"
                  value={id}
                  checked={active}
                  onChange={() => setPlan(id)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`mt-1 flex h-5 w-5 flex-none items-center justify-center rounded-full border ${
                    active ? 'border-celeste' : 'border-ivory/30'
                  }`}
                >
                  {active ? <span className="h-2.5 w-2.5 rounded-full bg-celeste" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-[15px] font-semibold text-ivory">{TICKET_PLANS[id].label}</span>
                    <span className="numeric text-[1.35rem] text-white">{copy.price}</span>
                  </span>
                  <span className="mt-1.5 block text-[14px] leading-relaxed text-ivory/55">{copy.detail}</span>
                  {copy.badge ? <span className="chip chip-celeste mt-3">{copy.badge}</span> : null}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-6 grid gap-4">
        <label className="block">
          <span className={labelClass}>Nombre y apellido</span>
          <input
            className={inputClass}
            placeholder="Juana Pérez"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            enterKeyHint="next"
          />
        </label>

        <label className="block">
          <span className={labelClass}>Tu WhatsApp</span>
          <input
            className={inputClass}
            placeholder="11 6445 0430"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            autoComplete="tel"
            enterKeyHint="next"
          />
          <span className="mt-2 block text-[13px] leading-relaxed text-ivory/40">
            {phoneOk ? (
              <>
                Te mandamos la entrada a <span className="text-celeste">{prettyPhone(waNumber)}</span>
              </>
            ) : (
              'Código de área sin el 0 y el número sin el 15. Acá te llega la entrada.'
            )}
          </span>
        </label>

        <label className="block">
          <span className={labelClass}>
            Email <span className="text-ivory/25">(opcional, para el comprobante)</span>
          </span>
          <input
            className={inputClass}
            placeholder="juana@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            inputMode="email"
            autoComplete="email"
            enterKeyHint="send"
          />
        </label>

        {/* Anti-bots: invisible, sin label y con un nombre que el autocompletado
            no reconoce. Si igual se llena, el servidor lo usa solo como senal. */}
        <input
          type="text"
          name="hp_m7"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          data-1p-ignore="true"
          data-lpignore="true"
          data-form-type="other"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          className="pointer-events-none absolute h-0 w-0 opacity-0"
        />
      </div>

      {touched && !isValid ? (
        <p className="mt-5 text-[15px] text-sand">
          {!phoneOk && fullName.trim().length >= 3
            ? ERROR_TEXT.PHONE
            : !emailOk
              ? 'Revisá el email (o dejalo vacío).'
              : 'Necesitamos tu nombre y un WhatsApp válido para mandarte la entrada.'}
        </p>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-sand/30 bg-sand/[0.08] p-4 text-[15px] leading-relaxed text-sand"
        >
          {ERROR_TEXT[error]}
          {error === 'SOLD_OUT' || error === 'PAYMENTS_OFF' ? (
            <a href={INSTAGRAM_DM_URL} target="_blank" rel="noreferrer" className="mt-2 block font-semibold underline">
              Escribir por Instagram
            </a>
          ) : null}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={busy || !hydrated}
        aria-busy={busy || !hydrated}
        className="group relative mt-8 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-white via-celeste to-celeste-deep p-[1px] shadow-[0_16px_40px_-16px_rgba(124,201,236,0.85)] transition duration-300 hover:shadow-[0_20px_50px_-14px_rgba(124,201,236,1)] disabled:opacity-60"
      >
        <span className="relative flex items-center justify-between gap-4 rounded-[15px] bg-celeste px-5 py-3">
          {busy || !hydrated ? (
            <span className="relative w-full py-2 text-center text-[13px] font-extrabold uppercase tracking-[0.14em] text-night">
              {!hydrated ? 'Cargando…' : redirecting ? 'Abriendo Mercado Pago…' : 'Preparando tu entrada…'}
            </span>
          ) : (
            <>
              <span className="relative flex min-w-0 flex-col items-start text-left">
                <span className="text-[10px] font-extrabold uppercase leading-none tracking-[0.2em] text-night/60 sm:text-[11px]">
                  Pagar con Mercado Pago
                </span>
                <span className="display-sm mt-1.5 text-[1.15rem] font-bold leading-tight text-night sm:text-[1.3rem]">
                  {plan === 'FULL' ? `Pagar ${firstPayment}` : `Reservar con ${firstPayment}`}
                </span>
              </span>
              <span
                aria-hidden="true"
                className="relative flex h-10 w-10 flex-none items-center justify-center rounded-full bg-night text-celeste transition-transform duration-300 group-hover:translate-x-1"
              >
                →
              </span>
            </>
          )}
        </span>
      </button>

      {redirectUrl && showManualLink ? (
        <p className="mt-4 text-center text-[14px] leading-relaxed text-ivory/70">
          ¿No se abrió?{' '}
          <a href={redirectUrl} className="font-semibold text-celeste underline">
            Tocá acá para ir a Mercado Pago
          </a>
        </p>
      ) : null}

      <p className="mt-5 text-center text-[13px] leading-relaxed text-ivory/40">
        Pagás dentro de Mercado Pago (tarjeta, débito, dinero en cuenta o efectivo). Apenas se acredita te llega tu
        entrada con QR por WhatsApp.
      </p>
    </form>
  );
}

export function TicketCheckoutModal({
  open,
  onClose,
  source = 'modal',
}: {
  open: boolean;
  onClose: () => void;
  source?: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  // Por portal a <body>: asi ningun ancestro con blur/transform lo recorta.
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Comprar entrada">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        style={{ backgroundColor: 'rgba(4, 7, 14, 0.92)' }}
        className="absolute inset-0 h-full w-full cursor-default backdrop-blur-xl"
      />

      <div
        style={{ backgroundColor: '#080C16', paddingBottom: 'calc(1.75rem + env(safe-area-inset-bottom, 0px))' }}
        className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[24px] border border-ivory/12 px-6 pt-4 shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.9)] sm:rounded-[24px] sm:px-8 sm:pt-7"
      >
        <div aria-hidden="true" className="mx-auto mb-5 h-1 w-10 rounded-full bg-ivory/20 sm:hidden" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-celeste">
              Fase 1 · 7ma edición · {EDITION_DATE_LABEL}
            </p>
            <p className="display mt-2 text-[1.6rem] leading-tight">Comprá tu entrada</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full border border-ivory/15 text-ivory/50 transition hover:border-ivory/35 hover:text-ivory"
          >
            ✕
          </button>
        </div>

        <div className="mt-2">
          <TicketCheckout source={source} compact />
        </div>
      </div>
    </div>,
    document.body
  );
}
