'use client';

import { useMemo, useState } from 'react';

import { SIGNUP_STATUS_OPTIONS, normalizeSignupStatus, signupStatusLabel, type SignupStatus } from '@/app/lib/metamorfosis';

import { updateSignupAction } from './actions';
import { DeleteSignupInline } from './DeleteSignupInline';
import { FormSubmitButton } from './FormSubmitButton';

export type BoardSignup = {
  id: string;
  fullName: string;
  phone: string;
  social: string | null;
  editionLabel: string | null;
  source: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
};

type Props = {
  signups: BoardSignup[];
  editionName: string;
  editionDateLabel: string;
  waitlistCount: number;
  min: number;
  max: number;
};

/* Colores por estado: de frio (nuevo) a caliente (inscripto). */
const STATUS_STYLE: Record<SignupStatus, { chip: string; dot: string }> = {
  NUEVO: { chip: 'border-sky-400/30 bg-sky-400/10 text-sky-100', dot: 'bg-sky-400' },
  CONTACTADO: { chip: 'border-amber-400/30 bg-amber-400/10 text-amber-100', dot: 'bg-amber-400' },
  EN_CONVERSACION: { chip: 'border-violet-400/30 bg-violet-400/10 text-violet-100', dot: 'bg-violet-400' },
  RESERVADO: { chip: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100', dot: 'bg-emerald-400' },
  INSCRIPTO: { chip: 'border-emerald-300/50 bg-emerald-400/25 text-emerald-50', dot: 'bg-emerald-300' },
  DESCARTADO: { chip: 'border-white/10 bg-white/5 text-white/45', dot: 'bg-white/30' },
};

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
  timeZone: 'America/Argentina/Buenos_Aires',
});
const dateTimeFormatter = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Argentina/Buenos_Aires',
});

/*
  La gente escribe el WhatsApp de mil formas (11..., 54 11..., 549 11...).
  wa.me necesita el formato internacional de celular argentino: 549 + area + numero.
*/
function toWhatsAppNumber(raw: string) {
  let digits = raw.replace(/\D+/g, '');
  if (digits.startsWith('549')) return digits;
  if (digits.startsWith('54')) return `549${digits.slice(2)}`;
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) return `549${digits}`;
  return digits;
}

function prettyPhone(raw: string) {
  const wa = toWhatsAppNumber(raw);
  // 549 11 6445 0430 (Buenos Aires: area de 2 digitos)
  const ba = wa.match(/^549(11)(\d{4})(\d{4})$/);
  if (ba) return `+54 9 ${ba[1]} ${ba[2]}-${ba[3]}`;
  const other = wa.match(/^549(\d{3,4})(\d{6,7})$/);
  if (other) return `+54 9 ${other[1]} ${other[2]}`;
  return `+${wa}`;
}

