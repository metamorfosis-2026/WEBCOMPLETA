'use client';

import { useMemo, useState } from 'react';

function onlyDigits(value: string) {
  return value.replace(/\D+/g, '');
}

function buildWhatsAppUrl(phoneDigits: string, message: string) {
  const safeDigits = onlyDigits(phoneDigits);
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${safeDigits}?text=${encoded}`;
}

export function WhatsAppForm({
  workshopLabel = 'Metamorfosis (Marzo 2026)',
}: {
  workshopLabel?: string;
}) {
  const whatsappBusinessNumber =
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '54911XXXXXXXXXX';

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [social, setSocial] = useState('');
  const [touched, setTouched] = useState(false);

  const phoneDigits = useMemo(() => onlyDigits(phone), [phone]);

  const isValid =
    fullName.trim().length >= 3 && phoneDigits.length >= 8;

  const message = useMemo(() => {
    return [
      'Hola! Me gustaría entender primero cómo funciona Metamorfosis.',
      `Taller: ${workshopLabel}`,
      fullName.trim() ? `Nombre completo: ${fullName.trim()}` : null,
      phoneDigits ? `Celular: +${phoneDigits}` : null,
      social.trim() ? `Red social: ${social.trim()}` : null,
      '¿Me contás cómo es la Fase 1 (2 días intensivos) y cómo se decide si se continúa? También quiero saber modalidad y cupos.',
    ]
      .filter(Boolean)
      .join('\n');
  }, [fullName, phoneDigits, social, workshopLabel]);

  const waUrl = useMemo(
    () => buildWhatsAppUrl(whatsappBusinessNumber, message),
    [whatsappBusinessNumber, message]
  );

  return (
    <div className="rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 via-slate-950/50 to-cyan-500/10 p-8 backdrop-blur-md shadow-2xl shadow-emerald-500/10">
      <div className="text-center max-w-2xl mx-auto">
        <h3 className="text-2xl font-bold text-white">SACATE TODAS LAS DUDAS</h3>
        <p className="mt-3 text-base text-white/75">
          Podemos conversar directamente por WhatsApp. Así entendés bien de qué trata Metamorfosis y cómo funciona la Fase 1. Dejanos tus datos y te escribimos.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 max-w-2xl mx-auto">
        <label className="grid gap-2 sm:col-span-2">
          <span className="text-xs font-medium uppercase tracking-wide text-white/80">Nombre completo</span>
          <input
            className="h-12 rounded-lg border border-white/15 bg-white/8 backdrop-blur px-4 text-sm outline-none ring-0 placeholder:text-white/30 focus:border-emerald-400/50 focus:bg-white/12 transition"
            placeholder="Ej: Juan Pérez"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            onBlur={() => setTouched(true)}
            autoComplete="name"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-white/80">Número de WhatsApp</span>
          <input
            className="h-12 rounded-lg border border-white/15 bg-white/8 backdrop-blur px-4 text-sm outline-none ring-0 placeholder:text-white/30 focus:border-emerald-400/50 focus:bg-white/12 transition"
            placeholder="Ej: +54 11 1234 5678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => setTouched(true)}
            inputMode="tel"
            autoComplete="tel"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-white/70">Red social <span className="text-white/50 font-normal">(opcional)</span></span>
          <input
            className="h-12 rounded-lg border border-white/15 bg-white/8 backdrop-blur px-4 text-sm outline-none ring-0 placeholder:text-white/30 focus:border-emerald-400/50 focus:bg-white/12 transition"
            placeholder="Ej: @tuinstagram"
            value={social}
            onChange={(e) => setSocial(e.target.value)}
            onBlur={() => setTouched(true)}
            autoComplete="off"
          />
        </label>
      </div>

      {touched && !isValid ? (
        <p className="mt-4 text-center text-sm text-amber-300/90">
          Completá nombre y número de WhatsApp para continuar.
        </p>
      ) : null}

      <div className="mt-8 flex flex-col gap-3 sm:gap-4 max-w-2xl mx-auto">
        <a
          href={isValid ? waUrl : '#'}
          onClick={(e) => {
            setTouched(true);
            if (!isValid) e.preventDefault();
          }}
          className="inline-flex h-13 items-center justify-center rounded-lg bg-gradient-to-r from-emerald-400 to-cyan-400 px-8 text-sm font-bold text-slate-950 shadow-xl shadow-emerald-500/30 transition hover:shadow-emerald-500/50 hover:from-emerald-300 hover:to-cyan-300"
        >
          Sí, charlemos por WhatsApp
        </a>

        <a
          className="text-center text-sm text-white/70 underline-offset-4 hover:text-white hover:underline transition"
          href={buildWhatsAppUrl(whatsappBusinessNumber, `Hola! Quiero info de ${workshopLabel}.`)}
          target="_blank"
          rel="noreferrer"
        >
          O escribe algo diferente
        </a>
      </div>

      <p className="mt-6 text-center text-xs text-white/40">
        No hacemos spam. Solo charlamos sobre el proceso.
      </p>
    </div>
  );
}
