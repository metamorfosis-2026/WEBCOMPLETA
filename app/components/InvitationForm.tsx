'use client';

import { useEffect, useId, useMemo, useRef, useState, useTransition } from 'react';

import { acceptInvitation, type InvitationClaimError } from '@/app/actions/invitacion';
import { errorTextClass, hintClass, inputClass, labelClass } from '@/app/components/TicketCheckout';
import { CheckIcon, QrIcon } from '@/app/entradas/icons';
import { NEXT_PHASE_PRICE_NOTE, SUPPORT_LABEL, ticketPaths } from '@/app/lib/entradas';
import { INSTAGRAM_DM_URL } from '@/app/lib/inscripcion';
import { isValidWhatsAppNumber, prettyPhone, toWhatsAppNumber } from '@/app/lib/phone';

type ErrorCode = InvitationClaimError | 'NETWORK';

const ERROR_TEXT: Record<ErrorCode, string> = {
  INVALID: 'Revisá tu nombre y tu email.',
  PHONE: 'Revisá tu WhatsApp: código de área sin el 0 y el número sin el 15 (ej: 11 6445 0430).',
  LINK: 'Este link de invitación no es válido. Pedinos que te lo mandemos de nuevo.',
  USED: 'Esta invitación ya fue usada. Si fuiste vos, buscá el mensaje con tu entrada en WhatsApp.',
  HAS_TICKET: 'Ese WhatsApp ya tiene una entrada confirmada. Buscá el mensaje con tu QR en WhatsApp.',
  SOLD_OUT: 'Se completaron los lugares de esta edición. Escribinos y lo vemos juntos.',
  RETRY: 'No pudimos procesar el pedido. Esperá unos segundos y volvé a tocar el botón.',
  FAILED: 'No pudimos confirmar tu invitación. Probá de nuevo en un momento.',
  NETWORK:
    'No pudimos conectarnos. Revisá tu conexión y probá de nuevo. Si estás en el navegador de Instagram o Facebook, abrí esta página en tu navegador (menú ··· → Abrir en el navegador).',
};