function instagramUrl(social: string) {
  const handle = social.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '');
  return /^[a-zA-Z0-9._]{2,30}$/.test(handle) ? `https://www.instagram.com/${handle.toLowerCase()}/` : null;
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function titleCase(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

export function SignupsBoard({ signups, editionName, editionDateLabel, waitlistCount, min, max }: Props) {
  const [filter, setFilter] = useState<SignupStatus | 'ALL'>('ALL');
  const [query, setQuery] = useState('');

  const counts = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const signup of signups) {
      const key = normalizeSignupStatus(signup.status);
      acc[key] = (acc[key] ?? 0) + 1;
    }
    return acc;
  }, [signups]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return signups.filter((signup) => {
      if (filter !== 'ALL' && normalizeSignupStatus(signup.status) !== filter) return false;
      if (!q) return true;
      return [signup.fullName, signup.phone, signup.social ?? '', signup.notes ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [signups, filter, query]);

  const missing = Math.max(0, min - waitlistCount);
  const reserve = Math.max(0, waitlistCount - max);
  const percent = Math.min(100, (waitlistCount / max) * 100);
  const minPercent = (min / max) * 100;
  const confirmed = (counts.RESERVADO ?? 0) + (counts.INSCRIPTO ?? 0);

  const statusMessage =
    missing > 0
      ? `Faltan ${missing} para confirmar la fecha`
      : reserve > 0
        ? `Cupo completo · ${reserve} en reserva`
        : 'Mínimo alcanzado · ya se puede confirmar la fecha';

  return (
    <div className="grid gap-6">
      {/* ------------------------------------------------ LISTA DE ESPERA */}
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-400/[0.08] via-white/[0.03] to-transparent p-6 sm:p-7">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-200/80">
          Lista de espera · {editionName} · {editionDateLabel}
        </p>

        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <p className="text-5xl font-semibold tabular-nums leading-none text-white">{waitlistCount}</p>
              <p className="text-base text-white/50">de {max} lugares</p>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  missing > 0
                    ? 'border-amber-400/30 bg-amber-400/10 text-amber-100'
                    : 'border-emerald-400/40 bg-emerald-400/15 text-emerald-100'
                }`}
              >
                {statusMessage}
              </span>
            </div>

            <div className="relative mt-6">
              <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all"
                  style={{ width: `${Math.max(percent, waitlistCount ? 2 : 0)}%` }}
                />
              </div>
              <div
                aria-hidden="true"
                className="absolute -top-1 h-[18px] w-0.5 rounded bg-white/60"
                style={{ left: `${minPercent}%` }}
              />
              <div className="relative mt-2 h-4 text-[11px] text-white/45">
                <span className="absolute left-0">0</span>
                <span className="absolute -translate-x-1/2 text-white/70" style={{ left: `${minPercent}%` }}>
                  Mínimo {min}
                </span>
                <span className="absolute right-0">Máximo {max}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:w-72">
            <MiniStat label="Sin contactar" value={counts.NUEVO ?? 0} tone="text-sky-200" />
            <MiniStat label="Confirmaron" value={confirmed} tone="text-emerald-200" />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------ FILTROS */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <FilterPill active={filter === 'ALL'} onClick={() => setFilter('ALL')} label="Todos" count={signups.length} />
          {SIGNUP_STATUS_OPTIONS.map((status) => (
            <FilterPill
              key={status}
              active={filter === status}
              onClick={() => setFilter(status)}
              label={signupStatusLabel(status)}
              count={counts[status] ?? 0}
              dot={STATUS_STYLE[status].dot}
            />
          ))}
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar nombre, teléfono o nota…"
          className="h-10 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white/90 outline-none placeholder:text-white/30 focus:border-emerald-400/40 lg:w-72"
        />
      </div>

      {/* ------------------------------------------------ LISTA */}
      <div className="overflow-hidden rounded-2xl border border-white/10">
        <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1fr)_7rem_8.5rem_1.5rem] gap-4 border-b border-white/10 bg-white/[0.03] px-5 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-white/40 md:grid">
          <span>Persona</span>
          <span>WhatsApp</span>
          <span>Red social</span>
          <span>Anotado</span>
          <span>Estado</span>
          <span />
        </div>

        {visible.length ? (
          visible.map((signup) => <SignupRow key={signup.id} signup={signup} />)
        ) : (
          <p className="px-5 py-10 text-center text-sm text-white/50">
            {signups.length ? 'No hay inscriptos con este filtro.' : 'Todavía no hay inscripciones desde la web.'}
          </p>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  label,
  count,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  dot?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-xs font-semibold transition ${
        active
          ? 'border-emerald-400/50 bg-emerald-400/15 text-white'
          : 'border-white/10 bg-white/[0.03] text-white/60 hover:border-white/25 hover:text-white/85'
      }`}
    >
      {dot ? <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dot}`} /> : null}
      {label}
      <span className={`tabular-nums ${active ? 'text-emerald-200' : 'text-white/35'}`}>{count}</span>
    </button>
  );
}

function SignupRow({ signup }: { signup: BoardSignup }) {
  const status = normalizeSignupStatus(signup.status);
  const style = STATUS_STYLE[status];
  const name = titleCase(signup.fullName);
  const firstName = name.split(' ')[0] ?? '';
  const waNumber = toWhatsAppNumber(signup.phone);
  const waText = `Hola ${firstName}! Te escribo de Metamorfosis por la lista de la 7ma edición de noviembre.`;
  const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}`;
  const igUrl = signup.social ? instagramUrl(signup.social) : null;
  const created = new Date(signup.createdAt);

  return (
    <details className="group border-b border-white/[0.06] last:border-b-0 open:bg-white/[0.03]">
      <summary className="grid cursor-pointer list-none grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-5 py-4 transition hover:bg-white/[0.03] md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1fr)_7rem_8.5rem_1.5rem] [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white/80">
            {initials(name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{name}</p>
            <p className="truncate text-xs text-white/45 md:hidden">{prettyPhone(signup.phone)}</p>
          </div>
        </div>

        <span className="hidden truncate text-sm tabular-nums text-white/75 md:block">{prettyPhone(signup.phone)}</span>
        <span className="hidden truncate text-sm text-white/60 md:block">{signup.social ?? '—'}</span>
        <span className="hidden text-sm text-white/55 md:block" title={dateTimeFormatter.format(created)}>
          {dateFormatter.format(created)}
        </span>

        <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${style.chip}`}>
          <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
          {signupStatusLabel(status)}
        </span>

        <span aria-hidden="true" className="hidden text-white/35 transition group-open:rotate-90 md:block">
          ›
        </span>
      </summary>

      <div className="grid gap-5 px-5 pb-5 pt-1 md:pl-[4.25rem]">
        <div className="flex flex-wrap gap-2">
          <a
            href={waUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-emerald-500 px-4 text-xs font-bold text-black transition hover:bg-emerald-400"
          >
            Escribir por WhatsApp
          </a>
          {igUrl ? (
            <a
              href={igUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-white/15 bg-white/5 px-4 text-xs font-semibold text-white/80 transition hover:bg-white/10"
            >
              Ver Instagram
            </a>
          ) : null}
        </div>

        <dl className="grid gap-x-8 gap-y-2 text-xs sm:grid-cols-3">
          <div>
            <dt className="text-white/40">Anotado</dt>
            <dd className="mt-0.5 text-white/80">{dateTimeFormatter.format(created)}</dd>
          </div>
          <div>
            <dt className="text-white/40">Edición</dt>
            <dd className="mt-0.5 text-white/80">{signup.editionLabel ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-white/40">Desde</dt>
            <dd className="mt-0.5 text-white/80">{signup.source ?? '—'}</dd>
          </div>
        </dl>

        <form action={updateSignupAction} className="grid gap-3 md:grid-cols-[12rem_1fr_auto] md:items-end">
          <input type="hidden" name="signupId" value={signup.id} />
          <label className="grid gap-1.5">
            <span className="text-xs text-white/50">Estado</span>
            <select
              name="status"
              defaultValue={status}
              className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none focus:border-emerald-400/40"
            >
              {SIGNUP_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {signupStatusLabel(option)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs text-white/50">Notas internas</span>
            <input
              name="notes"
              defaultValue={signup.notes ?? ''}
              placeholder="Ej: pidió pagar en partes"
              className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none placeholder:text-white/25 focus:border-emerald-400/40"
            />
          </label>
          <FormSubmitButton
            className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/85"
            pendingLabel="Guardando..."
          >
            Guardar
          </FormSubmitButton>
        </form>

        <div className="flex justify-end">
          <DeleteSignupInline signupId={signup.id} />
        </div>
      </div>
    </details>
  );
}
