'use client';

import { useEffect, useId, useMemo, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';

import { startTicketCheckout, type CheckoutError } from '@/app/actions/entradas';
import { CheckIcon, LockIcon, QrIcon } from '@/app/entradas/icons';
import {
  BALANCE_DEADLINE_LABEL,
  EVENT_DATE_LABEL,
  EVENT_HOURS_LABEL,
  EVENT_PLACE,
  FULL_PRICE_LABEL,
  FULL_SAVINGS_LABEL,
  NEXT_PHASE_PRICE_NOTE,
  SPLIT_INSTALLMENT_LABEL,
  SPLIT_TOTAL_LABEL,
  SUPPORT_LABEL,
  type TicketPlan,
} from '@/app/lib/entradas';
import { INSTAGRAM_DM_URL } from '@/app/lib/inscripcion';
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

// `amount` y `times`: el precio partido para la opcion angosta del celular
// ("2×" chico al lado del monto, asi nunca se corta en dos lineas).
const PLAN_COPY: Record<TicketPlan, { title: string; detail: string; price: string; amount: string; times?: string; note: string }> = {
  FULL: {
    title: 'Pago único',
    detail: 'Pagás todo hoy y listo.',
    price: FULL_PRICE_LABEL,
    amount: FULL_PRICE_LABEL,
    note: `Ahorrás ${FULL_SAVINGS_LABEL}`,
  },
  SPLIT: {
    title: 'En 2 pagos',
    detail: `Hoy ${SPLIT_INSTALLMENT_LABEL} y el resto ${BALANCE_DEADLINE_LABEL}.`,
    price: `2 × ${SPLIT_INSTALLMENT_LABEL}`,
    amount: SPLIT_INSTALLMENT_LABEL,
    times: '2×',
    note: `Total ${SPLIT_TOTAL_LABEL}`,
  },
};

const labelClass = 'block text-[14px] font-medium text-ivory/90';
const hintClass = 'mt-2 text-[13px] leading-relaxed text-ivory/60 [text-wrap:balance]';
const errorTextClass = 'mt-2 text-[13px] leading-relaxed text-sand [text-wrap:balance]';

// compact: /entradas en celular (campos de 48 px, siguen comodos para el dedo).
function inputClass(invalid: boolean, compact = false) {
  return `${compact ? 'mt-1.5 h-12 lg:mt-2 lg:h-[52px]' : 'mt-2 h-[52px]'} w-full rounded-xl border bg-white/[0.04] px-4 text-[16px] text-white outline-none transition placeholder:text-ivory/35 focus:border-celeste focus:bg-white/[0.07] focus:ring-2 focus:ring-celeste/30 ${
    invalid ? 'border-sand/70' : 'border-ivory/15 hover:border-ivory/30'
  }`;
}

/*
  Formulario de compra. Variantes:
  - page: /entradas. Sin titulo de evento (lo pone la pagina) y, en celular,
    barra fija abajo con el plan y el total que envia este mismo form.
  - section: bloque de la home, con su propio encabezado.
  - modal: dentro del modal de la home.
*/
export function TicketCheckout({
  source = 'web',
  variant = 'section',
}: {
  source?: string;
  variant?: 'page' | 'section' | 'modal';
}) {
  const ids = useId();
  const formId = `checkout-${ids}`;
  const [plan, setPlan] = useState<TicketPlan>('FULL');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [showManualLink, setShowManualLink] = useState(false);
  // Hasta que React hidrata los botones quedan deshabilitados: si no, un toque
  // en un celular lento hacia un submit nativo que recargaba la pagina.
  const [hydrated, setHydrated] = useState(false);
  const mountedAt = useRef(0);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
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

  // Con la barra fija abajo, el aviso puede quedar fuera de pantalla: lo traemos.
  useEffect(() => {
    if (error) alertRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [error]);

  const waNumber = useMemo(() => toWhatsAppNumber(phone), [phone]);
  const nameOk = fullName.trim().length >= 3;
  const phoneOk = isValidWhatsAppNumber(waNumber);
  const emailOk = !email.trim() || /^\S+@\S+\.\S+$/.test(email.trim());
  const isValid = nameOk && phoneOk && emailOk;
  const firstPayment = plan === 'FULL' ? FULL_PRICE_LABEL : SPLIT_INSTALLMENT_LABEL;
  const redirecting = Boolean(redirectUrl);
  const busy = isPending || redirecting;
  const showErrors = touched;
  const isPage = variant === 'page';
  // /entradas en celular (< lg): textos, campos y avisos centrados. Escritorio igual que siempre.
  const center = isPage ? ' text-center lg:text-left' : '';

  const buttonLabel = !hydrated
    ? 'Cargando…'
    : redirecting
      ? 'Abriendo Mercado Pago…'
      : isPending
        ? 'Preparando tu entrada…'
        : plan === 'FULL'
          ? `Pagar ${firstPayment}`
          : `Reservar con ${firstPayment}`;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    setError(null);
    if (!hydrated || busy) return;
    if (!isValid) {
      // Llevamos a la persona al primer dato que falta, al centro de la pantalla:
      // con el scroll normal del foco quedaba tapado por la barra fija del celular.
      const target = (!nameOk ? nameRef : !phoneOk ? phoneRef : emailRef).current;
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

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

  const fieldIds = {
    name: `${ids}-nombre`,
    phone: `${ids}-whatsapp`,
    phoneHint: `${ids}-whatsapp-ayuda`,
    email: `${ids}-email`,
    emailHint: `${ids}-email-ayuda`,
    nameError: `${ids}-nombre-error`,
  };

  return (
    <>
      <form id={formId} onSubmit={handleSubmit} method="post" noValidate>
        {variant === 'section' ? (
          <div>
            <p className="text-[15px] font-medium text-celeste">Metamorfosis · 7ma edición</p>
            <h3 className="display mt-3 text-[2rem] leading-tight text-white sm:text-[2.3rem]">Reservá tu lugar</h3>
            <p className="mt-3 text-[16px] leading-relaxed text-ivory/75">
              {EVENT_DATE_LABEL}, de {EVENT_HOURS_LABEL}, en {EVENT_PLACE}.
            </p>
          </div>
        ) : null}

        {isPage ? (
          <div className={center}>
            <h2 className="display-sm text-[1.6rem] leading-tight text-white">Reservá tu lugar</h2>
            <p className="mt-1 text-[15px] text-ivory/70 [text-wrap:balance] lg:mt-1.5">Elegí cómo pagar y completá tus datos.</p>
          </div>
        ) : null}

        <fieldset className={variant === 'modal' ? 'mt-5' : 'mt-6'}>
          <legend className={`${labelClass}${isPage ? ' w-full text-center lg:text-left' : ''}`}>Forma de pago</legend>
          {/* /entradas en celular: las dos opciones lado a lado. */}
          <div className={`mt-3 grid gap-3${isPage ? ' grid-cols-2 lg:grid-cols-1' : ''}`}>
            {(Object.keys(PLAN_COPY) as TicketPlan[]).map((id) => {
              const copy = PLAN_COPY[id];
              const active = plan === id;
              const radio = (
                <input
                  type="radio"
                  name={`plan-${ids}`}
                  value={id}
                  checked={active}
                  onChange={() => setPlan(id)}
                  className="sr-only"
                />
              );

              /*
                /entradas en celular: dos opciones lado a lado (nombre, precio y
                una linea chica), la elegida con borde, brillo y un check en la
                esquina. El radio sigue ahi, invisible, para teclado y lectores
                de pantalla. En escritorio, la fila de siempre con el radio a la izquierda.
              */
              if (isPage) {
                return (
                  <label
                    key={id}
                    className={`relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border px-2 pb-3.5 pt-3 text-center transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-celeste/70 lg:flex-row lg:justify-start lg:gap-4 lg:px-5 lg:py-4 lg:text-left lg:shadow-none ${
                      active
                        ? 'border-celeste bg-celeste/[0.08] shadow-[0_0_0_1px_rgba(124,201,236,0.55),0_14px_40px_-14px_rgba(124,201,236,0.6)]'
                        : 'border-ivory/15 [@media(hover:hover)]:hover:border-ivory/35'
                    }`}
                  >
                    {radio}
                    {active ? (
                      <span
                        aria-hidden="true"
                        className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-celeste text-night lg:hidden"
                      >
                        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="m5 12.5 4.5 4.5L19 7.5" />
                        </svg>
                      </span>
                    ) : null}

                    {/* celular */}
                    <span className="flex flex-col items-center lg:hidden">
                      <span className="text-[14px] font-semibold text-ivory/90">{copy.title}</span>
                      <span className="numeric mt-0.5 flex items-baseline whitespace-nowrap font-semibold leading-tight text-white">
                        {copy.times ? <span className="mr-1 text-[15px] text-ivory/75">{copy.times}</span> : null}
                        <span className="text-[1.6rem] min-[380px]:text-[1.75rem]">{copy.amount}</span>
                      </span>
                      <span className={`mt-0.5 text-[13px] font-medium ${id === 'FULL' ? 'text-celeste' : 'text-ivory/65'}`}>
                        {copy.note}
                      </span>
                    </span>

                    {/* escritorio */}
                    <span
                      aria-hidden="true"
                      className={`hidden h-5 w-5 flex-none items-center justify-center rounded-full border-2 lg:flex ${
                        active ? 'border-celeste' : 'border-ivory/35'
                      }`}
                    >
                      {active ? <span className="h-2.5 w-2.5 rounded-full bg-celeste" /> : null}
                    </span>
                    <span className="hidden min-w-0 flex-1 lg:block">
                      <span className="block text-[16px] font-semibold text-white">{copy.title}</span>
                      <span className="mt-0.5 block text-[14px] leading-snug text-ivory/70">{copy.detail}</span>
                    </span>
                    <span className="hidden flex-none text-right lg:block">
                      <span className="numeric block text-[1.55rem] font-medium leading-tight text-white">{copy.price}</span>
                      <span className={`block text-[13px] ${id === 'FULL' ? 'text-celeste' : 'text-ivory/60'}`}>{copy.note}</span>
                    </span>
                  </label>
                );
              }

              return (
                <label
                  key={id}
                  className={`flex cursor-pointer items-center gap-4 rounded-2xl border px-4 py-4 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-celeste/70 sm:px-5 ${
                    active ? 'border-celeste bg-celeste/[0.08]' : 'border-ivory/15 hover:border-ivory/35'
                  }`}
                >
                  {radio}
                  <span
                    aria-hidden="true"
                    className={`flex h-5 w-5 flex-none items-center justify-center rounded-full border-2 ${
                      active ? 'border-celeste' : 'border-ivory/35'
                    }`}
                  >
                    {active ? <span className="h-2.5 w-2.5 rounded-full bg-celeste" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-semibold text-white">{copy.title}</span>
                    <span className="mt-0.5 block text-[14px] leading-snug text-ivory/70">{copy.detail}</span>
                  </span>
                  <span className="flex-none text-right">
                    <span className="numeric block text-[1.4rem] font-medium leading-tight text-white sm:text-[1.55rem]">
                      {copy.price}
                    </span>
                    <span className={`block text-[13px] ${id === 'FULL' ? 'text-celeste' : 'text-ivory/60'}`}>
                      {copy.note}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          {/* Celular: que implica el plan elegido, en una sola linea debajo de las dos opciones. */}
          {isPage ? (
            <p className="mt-3 text-center text-[14px] text-ivory/75 [text-wrap:balance] lg:hidden">{PLAN_COPY[plan].detail}</p>
          ) : null}
        </fieldset>

        {/* Que cubre el pago: solo la Fase 1 (fin de semana + 2 meses de
            acompanamiento). La Fase 2 se paga aparte y su valor no se publica. */}
        <div className={`${isPage ? 'mt-4 lg:mt-5' : 'mt-5'} rounded-xl border border-ivory/10 bg-white/[0.03] px-4 py-3.5${center}`}>
          <p className="text-[14px] font-semibold text-white">Tu pago es solo por la Fase 1 e incluye:</p>
          <ul
            className={`mt-2 grid gap-1.5 text-left text-[14px] leading-snug text-ivory/80${
              isPage ? ' mx-auto w-fit max-w-full lg:mx-0' : ''
            }`}
          >
            <li className="flex items-start gap-2">
              <CheckIcon className="mt-px h-4 w-4 flex-none text-celeste" />
              <span>El taller del sábado 28 y domingo 29</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckIcon className="mt-px h-4 w-4 flex-none text-celeste" />
              <span>
                {SUPPORT_LABEL} de Daiana, con actividades y encuentros virtuales o presenciales
              </span>
            </li>
          </ul>
          <p className="mt-2 text-[13px] leading-relaxed text-ivory/60 [text-wrap:balance]">{NEXT_PHASE_PRICE_NOTE}</p>
        </div>

        <div className={isPage ? 'mt-6 grid gap-4 lg:mt-7 lg:gap-5' : 'mt-7 grid gap-5'}>
          <div>
            <label htmlFor={fieldIds.name} className={`${labelClass}${center}`}>
              Nombre y apellido
            </label>
            <input
              ref={nameRef}
              id={fieldIds.name}
              className={`${inputClass(showErrors && !nameOk, isPage)}${center}`}
              placeholder="Juana Pérez"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              enterKeyHint="next"
              aria-invalid={showErrors && !nameOk}
              aria-describedby={showErrors && !nameOk ? fieldIds.nameError : undefined}
            />
            {showErrors && !nameOk ? (
              <p id={fieldIds.nameError} className={`${errorTextClass}${center}`}>
                Escribí tu nombre y apellido.
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor={fieldIds.phone} className={`${labelClass}${center}`}>
              WhatsApp
            </label>
            <input
              ref={phoneRef}
              id={fieldIds.phone}
              className={`${inputClass(showErrors && !phoneOk, isPage)}${center}`}
              placeholder="11 6445 0430"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              autoComplete="tel"
              enterKeyHint="next"
              aria-invalid={showErrors && !phoneOk}
              aria-describedby={fieldIds.phoneHint}
            />
            <p id={fieldIds.phoneHint} className={`${showErrors && !phoneOk ? errorTextClass : hintClass}${center}`}>
              {showErrors && !phoneOk ? (
                ERROR_TEXT.PHONE
              ) : phoneOk ? (
                <>
                  Tu entrada llega a <span className="font-medium text-celeste">{prettyPhone(waNumber)}</span>
                </>
              ) : (
                'Código de área sin el 0 y el número sin el 15. Ahí te llega la entrada.'
              )}
            </p>
          </div>

          <div>
            <label htmlFor={fieldIds.email} className={`${labelClass}${center}`}>
              Email <span className="font-normal text-ivory/55">(opcional)</span>
            </label>
            <input
              ref={emailRef}
              id={fieldIds.email}
              className={`${inputClass(showErrors && !emailOk, isPage)}${center}`}
              placeholder="juana@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              inputMode="email"
              autoComplete="email"
              enterKeyHint="send"
              aria-invalid={showErrors && !emailOk}
              aria-describedby={fieldIds.emailHint}
            />
            <p id={fieldIds.emailHint} className={`${showErrors && !emailOk ? errorTextClass : hintClass}${center}`}>
              {showErrors && !emailOk ? 'Revisá el email o dejalo vacío.' : 'Para el comprobante de Mercado Pago.'}
            </p>
          </div>

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

        {error ? (
          <div
            ref={alertRef}
            role="alert"
            className={`mt-6 scroll-mb-32 rounded-xl border border-sand/40 bg-sand/[0.08] p-4 text-[15px] leading-relaxed text-sand${center}`}
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
          className={`mt-7 h-14 w-full items-center justify-center rounded-2xl bg-celeste px-6 text-[16px] font-semibold text-night shadow-[0_18px_40px_-18px_rgba(124,201,236,0.9)] transition [@media(hover:hover)]:hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-night disabled:cursor-wait disabled:opacity-75 ${
            variant === 'page' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {buttonLabel}
        </button>

        {redirectUrl && showManualLink ? (
          <p className="mt-4 text-center text-[14px] leading-relaxed text-ivory/75">
            ¿No se abrió?{' '}
            <a href={redirectUrl} className="font-semibold text-celeste underline">
              Tocá acá para ir a Mercado Pago
            </a>
          </p>
        ) : null}

        {/* Dos lineas cortas, cada una con su icono: asi no se corta a mitad de frase.
            El bloque va centrado y los iconos quedan en columna. */}
        <ul className={`${isPage ? 'mt-6 lg:mt-4' : 'mt-4'} mx-auto flex w-fit flex-col items-start gap-1.5 text-[13px] leading-snug text-ivory/70`}>
          <li className="flex items-center gap-1.5">
            <LockIcon className="h-4 w-4 flex-none text-ivory/55" />
            Pago seguro con Mercado Pago
          </li>
          <li className="flex items-center gap-1.5">
            <QrIcon className="h-4 w-4 flex-none text-ivory/55" />
            Tu entrada con QR llega por WhatsApp
          </li>
        </ul>
      </form>

      {variant === 'page' ? (
        // Celular: el boton de pago siempre a mano. Envia el mismo form (atributo form).
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-ivory/10 bg-[#070B15] shadow-[0_-12px_32px_rgba(0,0,0,0.55)] lg:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {/* Plan y total centrados en una linea, boton a ancho completo abajo
              (la barra queda en ~106 px de alto, sin contar el borde seguro del iPhone). */}
          <div className="mx-auto w-full max-w-xl px-5 pb-3 pt-2.5">
            <p className="truncate text-center leading-tight" aria-live="polite">
              <span className="align-middle text-[13px] text-ivory/70">
                {plan === 'FULL' ? 'Pago único' : `1 de 2 pagos · total ${SPLIT_TOTAL_LABEL}`}
              </span>
              <span className="numeric ml-2 align-middle text-[1.35rem] font-semibold text-white">{firstPayment}</span>
            </p>
            <button
              type="submit"
              form={formId}
              disabled={busy || !hydrated}
              aria-busy={busy || !hydrated}
              className="mt-2 h-12 w-full rounded-xl bg-celeste px-6 text-[16px] font-semibold text-night transition [@media(hover:hover)]:hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-night disabled:cursor-wait disabled:opacity-75"
            >
              {!hydrated
                ? 'Cargando…'
                : redirecting
                  ? 'Abriendo…'
                  : isPending
                    ? 'Preparando…'
                    : plan === 'FULL'
                      ? 'Pagar'
                      : 'Reservar'}
            </button>
          </div>
        </div>
      ) : null}
    </>
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
            <p className="text-[14px] font-medium text-celeste">Metamorfosis · 7ma edición</p>
            <p className="display mt-1.5 text-[1.6rem] leading-tight text-white">Comprá tu entrada</p>
            <p className="mt-1.5 text-[14px] text-ivory/70">
              {EVENT_DATE_LABEL}, de {EVENT_HOURS_LABEL}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full border border-ivory/15 text-ivory/60 transition hover:border-ivory/35 hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celeste/70"
          >
            ✕
          </button>
        </div>

        <TicketCheckout source={source} variant="modal" />
      </div>
    </div>,
    document.body
  );
}