/*
  Formulario de una invitacion: los mismos datos que la compra (nombre,
  WhatsApp, email opcional), sin forma de pago. Al enviarlo la entrada queda
  confirmada y se abre la pagina con el QR.
*/
export function InvitationForm({ token }: { token: string }) {
  const ids = useId();
  const formId = `invitacion-${ids}`;
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [done, setDone] = useState(false);
  // Hasta que React hidrata el boton queda deshabilitado (evita un submit nativo).
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
  }, []);

  useEffect(() => {
    if (error) alertRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [error]);

  const waNumber = useMemo(() => toWhatsAppNumber(phone), [phone]);
  const nameOk = fullName.trim().length >= 3;
  const phoneOk = isValidWhatsAppNumber(waNumber);
  const emailOk = !email.trim() || /^\S+@\S+\.\S+$/.test(email.trim());
  const isValid = nameOk && phoneOk && emailOk;
  const busy = isPending || done;
  const center = ' text-center lg:text-left';

  const buttonLabel = !hydrated ? 'Cargando…' : done ? 'Abriendo tu entrada…' : isPending ? 'Preparando tu entrada…' : 'Aceptar invitación';

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    setError(null);
    if (!hydrated || busy) return;
    if (!isValid) {
      const target = (!nameOk ? nameRef : !phoneOk ? phoneRef : emailRef).current;
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    startTransition(async () => {
      try {
        const result = await acceptInvitation({
          token,
          fullName: fullName.trim(),
          phone: waNumber,
          email: email.trim(),
          hp: honeypot,
          elapsedMs: Date.now() - mountedAt.current,
        });
        if (!result.ok) {
          setError(result.error ?? 'FAILED');
          return;
        }
        setDone(true);
        window.location.assign(`${ticketPaths(result.code).ticket}?invitacion=ok`);
      } catch (failure) {
        console.error('[invitacion] no se pudo confirmar:', failure);
        setError('NETWORK');
      }
    });
  };

  const fieldIds = {
    name: `${ids}-nombre`,
    nameError: `${ids}-nombre-error`,
    phone: `${ids}-whatsapp`,
    phoneHint: `${ids}-whatsapp-ayuda`,
    email: `${ids}-email`,
    emailHint: `${ids}-email-ayuda`,
  };

  const buttonClass =
    'items-center justify-center bg-celeste px-6 text-[16px] font-semibold text-night transition [@media(hover:hover)]:hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-night disabled:cursor-wait disabled:opacity-75';

  return (
    <>
      <form id={formId} onSubmit={handleSubmit} method="post" noValidate>
        <div className={center}>
          <h2 className="display-sm text-[1.6rem] leading-tight text-white">Confirmá tu lugar</h2>
          <p className="mt-1 text-[15px] text-ivory/70 [text-wrap:balance] lg:mt-1.5">
            Completá tus datos y te llega tu entrada con QR por WhatsApp.
          </p>
        </div>

        <div className={`mt-5 rounded-xl border border-celeste/30 bg-celeste/[0.06] px-4 py-3.5${center}`}>
          <p className="text-[14px] font-semibold text-white">Tu invitación es por la Fase 1 e incluye:</p>
          <ul className="mx-auto mt-2 grid w-fit max-w-full gap-1.5 text-left text-[14px] leading-snug text-ivory/80 lg:mx-0">
            <li className="flex items-start gap-2">
              <CheckIcon className="mt-px h-4 w-4 flex-none text-celeste" />
              <span>El taller del sábado 28 y domingo 29</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckIcon className="mt-px h-4 w-4 flex-none text-celeste" />
              <span>{SUPPORT_LABEL} de Daiana, con actividades y encuentros virtuales o presenciales</span>
            </li>
          </ul>
          <p className="mt-2 text-[13px] leading-relaxed text-ivory/60 [text-wrap:balance]">{NEXT_PHASE_PRICE_NOTE}</p>
        </div>

        <div className="mt-6 grid gap-4 lg:mt-7 lg:gap-5">
          <div>
            <label htmlFor={fieldIds.name} className={`${labelClass}${center}`}>
              Nombre y apellido
            </label>
            <input
              ref={nameRef}
              id={fieldIds.name}
              className={`${inputClass(touched && !nameOk, true)}${center}`}
              placeholder="Juana Pérez"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              enterKeyHint="next"
              aria-invalid={touched && !nameOk}
              aria-describedby={touched && !nameOk ? fieldIds.nameError : undefined}
            />
            {touched && !nameOk ? (
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
              className={`${inputClass(touched && !phoneOk, true)}${center}`}
              placeholder="11 6445 0430"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              autoComplete="tel"
              enterKeyHint="next"
              aria-invalid={touched && !phoneOk}
              aria-describedby={fieldIds.phoneHint}
            />
            <p id={fieldIds.phoneHint} className={`${touched && !phoneOk ? errorTextClass : hintClass}${center}`}>
              {touched && !phoneOk ? (
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
              className={`${inputClass(touched && !emailOk, true)}${center}`}
              placeholder="juana@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              inputMode="email"
              autoComplete="email"
              enterKeyHint="send"
              aria-invalid={touched && !emailOk}
              aria-describedby={touched && !emailOk ? fieldIds.emailHint : undefined}
            />
            {touched && !emailOk ? (
              <p id={fieldIds.emailHint} className={`${errorTextClass}${center}`}>
                Revisá el email o dejalo vacío.
              </p>
            ) : null}
          </div>

          {/* Anti-bots: invisible. Si se llena, el servidor lo usa solo como senal. */}
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
            {error === 'SOLD_OUT' || error === 'LINK' ? (
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
          className={`mt-7 hidden h-14 w-full rounded-2xl shadow-[0_18px_40px_-18px_rgba(124,201,236,0.9)] lg:flex ${buttonClass}`}
        >
          {buttonLabel}
        </button>

        <p className="mx-auto mt-6 flex w-fit items-center gap-1.5 text-[13px] leading-snug text-ivory/70 lg:mt-4">
          <QrIcon className="h-4 w-4 flex-none text-ivory/55" />
          Tu entrada con QR llega por WhatsApp
        </p>
      </form>

      {/* Celular: el boton siempre a mano. Envia el mismo form (atributo form). */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-ivory/10 bg-[#070B15] shadow-[0_-12px_32px_rgba(0,0,0,0.55)] lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="mx-auto w-full max-w-xl px-5 pb-3 pt-2.5">
          <p className="truncate text-center text-[13px] leading-tight text-ivory/70">Invitación · 1 entrada · 28 y 29 de noviembre</p>
          <button
            type="submit"
            form={formId}
            disabled={busy || !hydrated}
            aria-busy={busy || !hydrated}
            className={`mt-2 inline-flex h-12 w-full rounded-xl ${buttonClass}`}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </>
  );
}
