import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { ButterflyMark } from '@/app/components/ButterflyMark';
import { DashboardBackground } from '@/app/components/DashboardBackground';
import { GiftCouponPanel } from '@/app/components/GiftCouponPanel';
import { GreekGodPanel } from '@/app/components/GreekGodPanel';
import { MaterialViewer } from '@/app/components/MaterialViewer';
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
import { CopyLinkButton } from './ui/CopyLinkButton';
import { ReferralTree } from './ui/ReferralTree';

const LOGO_URL = 'https://pub-a6844436cdf343eca77a9769bb10e73e.r2.dev/LOGO%20HORIZONTAL.png';

function initials(name?: string | null, email?: string | null) {
  const base = (name ?? '').trim();
  if (base) {
    return base
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }
  return (email ?? 'ME').slice(0, 2).toUpperCase();
}

function progressOf(paid: number, due: number) {
  const safeDue = Math.max(due, 0);
  const safePaid = Math.max(paid, 0);
  if (safeDue <= 0) return 0;
  return Math.min(Math.round((safePaid / safeDue) * 100), 100);
}

/* Etiqueta de sección: mismo lenguaje que la landing (eyebrow + título). */
function SectionHead({
  eyebrow,
  title,
  subtitle,
  aside,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="display mt-3 text-[1.5rem] leading-tight sm:text-[1.75rem]">{title}</h2>
        {subtitle ? (
          <p className="mt-2 max-w-prose text-[14px] leading-relaxed text-ivory/55">{subtitle}</p>
        ) : null}
      </div>
      {aside ? <div className="flex-none">{aside}</div> : null}
    </div>
  );
}

function Meter({ paid, due }: { paid: number; due: number }) {
  const progress = progressOf(paid, due);
  const tone = progress >= 100 ? 'meter-done' : progress >= 60 ? '' : 'meter-warn';

  return (
    <div className={`meter ${tone}`} role="presentation">
      <span style={{ width: `${progress}%` }} />
    </div>
  );
}

