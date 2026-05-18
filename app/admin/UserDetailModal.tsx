'use client';

import { useEffect, useState } from 'react';

import { FormSubmitButton } from './FormSubmitButton';
import {
  createUserAchievement,
  deletePayment,
  deleteUserAchievement,
  linkUserReferrer,
  recordPayment,
  setUserEditionProgress,
  updatePayment,
  upsertEnrollment,
} from './actions';

type PaymentRow = {
  id: string;
  enrollmentId: string;
  amountCents: number;
  currency: string;
  status: string;
  method: string;
  reference: string | null;
  notes: string | null;
  paidAt: string;
};

type EnrollmentRow = {
  id: string;
  userId: string;
  editionId: string;
  status: string;
  amountDueCents: number;
  currency: string;
  notes: string | null;
  edition: { id: string; title: string; slug: string };
  phase: { id: string; title: string; slug: string; sequence: number } | null;
  payments: PaymentRow[];
};

type AchievementRow = {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  awardedAt: string;
  edition?: { title: string } | null;
  phase?: { title: string } | null;
};

type UserPayload = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  status: string;
  pointsBalance: number;
  referralCode: string | null;
  referredBy: { name: string | null; email: string | null } | null;
  godAssignment: {
    customPdfUrl: string | null;
    notes: string | null;
    god: { name: string; epithet: string | null; pdfUrl: string | null } | null;
  } | null;
  enrollments: EnrollmentRow[];
  achievements?: AchievementRow[];
};

type Props = {
  user: UserPayload;
  editions: {
    id: string;
    slug: string;
    title: string;
    sequence: number;
    phases: { id: string; slug: string; title: string; sequence: number; priceCents: number }[];
  }[];
  selectedEditionSlug: string | null;
  selectedPhaseSlug: string | null;
  triggerLabel?: string;
  triggerClassName?: string;
  buttonLabel?: string;
  allUsers?: Array<{ id: string; name: string | null; email: string | null }>;
  isSuperadmin?: boolean;
  children?: React.ReactNode;
};

function formatMoney(amountInCents: number, currency = 'ARS') {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amountInCents ?? 0) / 100);
}

function sumConfirmed(payments: PaymentRow[]) {
  return payments.reduce(
    (total, payment) =>
      String(payment.status).toUpperCase() === 'CONFIRMADO'
        ? total + Number(payment.amountCents ?? 0)
        : total,
    0
  );
}

