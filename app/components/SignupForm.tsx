'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';

import { submitSignup } from '@/app/actions/signup';
import {
  CTA_LABEL,
  CTA_LINE_BOTTOM,
  CTA_LINE_TOP,
  EDITION_DATE_LABEL,
  INSTAGRAM_DM_URL,
  buildSignupMessage,
  buildWhatsAppUrl,
  onlyDigits,
} from '@/app/lib/inscripcion';

type Status = 'idle' | 'saved' | 'error';

/*
  Campos "sólidos": en celular una línea fina no se lee como campo.
  text-[16px] es obligatorio — por debajo de eso iOS hace zoom al enfocar.
*/
const inputClass =
  'h-[52px] w-full rounded-xl border border-ivory/12 bg-ivory/[0.05] px-4 text-[16px] text-ivory outline-none transition duration-300 placeholder:text-ivory/25 focus:border-celeste/70 focus:bg-ivory/[0.09]';

const labelClass = 'mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-ivory/45';

export function SignupForm({
  source = 'landing',
  compact = false,
  onDone,
}: {
  source?: string;
  compact?: boolean;
  onDone?: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [social, setSocial] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [touched, setTouched] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [isPending, startTransition] = useTransition();

  const phoneDigits = useMemo(() => onlyDigits(phone), [phone]);
  const isValid = fullName.trim().length >= 3 && phoneDigits.length >= 8;

  const waUrl = useMemo(
    () => buildWhatsAppUrl(buildSignupMessage({ fullName, phone: phoneDigits, social })),
    [fullName, phoneDigits, social]
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    if (!isValid || isPending) return;
    if (honeypot.trim()) return; // bot

    startTransition(async () => {
      const result = await submitSignup({
        fullName: fullName.trim(),
        phone: phoneDigits,
        social: social.trim(),
        source,
      });

      // Guardado o no, la persona tiene que poder seguir por WhatsApp.
      setStatus(result.ok ? 'saved' : 'error');
      onDone?.();

      try {
        window.open(waUrl, '_blank', 'noopener,noreferrer');
      } catch {
        // Si el navegador lo bloquea, queda el boton visible en pantalla.
      }
    });
  };

  if (status !== 'idle') {
    return (
      // Alineado a la izquierda igual que el formulario: mezclar centrado y
      // alineado a la izquierda es lo que hacía ver desprolijo este paso.
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-celeste">Listo</p>
        <p className="display mt-4 text-[1.9rem] leading-tight">
          Gracias{fullName.trim() ? `, ${fullName.trim().split(/\s+/)[0]}` : ''}
        </p>
        <p className="mt-4 text-[16px] leading-relaxed text-ivory/65">
          {status === 'saved'
            ? 'Ya quedaste en la lista de la 7ma edición. Terminá de reservar tu lugar por WhatsApp: ahí te pasamos las fechas exactas y las formas de pago.'
            : 'No pudimos guardar tus datos automáticamente, pero podés escribirnos ahora mismo por WhatsApp con todo cargado.'}
        </p>

        <a
          href={waUrl}
          target="_blank"
          rel="noreferrer"
          className="group mt-8 flex items-center justify-between gap-4 rounded-2xl bg-celeste px-5 py-3 shadow-[0_16px_40px_-16px_rgba(124,201,236,0.85)] transition duration-300"
        >
          <span className="flex min-w-0 flex-col items-start text-left">
            <span className="text-[10px] font-extrabold uppercase leading-none tracking-[0.2em] text-night/60">
              Último paso
            </span>
            <span className="display-sm mt-1.5 text-[1.15rem] font-bold leading-tight text-night">
              Abrir WhatsApp
            </span>
          </span>
          <span
            aria-hidden="true"
            className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-night text-celeste transition-transform duration-300 group-hover:translate-x-1"
          >
            →
          </span>
        </a>

        <a
          href={INSTAGRAM_DM_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-5 block text-center text-[11px] uppercase tracking-[0.16em] text-ivory/40 underline-offset-4 transition hover:text-ivory/80 hover:underline"
        >
          Prefiero Instagram
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {!compact ? (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-celeste">Inscripción</p>
          <h3 className="display mt-4 text-[1.9rem] leading-tight sm:text-[2.25rem]">
            Reservá tu lugar en la Fase 1
          </h3>
          <p className="mt-4 max-w-prose text-[16px] leading-relaxed text-ivory/65">
            Dejanos tu nombre y tu WhatsApp. Te escribimos con las fechas exactas de{' '}
            {EDITION_DATE_LABEL.toLowerCase()}, el valor y cómo reservar. Sin compromiso.
          </p>
        </div>
      ) : null}

      <div className={`grid gap-4 ${compact ? '' : 'mt-9'}`}>
        <label className="block">
          <span className={labelClass}>Tu nombre</span>
          <input
            className={inputClass}
            placeholder="Juan Pérez"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            onBlur={() => setTouched(true)}
            autoComplete="name"
            enterKeyHint="next"
          />
        </label>

        <label className="block">
          <span className={labelClass}>Tu WhatsApp</span>
          <input
            className={inputClass}
            placeholder="+54 11 1234 5678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => setTouched(true)}
            inputMode="tel"
            autoComplete="tel"
            enterKeyHint="next"
          />
        </label>

        <label className="block">
          <span className={labelClass}>
            Red social <span className="text-ivory/25">(opcional)</span>
          </span>
          <input
            className={inputClass}
            placeholder="@tuinstagram"
            value={social}
            onChange={(e) => setSocial(e.target.value)}
            autoComplete="off"
            enterKeyHint="send"
          />
        </label>

        {/* Honeypot anti-bots: invisible para personas. */}
        <input
          type="text"
          name="empresa"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          className="pointer-events-none absolute h-0 w-0 opacity-0"
        />
      </div>

      {touched && !isValid ? (
        <p className="mt-5 text-[15px] text-sand">
          Necesitamos tu nombre y un WhatsApp válido para poder escribirte.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        aria-label={CTA_LABEL}
        className="group relative mt-9 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-white via-celeste to-celeste-deep p-[1px] shadow-[0_16px_40px_-16px_rgba(124,201,236,0.85)] transition duration-300 hover:shadow-[0_20px_50px_-14px_rgba(124,201,236,1)] disabled:opacity-60"
      >
        <span className="relative flex items-center justify-between gap-4 rounded-[15px] bg-celeste px-5 py-3">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent transition-transform duration-700 group-hover:translate-x-full"
          />

          {isPending ? (
            <span className="relative w-full text-center text-[13px] font-extrabold uppercase tracking-[0.14em] text-night">
              Enviando…
            </span>
          ) : (
            <>
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
            </>
          )}
        </span>
      </button>

      <p className="mt-5 text-center text-[11px] uppercase tracking-[0.14em] text-ivory/35">
        Cupos reducidos · No hacemos spam
      </p>
    </form>
  );
}

export function SignupModal({
  open,
  onClose,
  source = 'modal',
}: {
  open: boolean;
  onClose: () => void;
  source?: string;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
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

  // Por portal a <body>: así ningún ancestro con blur/transform lo recorta.
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={CTA_LABEL}
    >
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        style={{ backgroundColor: 'rgba(4, 7, 14, 0.92)' }}
        className="absolute inset-0 h-full w-full cursor-default backdrop-blur-xl"
      />

      <div
        ref={panelRef}
        // Fondo sólido y padding que respeta la barra de gestos del celular.
        style={{
          backgroundColor: '#080C16',
          paddingBottom: 'calc(1.75rem + env(safe-area-inset-bottom, 0px))',
        }}
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[24px] border border-ivory/12 px-6 pt-4 shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.9)] sm:rounded-[24px] sm:px-8 sm:pt-7"
      >
        {/* Agarradera: hace que se lea como hoja deslizable y no como un corte */}
        <div aria-hidden="true" className="mx-auto mb-5 h-1 w-10 rounded-full bg-ivory/20 sm:hidden" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-celeste">
              Fase 1 · 7ma edición
            </p>
            <p className="display mt-2 text-[1.6rem] leading-tight">Reservá tu lugar</p>
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

        <div className="mt-6">
          <SignupForm source={source} compact />
        </div>
      </div>
    </div>,
    document.body
  );
}
