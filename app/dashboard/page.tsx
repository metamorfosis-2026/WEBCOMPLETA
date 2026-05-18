import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { DashboardBackground } from '@/app/components/DashboardBackground';
import { GiftCouponPanel } from '@/app/components/GiftCouponPanel';
import { GreekGodPanel } from '@/app/components/GreekGodPanel';
import { NewsBanner } from '@/app/components/NewsBanner';
import { getGiftCouponState } from '@/app/lib/gifts';
import {
  enrollmentStatusLabel,
  formatMoney,
  isAdminRole,
  paymentMethodLabel,
  paymentStatusLabel,
  statusLabel,
  sumConfirmedPayments,
} from '@/app/lib/metamorfosis';
import SignOutButton from './ui/SignOutButton';
import { ReferralTree } from './ui/ReferralTree';

function PaymentBar({
  paid,
  due,
  currency,
}: {
  paid: number;
  due: number;
  currency: string;
}) {
  const safeDue = Math.max(due, 0);
  const safePaid = Math.max(paid, 0);
  const progress = safeDue > 0 ? Math.min(Math.round((safePaid / safeDue) * 100), 100) : 0;
  const remaining = Math.max(safeDue - safePaid, 0);

  return (
    <div className="mt-3 grid gap-2">
      <div className="flex items-center justify-between gap-3 text-xs text-white/60">
        <span>{progress}% pagado</span>
        <span>
          {formatMoney(safePaid, currency)} / {formatMoney(safeDue, currency)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all ${
            progress >= 100 ? 'bg-emerald-400' : progress >= 60 ? 'bg-cyan-400' : 'bg-amber-300'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-white/60">
        {remaining > 0
          ? `Te falta ${formatMoney(remaining, currency)}`
          : 'Pago completo'}
      </p>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const giftState = await getGiftCouponState(session.user.id);
  if (!giftState) redirect('/login');

  const { user, enrollments, editionSixGift, canGiftEditionSix } = giftState;
  const referralLink = user.referralCode ? `/register?ref=${encodeURIComponent(user.referralCode)}` : null;

  const totalDue = enrollments.reduce((sum, entry) => sum + entry.amountDueCents, 0);
  const totalPaid = enrollments.reduce(
    (sum, entry) => sum + sumConfirmedPayments(entry.payments),
    0
  );
  const totalPending = Math.max(totalDue - totalPaid, 0);

  const currentEnrollment =
    enrollments.find((entry) => entry.status === 'CURSANDO') ??
    enrollments.find(
      (entry) => sumConfirmedPayments(entry.payments) < entry.amountDueCents
    ) ??
    enrollments[0] ??
    null;

  const primaryEdition = currentEnrollment?.edition ?? null;

  const pendingEnrollments = enrollments
    .map((entry) => {
      const paid = sumConfirmedPayments(entry.payments);
      return { entry, paid, pending: Math.max(entry.amountDueCents - paid, 0) };
    })
    .filter((row) => row.entry.amountDueCents > 0 && row.pending > 0);

  const visibleTasks = user.weeklyTasks
    .slice()
    .sort((left, right) => {
      if (left.weekNumber !== right.weekNumber) return right.weekNumber - left.weekNumber;
      const leftDate = left.dueAt ? new Date(left.dueAt).getTime() : 0;
      const rightDate = right.dueAt ? new Date(right.dueAt).getTime() : 0;
      return rightDate - leftDate;
    });

  return (
    <main className="relative min-h-screen text-white">
      <DashboardBackground />
      <div className="mx-auto w-full max-w-5xl px-5 py-10">
        {user.newsPosts.length ? <NewsBanner posts={user.newsPosts} /> : null}

        {canGiftEditionSix ? (
          <div className="mb-8">
            <GiftCouponPanel giftInvitation={editionSixGift} />
          </div>
        ) : null}

        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Bienvenido/a{' '}
              <span className="text-emerald-200 drop-shadow-[0_0_22px_rgba(110,231,183,0.55)]">
                {user.name?.trim() || user.email || 'Metamorfosis'}
              </span>{' '}
              a...
            </h1>
            <img
              src="https://pub-a6844436cdf343eca77a9769bb10e73e.r2.dev/LOGO%20HORIZONTAL.png"
              alt="Metamorfosis"
              className="glow-pulse mx-auto mt-4 block w-full max-w-none object-contain sm:mx-0 sm:mt-6 sm:max-w-xl"
            />
            <p className="glow-pulse mt-4 text-base font-bold uppercase tracking-[0.15em] text-white sm:text-xl sm:tracking-[0.2em]">
              Este es tu panel virtual de Meta!
            </p>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            {isAdminRole(user.role) ? (
              <Link
                className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/90 transition hover:bg-white/10"
                href="/admin"
              >
                Admin
              </Link>
            ) : null}
            <SignOutButton />
          </div>
        </div>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-7">
          <p className="text-xs font-bold tracking-[0.3em] text-emerald-200/90">MI PROCESO</p>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {primaryEdition ? (
              <h2 className="text-lg font-semibold text-white">
                Sos de <span className="text-emerald-200">{primaryEdition.title}</span>
              </h2>
            ) : (
              <h2 className="text-lg font-semibold text-white/80">Aun no estas asignado a una edicion</h2>
            )}
            <p className="text-sm text-white/70">
              Estas en: <span className="font-semibold text-emerald-200">{statusLabel(user.status)}</span>
            </p>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="text-[10px] uppercase tracking-wider text-white/45">Etapa actual</p>
              <p className="mt-2 text-base font-semibold text-white">
                {currentEnrollment?.phase?.title ?? 'Sin fase asignada'}
              </p>
              <p className="mt-1 text-xs text-white/55">
                {currentEnrollment?.edition?.title ?? 'Esperando edicion'}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="text-[10px] uppercase tracking-wider text-white/45">Cobrado</p>
              <p className="mt-2 text-base font-semibold text-emerald-200">{formatMoney(totalPaid)}</p>
              <p className="mt-1 text-xs text-white/55">Suma de todas tus fichas</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="text-[10px] uppercase tracking-wider text-white/45">Pendiente</p>
              <p className="mt-2 text-base font-semibold text-amber-200">{formatMoney(totalPending)}</p>
              <p className="mt-1 text-xs text-white/55">
                {totalPending > 0 ? 'Aun tenes saldo por pagar' : 'No tenes saldo pendiente'}
              </p>
            </div>
          </div>

          {pendingEnrollments.length ? (
            <div className="mt-5 grid gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-200/90">
                Pagos pendientes
              </p>
              {pendingEnrollments.map(({ entry, paid, pending }) => (
                <div
                  key={entry.id}
                  className="rounded-2xl border border-amber-300/25 bg-amber-300/5 p-4"
                >
                  <p className="text-xs text-amber-100/85">
                    {entry.edition.title}
                    {entry.phase ? ` - ${entry.phase.title}` : ''}{' '}
                    <span className="text-white/55">
                      - Estado: {enrollmentStatusLabel(entry.status)}
                    </span>
                  </p>
                  <PaymentBar
                    paid={paid}
                    due={entry.amountDueCents}
                    currency={entry.currency}
                  />
                  <p className="mt-2 text-xs text-amber-100/80">
                    Te falta abonar{' '}
                    <span className="font-semibold text-amber-100">
                      {formatMoney(pending, entry.currency)}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="text-xs font-bold tracking-wide text-emerald-200/90">QUIEN TE INVITO</p>
              <p className="mt-2 text-sm font-semibold text-white">
                {user.referredBy?.name ?? user.referredBy?.email ?? 'Sin referencia cargada'}
              </p>
              {user.referredBy?.email ? (
                <p className="mt-1 text-xs text-white/55">{user.referredBy.email}</p>
              ) : null}
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="text-xs font-bold tracking-wide text-emerald-200/90">A QUIENES INVITASTE</p>
              <p className="mt-2 text-2xl font-semibold text-white">{user.referrals.length}</p>
              <p className="mt-1 text-xs text-white/55">Primer nivel de tu red.</p>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.4fr,1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs font-bold tracking-[0.3em] text-emerald-200/90">AULA</p>
            <h2 className="mt-2 text-lg font-semibold text-white">Tareas de la semana</h2>
            <p className="mt-2 text-sm text-white/65">
              Las cargamos por fase. Si no ves una tarea, todavia no fue publicada para tu etapa.
            </p>

            {visibleTasks.length ? (
              <div className="mt-5 grid gap-3">
                {visibleTasks.map((task) => {
                  const isPersonal = Boolean(task.assignedUserId);
                  return (
                    <article
                      key={task.id}
                      className={`rounded-2xl border p-4 ${
                        isPersonal
                          ? 'border-amber-300/30 bg-amber-300/5'
                          : 'border-white/10 bg-black/25'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p
                            className={`text-[10px] uppercase tracking-[0.2em] ${
                              isPersonal ? 'text-amber-100/90' : 'text-emerald-100/80'
                            }`}
                          >
                            Semana {task.weekNumber}
                            {isPersonal
                              ? ' - Personal'
                              : task.phaseSequence != null
                              ? ` - Fase ${task.phaseSequence}`
                              : ''}
                          </p>
                          <h3 className="mt-1 text-base font-semibold text-white">{task.title}</h3>
                        </div>
                        {task.dueAt ? (
                          <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-[10px] font-semibold text-amber-100">
                            Hasta {new Date(task.dueAt).toLocaleDateString()}
                          </span>
                        ) : null}
                      </div>
                      {task.summary ? (
                        <p className="mt-2 text-sm text-white/75">{task.summary}</p>
                      ) : null}
                      {task.body ? (
                        <p className="mt-2 whitespace-pre-line text-sm text-white/65">{task.body}</p>
                      ) : null}
                      {task.resourceUrl ? (
                        <a
                          href={task.resourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex h-9 items-center justify-center rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-3 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-400/20"
                        >
                          Abrir material
                        </a>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="mt-5 text-sm text-white/65">
                Todavia no hay tareas publicadas para tu fase. Te avisaremos cuando esten listas.
              </p>
            )}
          </div>

          <div className="grid gap-6">
            <GreekGodPanel assignment={user.godAssignment} />

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <p className="text-xs font-bold tracking-[0.3em] text-emerald-200/90">TU INVITACION</p>
              {referralLink ? (
                <>
                  <p className="mt-2 text-sm text-white/75">Link personal:</p>
                  <code className="mt-2 block select-all rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/70">
                    {referralLink}
                  </code>
                  <p className="mt-3 text-xs text-white/50">Compartir es opcional y consciente.</p>
                </>
              ) : (
                <p className="mt-2 text-sm text-white/65">Todavia estamos generando tu link.</p>
              )}
            </div>
          </div>
        </section>

        {user.achievements.length ? (
          <section className="mt-8 rounded-3xl border border-amber-300/25 bg-gradient-to-br from-amber-300/10 via-rose-300/5 to-slate-950/30 p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-xs font-bold tracking-[0.3em] text-amber-100/90">MIS LOGROS</p>
                <h2 className="mt-2 text-lg font-semibold text-white">Tu recorrido</h2>
              </div>
              <span className="text-xs text-white/55">
                {user.achievements.length} logro(s) hasta ahora
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {user.achievements.map((achievement) => (
                <article
                  key={achievement.id}
                  className={`rounded-2xl border p-4 ${
                    achievement.kind === 'DERIVED'
                      ? 'border-emerald-300/30 bg-emerald-400/5'
                      : 'border-amber-300/40 bg-amber-300/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.25em] text-white/55">
                        {achievement.kind === 'DERIVED' ? 'Etapa completada' : 'Reconocimiento'}
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-white">
                        {achievement.icon ? `${achievement.icon} ` : ''}
                        {achievement.title}
                      </h3>
                      {achievement.description ? (
                        <p className="mt-1 text-xs text-white/65">{achievement.description}</p>
                      ) : null}
                      <p className="mt-2 text-[11px] text-white/45">
                        {new Date(achievement.awardedAt).toLocaleDateString()}
                        {achievement.edition ? ` - ${achievement.edition.title}` : ''}
                        {achievement.phase ? ` - ${achievement.phase.title}` : ''}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.4fr,1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <ReferralTree root={user} maxDepth={2} />
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs font-bold tracking-[0.3em] text-emerald-200/90">TUS PUNTOS</p>
            <p className="mt-2 text-3xl font-semibold text-white">{user.pointsBalance}</p>
            <p className="mt-2 text-sm text-white/65">
              Reconocimiento simbolico por aportar a la comunidad. No representan dinero.
            </p>

            {user.pointsTransactions.length ? (
              <div className="mt-5 grid gap-2 text-xs">
                {user.pointsTransactions.slice(0, 4).map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2"
                  >
                    <span className="font-semibold text-emerald-200">+{transaction.points}</span>
                    <span className="text-white/55">
                      {new Date(transaction.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">Tus ediciones y pagos</h2>
          <p className="mt-2 text-sm text-white/65">
            Detalle de cada ficha del equipo y los pagos cargados.
          </p>

          {enrollments.length ? (
            <div className="mt-6 grid gap-4">
              {enrollments.map((enrollment) => {
                const confirmedPaid = sumConfirmedPayments(enrollment.payments);
                const remaining = Math.max(enrollment.amountDueCents - confirmedPaid, 0);

                return (
                  <div key={enrollment.id} className="rounded-2xl border border-white/10 bg-black/25 p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-200/90">
                          {enrollment.edition.title}
                        </p>
                        <p className="mt-1 text-lg font-semibold text-white">
                          {enrollment.phase?.title ?? 'Sin fase'}
                        </p>
                        <p className="mt-2 text-sm text-white/65">
                          Total: {formatMoney(enrollment.amountDueCents, enrollment.currency)} - Pagado:{' '}
                          {formatMoney(confirmedPaid, enrollment.currency)} - Falta:{' '}
                          {formatMoney(remaining, enrollment.currency)}
                        </p>
                        {enrollment.notes ? (
                          <p className="mt-2 text-xs text-white/55">Nota del equipo: {enrollment.notes}</p>
                        ) : null}
                      </div>

                      <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75">
                        {enrollmentStatusLabel(enrollment.status)}
                      </div>
                    </div>

                    <PaymentBar
                      paid={confirmedPaid}
                      due={enrollment.amountDueCents}
                      currency={enrollment.currency}
                    />

                    {enrollment.payments.length ? (
                      <div className="mt-5 grid gap-3">
                        {enrollment.payments.map((payment) => (
                          <div key={payment.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <p className="text-sm font-semibold text-white/90">
                                {formatMoney(payment.amountCents, payment.currency)}
                              </p>
                              <p className="text-xs text-white/55">
                                {new Date(payment.paidAt).toLocaleDateString()}
                              </p>
                            </div>
                            <p className="mt-2 text-xs text-white/60">
                              {paymentMethodLabel(payment.method)} - {paymentStatusLabel(payment.status)}
                            </p>
                            {payment.reference ? (
                              <p className="mt-1 text-xs text-white/50">Referencia: {payment.reference}</p>
                            ) : null}
                            {payment.notes ? (
                              <p className="mt-1 text-xs text-white/50">Nota: {payment.notes}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-5 text-sm text-white/65">Todavia no hay pagos cargados.</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-6 text-sm text-white/65">
              Todavia no hay una edicion asignada a tu cuenta. El equipo la puede cargar desde admin.
            </p>
          )}
        </section>

        <section className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold">Historial de estado</h2>
            <p className="mt-2 text-sm text-white/65">Registro de avances cargado por el equipo.</p>

            {user.statusEvents.length ? (
              <div className="mt-5 grid gap-3">
                {user.statusEvents.map((event) => (
                  <div key={event.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-sm font-semibold text-white/90">
                      {statusLabel(event.fromStatus)} {'->'} {statusLabel(event.toStatus)}
                    </p>
                    <p className="mt-1 text-xs text-white/55">
                      {new Date(event.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-sm text-white/65">Todavia no hay cambios registrados.</p>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold">Movimientos de puntos</h2>
            <p className="mt-2 text-sm text-white/65">
              Los puntos siguen siendo simbolicos y no representan dinero.
            </p>

            {user.pointsTransactions.length ? (
              <div className="mt-5 grid gap-3">
                {user.pointsTransactions.map((transaction) => (
                  <div key={transaction.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white/90">+{transaction.points} pts</p>
                      <p className="text-xs text-white/55">
                        {new Date(transaction.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-white/60">Motivo: {transaction.reason}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-sm text-white/65">Sin movimientos todavia.</p>
            )}
          </div>
        </section>

        <div className="mt-10 flex flex-col gap-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <Link className="text-white/70 hover:text-white hover:underline" href="/">
            {'<-'} Volver a la landing
          </Link>
          <div className="flex items-center gap-3 sm:hidden">
            {isAdminRole(user.role) ? (
              <Link
                className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/90 transition hover:bg-white/10"
                href="/admin"
              >
                Admin
              </Link>
            ) : null}
            <SignOutButton />
          </div>
        </div>
      </div>
    </main>
  );
}