function PaymentBlock({
  paid,
  due,
  currency,
}: {
  paid: number;
  due: number;
  currency: string;
}) {
  const progress = progressOf(paid, due);
  const remaining = Math.max(due - paid, 0);

  return (
    <div className="mt-4 grid gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="numeric text-[1.05rem] font-semibold text-ivory">{progress}%</span>
        <span className="numeric text-[12px] text-ivory/50">
          {formatMoney(paid, currency)} / {formatMoney(due, currency)}
        </span>
      </div>
      <Meter paid={paid} due={due} />
      <p className="text-[12px] text-ivory/50">
        {remaining > 0 ? `Te falta ${formatMoney(remaining, currency)}` : 'Pago completo ✓'}
      </p>
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
  accent = 'celeste',
  children,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: 'celeste' | 'sand' | 'plain';
  children?: React.ReactNode;
}) {
  const valueClass =
    accent === 'sand' ? 'text-sand' : accent === 'celeste' ? 'text-celeste' : 'text-ivory';

  return (
    <div className="tile p-4 sm:p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ivory/40">{label}</p>
      <p className={`display-sm mt-2.5 text-[1.35rem] leading-tight ${valueClass}`}>{value}</p>
      {hint ? <p className="mt-1.5 text-[12px] leading-relaxed text-ivory/45">{hint}</p> : null}
      {children ? <div className="mt-3">{children}</div> : null}
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

  const displayName = user.name?.trim() || user.email || 'Metamorfosis';
  const firstName = displayName.split(/\s+/)[0];

  const totalDue = enrollments.reduce((sum, entry) => sum + entry.amountDueCents, 0);
  const totalPaid = enrollments.reduce(
    (sum, entry) => sum + sumConfirmedPayments(entry.payments),
    0
  );
  const totalPending = Math.max(totalDue - totalPaid, 0);
  const totalProgress = progressOf(totalPaid, totalDue);

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

  const adminLink = isAdminRole(user.role) ? (
    <Link
      className="inline-flex h-10 items-center justify-center rounded-xl border border-ivory/12 bg-ivory/[0.05] px-4 text-xs font-bold uppercase tracking-[0.12em] text-ivory/80 transition duration-300 hover:border-ivory/30 hover:text-ivory"
      href="/admin"
    >
      Admin
    </Link>
  ) : null;

  return (
    <main className="grain relative min-h-screen text-ivory">
      <DashboardBackground />

      {/* Barra fija: la identidad y las acciones quedan siempre a mano. */}
      <header className="sticky top-0 z-40 border-b border-ivory/10 bg-night/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <Link href="/" className="flex items-center gap-3 transition hover:opacity-80">
            <ButterflyMark className="h-7 w-7 flex-none text-celeste" strokeWidth={4} />
            <span className="leading-tight">
              <span className="block text-[9px] font-bold uppercase tracking-[0.28em] text-ivory/40">
                Metamorfosis
              </span>
              <span className="display-sm block text-[0.95rem] text-ivory">Panel del participante</span>
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-2.5 rounded-full border border-ivory/10 bg-ivory/[0.04] py-1.5 pl-1.5 pr-4 md:inline-flex">
              <span
                aria-hidden="true"
                className="grid h-7 w-7 flex-none place-items-center rounded-full border border-celeste/35 bg-celeste/15 text-[11px] font-bold text-celeste"
              >
                {initials(user.name, user.email)}
              </span>
              <span className="max-w-[12rem] truncate text-[12px] font-semibold text-ivory/75">
                {firstName}
              </span>
            </span>
            {adminLink}
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-5 pb-24 pt-10 sm:px-8">
        {/* Hero */}
        <section className="relative">
          <div
            aria-hidden="true"
            className="aura aura-celeste aura-breathe -top-24 left-1/2 h-[380px] w-[380px] -translate-x-1/2 sm:left-40"
          />

          <div className="relative">
            <p className="eyebrow">Tu espacio</p>
            <h1 className="display mt-4 text-[2rem] leading-[1.05] sm:text-[2.85rem]">
              Bienvenido/a <span className="em">{firstName}</span>
              <br className="hidden sm:block" /> a tu proceso.
            </h1>

            {/* mix-blend en .brand-logo: el PNG viene con fondo negro opaco. */}
            <img
              src={LOGO_URL}
              alt="Metamorfosis"
              className="brand-logo mt-7 block w-full max-w-sm object-contain sm:max-w-lg"
            />

            <p className="mt-5 max-w-prose text-[15px] leading-relaxed text-ivory/55">
              Acá vive todo tu recorrido: la etapa en la que estás, tus materiales, tus pagos y la
              red que fuiste sumando.
            </p>
          </div>
        </section>

        {user.newsPosts.length ? (
          <div className="mt-10">
            <NewsBanner posts={user.newsPosts} />
          </div>
        ) : null}

        {canGiftEditionSix ? (
          <div className="mt-10">
            <GiftCouponPanel giftInvitation={editionSixGift} />
          </div>
        ) : null}

        {/* Resumen en cuatro datos */}
        <section className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Etapa actual"
            value={currentEnrollment?.phase?.title ?? 'Sin fase asignada'}
            hint={primaryEdition?.title ?? 'Esperando edición'}
            accent="plain"
          />
          <StatTile
            label="Tu estado"
            value={statusLabel(user.status)}
            hint={
              primaryEdition ? `Sos de ${primaryEdition.title}` : 'Aún no estás asignado a una edición'
            }
          />
          <StatTile
            label={totalPending > 0 ? 'Pendiente de pago' : 'Pagos'}
            value={totalPending > 0 ? formatMoney(totalPending) : 'Al día'}
            hint={totalDue > 0 ? `${totalProgress}% cubierto · ${formatMoney(totalPaid)} pagado` : 'Sin fichas cargadas'}
            accent={totalPending > 0 ? 'sand' : 'celeste'}
          >
            {totalDue > 0 ? <Meter paid={totalPaid} due={totalDue} /> : null}
          </StatTile>
          <StatTile
            label="Tu red"
            value={`${user.referrals.length} ${user.referrals.length === 1 ? 'persona' : 'personas'}`}
            hint={`${user.pointsBalance} puntos simbólicos acumulados`}
            accent="plain"
          />
        </section>

        {/* Pagos pendientes: sólo aparece si hay algo por saldar. */}
        {pendingEnrollments.length ? (
          <section className="surface mt-6 p-6 sm:p-7">
            <SectionHead
              eyebrow="Pagos pendientes"
              title="Lo que falta saldar"
              subtitle="Cuando el equipo carga un pago, esta barra se actualiza sola."
            />

            <div className="mt-6 grid gap-3">
              {pendingEnrollments.map(({ entry, paid, pending }) => (
                <div key={entry.id} className="tile tile-accent p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="display-sm text-[1.05rem] text-ivory">
                        {entry.edition.title}
                        {entry.phase ? ` · ${entry.phase.title}` : ''}
                      </p>
                      <p className="mt-1 text-[12px] text-ivory/45">
                        Te falta abonar{' '}
                        <span className="numeric font-semibold text-sand">
                          {formatMoney(pending, entry.currency)}
                        </span>
                      </p>
                    </div>
                    <span className="chip chip-sand">{enrollmentStatusLabel(entry.status)}</span>
                  </div>

                  <PaymentBlock paid={paid} due={entry.amountDueCents} currency={entry.currency} />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Aula + acompañamiento */}
        <section className="mt-6 grid gap-6 lg:grid-cols-[1.45fr,1fr]">
          <div className="surface p-6 sm:p-7">
            <SectionHead
              eyebrow="Aula"
              title="Tareas de la semana"
              subtitle="Las publicamos por fase. Si no ves una tarea, todavía no fue liberada para tu etapa."
              aside={
                visibleTasks.length ? (
                  <span className="chip chip-celeste">
                    {visibleTasks.length} {visibleTasks.length === 1 ? 'tarea' : 'tareas'}
                  </span>
                ) : null
              }
            />

            {visibleTasks.length ? (
              <div className="mt-6 grid gap-3">
                {visibleTasks.map((task) => {
                  const isPersonal = Boolean(task.assignedUserId);
                  return (
                    <article
                      key={task.id}
                      className={`tile p-4 sm:p-5 ${isPersonal ? 'tile-accent' : ''}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p
                            className={`text-[10px] font-bold uppercase tracking-[0.2em] ${
                              isPersonal ? 'text-sand/85' : 'text-celeste/80'
                            }`}
                          >
                            Semana {task.weekNumber}
                            {isPersonal
                              ? ' · Personal'
                              : task.phaseSequence != null
                              ? ` · Fase ${task.phaseSequence}`
                              : ''}
                          </p>
                          <h3 className="display-sm mt-2 text-[1.1rem] text-ivory">{task.title}</h3>
                        </div>
                        {task.dueAt ? (
                          <span className="chip chip-sand">
                            Hasta {new Date(task.dueAt).toLocaleDateString()}
                          </span>
                        ) : null}
                      </div>

                      {task.summary ? (
                        <p className="mt-3 text-[14px] leading-relaxed text-ivory/70">{task.summary}</p>
                      ) : null}
                      {task.body ? (
                        <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-ivory/55">
                          {task.body}
                        </p>
                      ) : null}
                      {task.resourceUrl ? (
                        <div className="mt-4">
                          <MaterialViewer
                            url={task.resourceUrl}
                            title={task.title}
                            badge={
                              isPersonal
                                ? `Semana ${task.weekNumber} · Personal`
                                : task.phaseSequence != null
                                ? `Semana ${task.weekNumber} · Fase ${task.phaseSequence}`
                                : `Semana ${task.weekNumber}`
                            }
                            triggerLabel="Abrir material"
                          />
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="tile mt-6 p-6 text-center">
                <p className="text-[14px] leading-relaxed text-ivory/55">
                  Todavía no hay tareas publicadas para tu fase.
                  <br />
                  Te avisamos acá mismo cuando estén listas.
                </p>
              </div>
            )}
          </div>

          <div className="grid content-start gap-6">
            <GreekGodPanel assignment={user.godAssignment} />

            <div className="surface p-6">
              <p className="eyebrow">Tu invitación</p>
              <h2 className="display mt-3 text-[1.4rem] leading-tight">Link personal</h2>

              {referralLink ? (
                <>
                  <code className="mt-4 block select-all break-all rounded-xl border border-ivory/10 bg-night/50 p-3 text-[12px] leading-relaxed text-ivory/60">
                    {referralLink}
                  </code>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <CopyLinkButton path={referralLink} />
                    <p className="text-[12px] text-ivory/40">Compartir es opcional y consciente.</p>
                  </div>
                </>
              ) : (
                <p className="mt-4 text-[14px] leading-relaxed text-ivory/55">
                  Todavía estamos generando tu link.
                </p>
              )}
            </div>

            <div className="surface p-6">
              <p className="eyebrow">Tus puntos</p>
              <p className="numeric mt-4 text-[2.6rem] font-semibold leading-none text-celeste">
                {user.pointsBalance}
              </p>
              <p className="mt-3 text-[14px] leading-relaxed text-ivory/55">
                Reconocimiento simbólico por aportar a la comunidad. No representan dinero.
              </p>

              {user.pointsTransactions.length ? (
                <div className="mt-5 grid gap-2">
                  {user.pointsTransactions.slice(0, 4).map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-ivory/8 bg-night/40 px-3 py-2 text-[12px]"
                    >
                      <span className="numeric font-bold text-celeste">+{transaction.points}</span>
                      <span className="text-ivory/45">
                        {new Date(transaction.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {/* Logros */}
        {user.achievements.length ? (
          <section className="surface surface-accent mt-6 p-6 sm:p-7">
            <SectionHead
              eyebrow="Mis logros"
              title="Tu recorrido"
              aside={
                <span className="chip chip-celeste">
                  {user.achievements.length} {user.achievements.length === 1 ? 'logro' : 'logros'}
                </span>
              }
            />

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {user.achievements.map((achievement) => (
                <article
                  key={achievement.id}
                  className={`tile p-4 sm:p-5 ${achievement.kind === 'DERIVED' ? '' : 'tile-accent'}`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ivory/40">
                    {achievement.kind === 'DERIVED' ? 'Etapa completada' : 'Reconocimiento'}
                  </p>
                  <h3 className="display-sm mt-2 text-[1.1rem] text-ivory">
                    {achievement.icon ? `${achievement.icon} ` : ''}
                    {achievement.title}
                  </h3>
                  {achievement.description ? (
                    <p className="mt-2 text-[13px] leading-relaxed text-ivory/60">
                      {achievement.description}
                    </p>
                  ) : null}
                  <p className="mt-3 text-[11px] text-ivory/35">
                    {new Date(achievement.awardedAt).toLocaleDateString()}
                    {achievement.edition ? ` · ${achievement.edition.title}` : ''}
                    {achievement.phase ? ` · ${achievement.phase.title}` : ''}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {/* Comunidad */}
        <section className="mt-6 grid gap-6 lg:grid-cols-[1.45fr,1fr]">
          <div className="surface p-6 sm:p-7">
            <ReferralTree root={user} maxDepth={2} />
          </div>

          <div className="grid content-start gap-3">
            <div className="tile p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ivory/40">
                Quién te invitó
              </p>
              <p className="display-sm mt-2.5 text-[1.1rem] text-ivory">
                {user.referredBy?.name ?? user.referredBy?.email ?? 'Sin referencia cargada'}
              </p>
              {user.referredBy?.email ? (
                <p className="mt-1.5 text-[12px] text-ivory/45">{user.referredBy.email}</p>
              ) : null}
            </div>

            <div className="tile p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ivory/40">
                A quiénes invitaste
              </p>
              <p className="numeric mt-2.5 text-[2rem] font-semibold leading-none text-ivory">
                {user.referrals.length}
              </p>
              <p className="mt-2 text-[12px] text-ivory/45">Primer nivel de tu red.</p>
            </div>
          </div>
        </section>

        {/* Ediciones y pagos */}
        <section className="surface mt-6 p-6 sm:p-7">
          <SectionHead
            eyebrow="Administración"
            title="Tus ediciones y pagos"
            subtitle="Detalle de cada ficha del equipo y los pagos cargados."
          />

          {enrollments.length ? (
            <div className="mt-6 grid gap-4">
              {enrollments.map((enrollment) => {
                const confirmedPaid = sumConfirmedPayments(enrollment.payments);
                const remaining = Math.max(enrollment.amountDueCents - confirmedPaid, 0);

                return (
                  <div key={enrollment.id} className="tile p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-celeste/80">
                          {enrollment.edition.title}
                        </p>
                        <p className="display-sm mt-2 text-[1.2rem] text-ivory">
                          {enrollment.phase?.title ?? 'Sin fase'}
                        </p>
                        <p className="numeric mt-2 text-[13px] text-ivory/55">
                          Total {formatMoney(enrollment.amountDueCents, enrollment.currency)} · Pagado{' '}
                          {formatMoney(confirmedPaid, enrollment.currency)} · Falta{' '}
                          {formatMoney(remaining, enrollment.currency)}
                        </p>
                        {enrollment.notes ? (
                          <p className="mt-2 text-[12px] text-ivory/45">
                            Nota del equipo: {enrollment.notes}
                          </p>
                        ) : null}
                      </div>

                      <span className={`chip ${remaining > 0 ? 'chip-sand' : 'chip-celeste'}`}>
                        {enrollmentStatusLabel(enrollment.status)}
                      </span>
                    </div>

                    <PaymentBlock
                      paid={confirmedPaid}
                      due={enrollment.amountDueCents}
                      currency={enrollment.currency}
                    />

                    {enrollment.payments.length ? (
                      <div className="mt-5 grid gap-2">
                        {enrollment.payments.map((payment) => (
                          <div
                            key={payment.id}
                            className="rounded-xl border border-ivory/8 bg-night/40 p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="numeric text-[15px] font-semibold text-ivory/90">
                                {formatMoney(payment.amountCents, payment.currency)}
                              </p>
                              <p className="text-[12px] text-ivory/45">
                                {new Date(payment.paidAt).toLocaleDateString()}
                              </p>
                            </div>
                            <p className="mt-1.5 text-[12px] text-ivory/55">
                              {paymentMethodLabel(payment.method)} · {paymentStatusLabel(payment.status)}
                            </p>
                            {payment.reference ? (
                              <p className="mt-1 text-[12px] text-ivory/40">
                                Referencia: {payment.reference}
                              </p>
                            ) : null}
                            {payment.notes ? (
                              <p className="mt-1 text-[12px] text-ivory/40">Nota: {payment.notes}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-5 text-[13px] text-ivory/45">Todavía no hay pagos cargados.</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="tile mt-6 p-6">
              <p className="text-[14px] leading-relaxed text-ivory/55">
                Todavía no hay una edición asignada a tu cuenta. El equipo la puede cargar desde admin.
              </p>
            </div>
          )}
        </section>

        {/* Historial */}
        <section className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="surface p-6 sm:p-7">
            <SectionHead
              eyebrow="Historial"
              title="Cambios de estado"
              subtitle="Registro de avances cargado por el equipo."
            />

            {user.statusEvents.length ? (
              <ol className="mt-6 grid gap-3">
                {user.statusEvents.map((event) => (
                  <li key={event.id} className="tile flex items-start gap-3 p-4">
                    <span
                      aria-hidden="true"
                      className="mt-1.5 h-2 w-2 flex-none rounded-full bg-celeste shadow-[0_0_12px_rgba(124,201,236,0.9)]"
                    />
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-ivory/90">
                        {statusLabel(event.fromStatus)} → {statusLabel(event.toStatus)}
                      </p>
                      <p className="mt-1 text-[12px] text-ivory/45">
                        {new Date(event.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-6 text-[14px] text-ivory/50">Todavía no hay cambios registrados.</p>
            )}
          </div>

          <div className="surface p-6 sm:p-7">
            <SectionHead
              eyebrow="Comunidad"
              title="Movimientos de puntos"
              subtitle="Los puntos son simbólicos y no representan dinero."
            />

            {user.pointsTransactions.length ? (
              <div className="mt-6 grid gap-3">
                {user.pointsTransactions.map((transaction) => (
                  <div key={transaction.id} className="tile p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="numeric text-[15px] font-semibold text-celeste">
                        +{transaction.points} pts
                      </p>
                      <p className="text-[12px] text-ivory/45">
                        {new Date(transaction.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <p className="mt-1.5 text-[12px] text-ivory/55">Motivo: {transaction.reason}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-6 text-[14px] text-ivory/50">Sin movimientos todavía.</p>
            )}
          </div>
        </section>

        <footer className="mt-12 flex flex-col gap-4 border-t border-ivory/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <Link
            className="text-[13px] text-ivory/50 transition hover:text-ivory"
            href="/"
          >
            ← Volver a la landing
          </Link>
          <p className="text-[11px] uppercase tracking-[0.16em] text-ivory/25">
            Metamorfosis · Panel del participante
          </p>
        </footer>
      </div>
    </main>
  );
}