export function UserDetailModal({
  user,
  editions,
  selectedEditionSlug,
  selectedPhaseSlug,
  triggerLabel,
  triggerClassName,
  buttonLabel,
  allUsers,
  isSuperadmin,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const initialEditionId =
    (selectedEditionSlug
      ? editions.find((edition) => edition.slug === selectedEditionSlug)?.id
      : null) ?? editions[0]?.id ?? '';
  const [progressEditionId, setProgressEditionId] = useState<string>(initialEditionId);

  function phaseStateFromEnrollment(sequence: number): string {
    const enrollment = user.enrollments.find(
      (entry) =>
        entry.editionId === progressEditionId && entry.phase?.sequence === sequence
    );
    if (!enrollment) return 'SIN_CURSAR';
    const status = String(enrollment.status).toUpperCase();
    if (status === 'CURSANDO') return 'CURSANDO';
    if (status === 'FINALIZADO') return 'FINALIZADA';
    if (status === 'CANCELADO') return 'ABANDONO';
    return 'SIN_CURSAR';
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const initials = (() => {
    const base = (user.name ?? '').trim();
    if (base) {
      const parts = base.split(/\s+/).slice(0, 2);
      return parts.map((part) => part[0]).filter(Boolean).join('').toUpperCase();
    }
    if (user.email) return user.email.slice(0, 2).toUpperCase();
    return 'ME';
  })();

  const totalDue = user.enrollments.reduce((sum, entry) => sum + entry.amountDueCents, 0);
  const totalPaid = user.enrollments.reduce((sum, entry) => sum + sumConfirmed(entry.payments), 0);
  const totalPending = Math.max(totalDue - totalPaid, 0);

  return (
    <>
      {children ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="block w-full text-left transition hover:opacity-90"
        >
          {children}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={
            triggerClassName ??
            'inline-flex h-10 items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-4 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-400/20'
          }
        >
          {buttonLabel ?? triggerLabel ?? 'Abrir ficha'}
        </button>
      )}

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl shadow-emerald-500/10">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 bg-gradient-to-br from-emerald-500/10 via-cyan-400/5 to-transparent p-5">
              <div className="flex items-start gap-4">
                <div
                  aria-hidden="true"
                  className="grid h-12 w-12 place-items-center rounded-full border border-emerald-400/30 bg-radial-gradient text-sm font-bold text-emerald-100"
                  style={{
                    background:
                      'radial-gradient(circle at 30% 30%, rgba(52,211,153,0.25), rgba(2,6,23,0.7))',
                  }}
                >
                  {initials}
                </div>
                <div>
                  <p className="text-xs font-bold tracking-[0.25em] text-emerald-200/90">FICHA INTERNA</p>
                  <h2 className="mt-1 text-xl font-semibold text-white">{user.name ?? 'Sin nombre'}</h2>
                  <p className="text-sm text-white/60">{user.email ?? 'Sin email'}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/70">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      Rol: {user.role}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      Estado: {user.status}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      {user.pointsBalance} pts
                    </span>
                    {user.referralCode ? (
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                        Codigo: {user.referralCode}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80 transition hover:bg-white/10"
              >
                Cerrar
              </button>
            </div>

            <div className="overflow-y-auto p-5 sm:p-6">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs font-bold tracking-wide text-emerald-200/90">DEUDA TOTAL</p>
                  <p className="mt-2 text-lg font-semibold text-white">{formatMoney(totalDue)}</p>
                  <p className="mt-1 text-xs text-white/55">Suma de todas las fichas</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs font-bold tracking-wide text-emerald-200/90">PAGADO</p>
                  <p className="mt-2 text-lg font-semibold text-emerald-200">{formatMoney(totalPaid)}</p>
                  <p className="mt-1 text-xs text-white/55">Solo pagos confirmados</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs font-bold tracking-wide text-amber-200/90">PENDIENTE</p>
                  <p className="mt-2 text-lg font-semibold text-amber-200">{formatMoney(totalPending)}</p>
                  <p className="mt-1 text-xs text-white/55">Resto que falta cobrar</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                <div className="grid gap-2 rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-xs font-bold tracking-wide text-emerald-200/90">
                    ESTADO DEL PROCESO
                  </p>
                  <p className="text-[11px] text-white/55">
                    Eligi la edicion. Para cada fase marca si la esta cursando, ya la completo o la abandono.
                  </p>

                  <label className="mt-2 grid gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-white/45">
                      Edicion
                    </span>
                    <select
                      value={progressEditionId}
                      onChange={(event) => setProgressEditionId(event.target.value)}
                      className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                    >
                      {editions.length === 0 ? (
                        <option value="" disabled>
                          Sin ediciones cargadas
                        </option>
                      ) : null}
                      {editions.map((edition) => (
                        <option key={edition.id} value={edition.id}>
                          {edition.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  <form
                    key={progressEditionId}
                    action={setUserEditionProgress}
                    className="mt-2 grid gap-2"
                  >
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="editionId" value={progressEditionId} />

                    {([1, 2, 3] as const).map((sequence) => {
                      const current = phaseStateFromEnrollment(sequence);
                      const phaseExists = editions
                        .find((edition) => edition.id === progressEditionId)
                        ?.phases.some((phase) => phase.sequence === sequence);
                      return (
                        <label
                          key={sequence}
                          className="grid gap-1 sm:grid-cols-[80px,1fr] sm:items-center sm:gap-3"
                        >
                          <span className="text-xs font-semibold text-white/85">
                            Fase {sequence}
                          </span>
                          <select
                            name={`phase${sequence}`}
                            defaultValue={current}
                            disabled={!phaseExists}
                            className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="SIN_CURSAR">Sin cursar todavia</option>
                            <option value="CURSANDO">Cursando</option>
                            <option value="FINALIZADA">Completada</option>
                            <option value="ABANDONO">Abandono</option>
                          </select>
                        </label>
                      );
                    })}

                    <FormSubmitButton
                      className="mt-2 inline-flex h-10 items-center justify-center rounded-xl bg-emerald-500 px-3 text-xs font-semibold text-black transition hover:bg-emerald-400"
                      pendingLabel="Guardando..."
                    >
                      Guardar recorrido
                    </FormSubmitButton>

                    <p className="mt-1 text-[10px] text-white/40">
                      Completada Fase 3 = Egresado/a. Cualquier abandono pone el estado general en Abandono. Las fases que no existen en la edicion quedan deshabilitadas.
                    </p>
                  </form>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-xs font-bold tracking-wide text-emerald-200/90">
                    QUIEN LO INVITO
                  </p>
                  {user.referredBy ? (
                    <p className="mt-2 text-sm font-semibold text-white/90">
                      {user.referredBy.name ?? user.referredBy.email ?? '-'}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-white/55">Sin referente cargado</p>
                  )}

                  {isSuperadmin && allUsers ? (
                    <form action={linkUserReferrer} className="mt-3 grid gap-2 sm:grid-cols-[1fr,auto]">
                      <input type="hidden" name="userId" value={user.id} />
                      <select
                        name="referredById"
                        defaultValue=""
                        className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                      >
                        <option value="">Sin referente</option>
                        {allUsers
                          .filter((candidate) => candidate.id !== user.id)
                          .map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              {(candidate.name ?? 'Sin nombre') +
                                (candidate.email ? ` - ${candidate.email}` : '')}
                            </option>
                          ))}
                      </select>
                      <FormSubmitButton
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white/90 transition hover:bg-white/10"
                        pendingLabel="Guardando..."
                      >
                        Asignar
                      </FormSubmitButton>
                    </form>
                  ) : (
                    <p className="mt-2 text-[11px] text-white/45">
                      Solo el superadmin puede cambiar el referente.
                    </p>
                  )}
                </div>
              </div>

              {(() => {
                const byEdition = new Map<
                  string,
                  { title: string; entries: typeof user.enrollments }
                >();
                for (const enrollment of user.enrollments) {
                  const key = enrollment.edition?.title ?? 'Sin edicion';
                  const bucket = byEdition.get(key) ?? {
                    title: key,
                    entries: [] as typeof user.enrollments,
                  };
                  bucket.entries.push(enrollment);
                  byEdition.set(key, bucket);
                }
                const groups = Array.from(byEdition.values()).filter(
                  (group) => group.entries.length > 0
                );
                if (groups.length === 0) return null;
                return (
                  <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-xs font-bold tracking-wide text-emerald-200/90">
                      RECORRIDO POR EDICION
                    </p>
                    <p className="mt-1 text-[11px] text-white/55">
                      Resumen de las fases que tiene cargadas en cada edicion.
                    </p>
                    <div className="mt-3 grid gap-3">
                      {groups.map((group) => (
                        <div
                          key={group.title}
                          className="rounded-xl border border-white/10 bg-slate-950/40 p-3"
                        >
                          <p className="text-xs font-semibold text-white/85">{group.title}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {group.entries
                              .slice()
                              .sort(
                                (left, right) =>
                                  (left.phase?.sequence ?? 0) - (right.phase?.sequence ?? 0)
                              )
                              .map((entry) => {
                                const statusUpper = String(entry.status).toUpperCase();
                                const isFinalized = statusUpper === 'FINALIZADO';
                                const isCancelled = statusUpper === 'CANCELADO';
                                const isCursando = statusUpper === 'CURSANDO';
                                const tone = isFinalized
                                  ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100'
                                  : isCancelled
                                  ? 'border-rose-400/30 bg-rose-400/10 text-rose-100'
                                  : isCursando
                                  ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100'
                                  : 'border-white/10 bg-white/5 text-white/70';
                                return (
                                  <span
                                    key={entry.id}
                                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${tone}`}
                                  >
                                    {entry.phase?.title ?? 'Sin fase'} -{' '}
                                    {isFinalized
                                      ? 'Completada'
                                      : isCancelled
                                      ? 'Abandono'
                                      : isCursando
                                      ? 'Cursando'
                                      : entry.status}
                                  </span>
                                );
                              })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {user.godAssignment ? (
                <div className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-300/5 p-4">
                  <p className="text-xs font-bold tracking-[0.2em] text-amber-100/90">DIOS GRIEGO ASIGNADO</p>
                  <p className="mt-2 text-base font-semibold text-white">{user.godAssignment.god?.name}</p>
                  {user.godAssignment.god?.epithet ? (
                    <p className="text-xs text-amber-100/70">{user.godAssignment.god.epithet}</p>
                  ) : null}
                  {user.godAssignment.notes ? (
                    <p className="mt-2 text-xs text-white/60">{user.godAssignment.notes}</p>
                  ) : null}
                </div>
              ) : null}

              <h3 className="mt-6 text-sm font-semibold tracking-wide text-white/80">FICHAS Y PAGOS</h3>

              {user.enrollments.length ? (
                <div className="mt-4 grid gap-5">
                  {user.enrollments.map((enrollment) => {
                    const paid = sumConfirmed(enrollment.payments);
                    const pending = Math.max(enrollment.amountDueCents - paid, 0);
                    const isFree = enrollment.amountDueCents === 0;
                    const progress =
                      enrollment.amountDueCents > 0
                        ? Math.min(Math.round((paid / enrollment.amountDueCents) * 100), 100)
                        : 0;

                    return (
                      <div
                        key={enrollment.id}
                        className={`rounded-3xl border p-5 ${
                          isFree
                            ? 'border-amber-300/30 bg-amber-300/5'
                            : 'border-white/10 bg-black/25'
                        }`}
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {enrollment.edition.title}
                              {enrollment.phase ? ` - ${enrollment.phase.title}` : ''}
                            </p>
                            <p className="mt-1 text-xs text-white/55">
                              Estado: {enrollment.status} -{' '}
                              {isFree
                                ? 'Cupo regalado'
                                : `Total ${formatMoney(enrollment.amountDueCents, enrollment.currency)}`}
                            </p>
                            {enrollment.notes ? (
                              <p className="mt-2 text-xs text-white/55">Nota: {enrollment.notes}</p>
                            ) : null}
                          </div>
                          {isFree ? (
                            <div className="rounded-full border border-amber-300/40 bg-amber-300/15 px-3 py-1 text-xs font-semibold text-amber-100">
                              GRATIS
                            </div>
                          ) : (
                            <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                              {progress}% cobrado
                            </div>
                          )}
                        </div>

                        {isFree ? (
                          <p className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/5 p-3 text-xs text-amber-100/85">
                            Esta ficha esta marcada como gratis (cupo regalado o promo). No se contabiliza como deuda en finanzas.
                          </p>
                        ) : (
                          <>
                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  progress >= 100
                                    ? 'bg-emerald-400'
                                    : progress >= 60
                                    ? 'bg-cyan-400'
                                    : 'bg-amber-300'
                                }`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/60 sm:grid-cols-3">
                              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                                <p className="text-[10px] uppercase tracking-wider text-white/45">
                                  Pagado
                                </p>
                                <p className="mt-1 text-sm font-semibold text-emerald-200">
                                  {formatMoney(paid, enrollment.currency)}
                                </p>
                              </div>
                              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                                <p className="text-[10px] uppercase tracking-wider text-white/45">
                                  Pendiente
                                </p>
                                <p className="mt-1 text-sm font-semibold text-amber-200">
                                  {formatMoney(pending, enrollment.currency)}
                                </p>
                              </div>
                              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                                <p className="text-[10px] uppercase tracking-wider text-white/45">
                                  Pagos
                                </p>
                                <p className="mt-1 text-sm font-semibold text-white">
                                  {enrollment.payments.length}
                                </p>
                              </div>
                            </div>
                          </>
                        )}

                        {isFree ? null : (
                        <details className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4 open:border-emerald-400/30">
                          <summary className="cursor-pointer text-xs font-semibold text-emerald-200/90">
                            + Agregar pago a esta ficha
                          </summary>
                          <form action={recordPayment} className="mt-3 grid gap-3 md:grid-cols-2">
                            <input type="hidden" name="enrollmentId" value={enrollment.id} />
                            <input type="hidden" name="currency" value={enrollment.currency} />
                            <input type="hidden" name="returnTab" value="finance" />
                            <input
                              type="hidden"
                              name="editionSlug"
                              value={selectedEditionSlug ?? enrollment.edition.slug}
                            />
                            <input
                              type="hidden"
                              name="phaseSlug"
                              value={selectedPhaseSlug ?? enrollment.phase?.slug ?? ''}
                            />

                            <label className="grid gap-1">
                              <span className="text-xs text-white/60">Monto</span>
                              <input
                                name="amount"
                                defaultValue="0"
                                className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                              />
                            </label>
                            <label className="grid gap-1">
                              <span className="text-xs text-white/60">Fecha</span>
                              <input
                                name="paidAt"
                                type="date"
                                defaultValue={new Date().toISOString().slice(0, 10)}
                                className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                              />
                            </label>
                            <label className="grid gap-1">
                              <span className="text-xs text-white/60">Metodo</span>
                              <select
                                name="method"
                                defaultValue="TRANSFERENCIA"
                                className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                              >
                                <option value="TRANSFERENCIA">Transferencia</option>
                                <option value="EFECTIVO">Efectivo</option>
                                <option value="MERCADO_PAGO">Mercado Pago</option>
                                <option value="TARJETA">Tarjeta</option>
                                <option value="OTRO">Otro</option>
                              </select>
                            </label>
                            <label className="grid gap-1">
                              <span className="text-xs text-white/60">Estado</span>
                              <select
                                name="status"
                                defaultValue="CONFIRMADO"
                                className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                              >
                                <option value="CONFIRMADO">Confirmado</option>
                                <option value="PENDIENTE">Pendiente</option>
                                <option value="CANCELADO">Cancelado</option>
                                <option value="DEVUELTO">Devuelto</option>
                              </select>
                            </label>
                            <label className="grid gap-1 md:col-span-2">
                              <span className="text-xs text-white/60">Referencia</span>
                              <input
                                name="reference"
                                className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                                placeholder="Comprobante o nota corta"
                              />
                            </label>
                            <label className="grid gap-1 md:col-span-2">
                              <span className="text-xs text-white/60">Notas</span>
                              <input
                                name="notes"
                                className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                              />
                            </label>
                            <div className="md:col-span-2">
                              <FormSubmitButton
                                className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
                                pendingLabel="Guardando..."
                              >
                                Guardar pago
                              </FormSubmitButton>
                            </div>
                          </form>
                        </details>
                        )}

                        {isFree ? null : enrollment.payments.length ? (
                          <div className="mt-4 grid gap-3">
                            {enrollment.payments.map((payment) => {
                              const isEditing = editingPaymentId === payment.id;
                              return (
                                <div
                                  key={payment.id}
                                  className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"
                                >
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                      <p className="text-sm font-semibold text-white/90">
                                        {formatMoney(payment.amountCents, payment.currency)}
                                      </p>
                                      <p className="text-xs text-white/55">
                                        {new Date(payment.paidAt).toLocaleDateString()} - {payment.method} -{' '}
                                        {payment.status}
                                      </p>
                                      {payment.reference ? (
                                        <p className="mt-1 text-xs text-white/50">Ref: {payment.reference}</p>
                                      ) : null}
                                      {payment.notes ? (
                                        <p className="mt-1 text-xs text-white/50">Nota: {payment.notes}</p>
                                      ) : null}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setEditingPaymentId(isEditing ? null : payment.id)
                                        }
                                        className="inline-flex h-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white/80 transition hover:bg-white/10"
                                      >
                                        {isEditing ? 'Cancelar' : 'Editar'}
                                      </button>
                                      <form action={deletePayment}>
                                        <input type="hidden" name="paymentId" value={payment.id} />
                                        <input
                                          type="hidden"
                                          name="editionSlug"
                                          value={selectedEditionSlug ?? enrollment.edition.slug}
                                        />
                                        <input
                                          type="hidden"
                                          name="phaseSlug"
                                          value={selectedPhaseSlug ?? enrollment.phase?.slug ?? ''}
                                        />
                                        <input type="hidden" name="returnTab" value="finance" />
                                        <FormSubmitButton
                                          className="inline-flex h-8 items-center justify-center rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 text-xs font-semibold text-rose-100 transition hover:bg-rose-400/20"
                                          pendingLabel="Borrando..."
                                          confirmMessage="Seguro borras este pago?"
                                        >
                                          Borrar
                                        </FormSubmitButton>
                                      </form>
                                    </div>
                                  </div>

                                  {isEditing ? (
                                    <form
                                      action={updatePayment}
                                      className="mt-3 grid gap-3 rounded-xl border border-white/10 bg-black/30 p-3 md:grid-cols-2"
                                    >
                                      <input type="hidden" name="paymentId" value={payment.id} />
                                      <input type="hidden" name="currency" value={payment.currency} />
                                      <input
                                        type="hidden"
                                        name="editionSlug"
                                        value={selectedEditionSlug ?? enrollment.edition.slug}
                                      />
                                      <input
                                        type="hidden"
                                        name="phaseSlug"
                                        value={selectedPhaseSlug ?? enrollment.phase?.slug ?? ''}
                                      />
                                      <input type="hidden" name="returnTab" value="finance" />
                                      <label className="grid gap-1">
                                        <span className="text-xs text-white/55">Monto</span>
                                        <input
                                          name="amount"
                                          defaultValue={String(payment.amountCents / 100)}
                                          className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                                        />
                                      </label>
                                      <label className="grid gap-1">
                                        <span className="text-xs text-white/55">Fecha</span>
                                        <input
                                          name="paidAt"
                                          type="date"
                                          defaultValue={new Date(payment.paidAt).toISOString().slice(0, 10)}
                                          className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                                        />
                                      </label>
                                      <label className="grid gap-1">
                                        <span className="text-xs text-white/55">Metodo</span>
                                        <select
                                          name="method"
                                          defaultValue={payment.method}
                                          className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                                        >
                                          <option value="TRANSFERENCIA">Transferencia</option>
                                          <option value="EFECTIVO">Efectivo</option>
                                          <option value="MERCADO_PAGO">Mercado Pago</option>
                                          <option value="TARJETA">Tarjeta</option>
                                          <option value="OTRO">Otro</option>
                                        </select>
                                      </label>
                                      <label className="grid gap-1">
                                        <span className="text-xs text-white/55">Estado</span>
                                        <select
                                          name="status"
                                          defaultValue={payment.status}
                                          className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                                        >
                                          <option value="CONFIRMADO">Confirmado</option>
                                          <option value="PENDIENTE">Pendiente</option>
                                          <option value="CANCELADO">Cancelado</option>
                                          <option value="DEVUELTO">Devuelto</option>
                                        </select>
                                      </label>
                                      <label className="grid gap-1 md:col-span-2">
                                        <span className="text-xs text-white/55">Referencia</span>
                                        <input
                                          name="reference"
                                          defaultValue={payment.reference ?? ''}
                                          className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                                        />
                                      </label>
                                      <label className="grid gap-1 md:col-span-2">
                                        <span className="text-xs text-white/55">Notas</span>
                                        <input
                                          name="notes"
                                          defaultValue={payment.notes ?? ''}
                                          className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                                        />
                                      </label>
                                      <div className="md:col-span-2">
                                        <FormSubmitButton
                                          className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
                                          pendingLabel="Guardando..."
                                        >
                                          Guardar cambios
                                        </FormSubmitButton>
                                      </div>
                                    </form>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="mt-4 text-xs text-white/55">Aun no hay pagos registrados.</p>
                        )}

                        <details className="mt-4 rounded-2xl border border-white/10 bg-slate-950/30 p-4 open:border-emerald-400/30">
                          <summary className="cursor-pointer text-xs font-semibold text-white/70">
                            Editar ficha (monto / estado / nota)
                          </summary>
                          <form action={upsertEnrollment} className="mt-3 grid gap-3 md:grid-cols-2">
                            <input type="hidden" name="userId" value={enrollment.userId} />
                            <input type="hidden" name="editionId" value={enrollment.editionId} />
                            <input type="hidden" name="phaseId" value={enrollment.phase?.id ?? ''} />
                            <input type="hidden" name="currency" value={enrollment.currency} />
                            <input type="hidden" name="returnTab" value="finance" />
                            <label className="grid gap-1">
                              <span className="text-xs text-white/55">Monto total</span>
                              <input
                                name="amountDue"
                                defaultValue={String(enrollment.amountDueCents / 100)}
                                className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                              />
                            </label>
                            <label className="grid gap-1">
                              <span className="text-xs text-white/55">Estado</span>
                              <select
                                name="status"
                                defaultValue={enrollment.status}
                                className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                              >
                                <option value="PENDIENTE">Pendiente</option>
                                <option value="RESERVADO">Reservado</option>
                                <option value="CONFIRMADO">Confirmado</option>
                                <option value="CURSANDO">Cursando</option>
                                <option value="FINALIZADO">Finalizado</option>
                                <option value="CANCELADO">Cancelado</option>
                              </select>
                            </label>
                            <label className="grid gap-1 md:col-span-2">
                              <span className="text-xs text-white/55">Notas</span>
                              <input
                                name="notes"
                                defaultValue={enrollment.notes ?? ''}
                                className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                              />
                            </label>
                            <label className="md:col-span-2 flex items-center gap-2 rounded-xl border border-amber-300/30 bg-amber-300/5 px-3 py-2 text-xs text-amber-100/90">
                              <input
                                name="isFree"
                                type="checkbox"
                                defaultChecked={isFree}
                                className="accent-amber-300"
                              />
                              Marcar esta ficha como gratis (cupo regalado / promo). El monto pasa a $0 y la ficha queda como 100% cubierta.
                            </label>
                            <div className="md:col-span-2">
                              <FormSubmitButton
                                className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/90 transition hover:bg-white/10"
                                pendingLabel="Guardando..."
                              >
                                Actualizar ficha
                              </FormSubmitButton>
                            </div>
                          </form>
                        </details>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-4 text-sm text-white/55">
                  Este usuario aun no tiene fichas en ninguna edicion.
                </p>
              )}

              <details className="mt-6 rounded-3xl border border-amber-300/20 bg-amber-300/5 p-4 open:border-amber-300/40">
                <summary className="cursor-pointer text-sm font-semibold text-amber-100/90">
                  Logros del usuario ({user.achievements?.length ?? 0})
                </summary>

                <div className="mt-3 grid gap-2">
                  {user.achievements && user.achievements.length > 0 ? (
                    user.achievements.map((achievement) => (
                      <div
                        key={achievement.id}
                        className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white/90">
                            {achievement.icon ? `${achievement.icon} ` : ''}
                            {achievement.title}
                          </p>
                          {achievement.description ? (
                            <p className="mt-1 text-xs text-white/60">{achievement.description}</p>
                          ) : null}
                          <p className="mt-1 text-[10px] uppercase tracking-wider text-white/45">
                            {new Date(achievement.awardedAt).toLocaleDateString()}
                            {achievement.edition ? ` - ${achievement.edition.title}` : ''}
                            {achievement.phase ? ` - ${achievement.phase.title}` : ''}
                          </p>
                        </div>
                        <form action={deleteUserAchievement}>
                          <input type="hidden" name="achievementId" value={achievement.id} />
                          <FormSubmitButton
                            className="inline-flex h-8 items-center justify-center rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 text-[11px] font-semibold text-rose-100 transition hover:bg-rose-400/20"
                            pendingLabel="Borrando..."
                            confirmMessage="Eliminar este logro?"
                          >
                            Borrar
                          </FormSubmitButton>
                        </form>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-white/55">
                      Sin logros manuales. Los logros automaticos (fichas FINALIZADAS) se ven
                      directamente en el dashboard del participante.
                    </p>
                  )}
                </div>

                <form action={createUserAchievement} className="mt-4 grid gap-2 md:grid-cols-2">
                  <input type="hidden" name="userId" value={user.id} />
                  <label className="grid gap-1 md:col-span-2">
                    <span className="text-[10px] text-white/55">Titulo</span>
                    <input
                      name="title"
                      required
                      className="h-9 rounded-lg border border-white/10 bg-slate-950/70 px-3 text-xs text-white/90 outline-none"
                      placeholder="Te felicitamos por terminar Fase 1"
                    />
                  </label>
                  <label className="grid gap-1 md:col-span-2">
                    <span className="text-[10px] text-white/55">Descripcion (opcional)</span>
                    <input
                      name="description"
                      className="h-9 rounded-lg border border-white/10 bg-slate-950/70 px-3 text-xs text-white/90 outline-none"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[10px] text-white/55">Icono (emoji opcional)</span>
                    <input
                      name="icon"
                      maxLength={4}
                      className="h-9 rounded-lg border border-white/10 bg-slate-950/70 px-3 text-xs text-white/90 outline-none"
                      placeholder="*"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[10px] text-white/55">Edicion (opcional)</span>
                    <select
                      name="editionId"
                      defaultValue={selectedEditionSlug
                        ? editions.find((e) => e.slug === selectedEditionSlug)?.id ?? ''
                        : ''}
                      className="h-9 rounded-lg border border-white/10 bg-slate-950/70 px-3 text-xs text-white/90 outline-none"
                    >
                      <option value="">Sin edicion</option>
                      {editions.map((edition) => (
                        <option key={edition.id} value={edition.id}>
                          {edition.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="md:col-span-2">
                    <FormSubmitButton
                      className="inline-flex h-9 items-center justify-center rounded-lg bg-amber-300 px-3 text-xs font-semibold text-black transition hover:bg-amber-200"
                      pendingLabel="Guardando..."
                    >
                      Agregar logro
                    </FormSubmitButton>
                  </div>
                </form>
              </details>

              <details className="mt-6 rounded-3xl border border-white/10 bg-black/25 p-4 open:border-emerald-400/30">
                <summary className="cursor-pointer text-sm font-semibold text-white/80">
                  + Agregar ficha en otra edicion / fase
                </summary>
                <form action={upsertEnrollment} className="mt-3 grid gap-3 md:grid-cols-2">
                  <input type="hidden" name="userId" value={user.id} />
                  <input type="hidden" name="returnTab" value="finance" />
                  <input type="hidden" name="currency" value="ARS" />

                  <label className="grid gap-1">
                    <span className="text-xs text-white/55">Edicion</span>
                    <select
                      name="editionId"
                      required
                      className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Elegir edicion
                      </option>
                      {editions.map((edition) => (
                        <option key={edition.id} value={edition.id}>
                          {edition.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs text-white/55">Fase</span>
                    <select
                      name="phaseId"
                      required
                      className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Elegir fase
                      </option>
                      {editions.flatMap((edition) =>
                        edition.phases.map((phase) => (
                          <option key={phase.id} value={phase.id}>
                            {edition.title} - {phase.title}
                          </option>
                        ))
                      )}
                    </select>
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs text-white/55">Monto total</span>
                    <input
                      name="amountDue"
                      defaultValue="0"
                      className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs text-white/55">Estado</span>
                    <select
                      name="status"
                      defaultValue="PENDIENTE"
                      className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                    >
                      <option value="PENDIENTE">Pendiente</option>
                      <option value="RESERVADO">Reservado</option>
                      <option value="CONFIRMADO">Confirmado</option>
                      <option value="CURSANDO">Cursando</option>
                      <option value="FINALIZADO">Finalizado</option>
                      <option value="CANCELADO">Cancelado</option>
                    </select>
                  </label>

                  <label className="grid gap-1 md:col-span-2">
                    <span className="text-xs text-white/55">Notas</span>
                    <input
                      name="notes"
                      className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                    />
                  </label>

                  <label className="md:col-span-2 flex items-center gap-2 rounded-xl border border-amber-300/30 bg-amber-300/5 px-3 py-2 text-xs text-amber-100/90">
                    <input name="isFree" type="checkbox" className="accent-amber-300" />
                    Cupo regalado / gratis. El monto pasa a $0 y se considera 100% cubierta.
                  </label>

                  <div className="md:col-span-2">
                    <FormSubmitButton
                      className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
                      pendingLabel="Guardando..."
                    >
                      Crear ficha
                    </FormSubmitButton>
                  </div>
                </form>
              </details>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
