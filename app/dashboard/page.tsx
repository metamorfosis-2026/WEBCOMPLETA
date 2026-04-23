import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import {
  formatMoney,
  isAdminRole,
  paymentMethodLabel,
  paymentStatusLabel,
  statusLabel,
  sumConfirmedPayments,
} from '@/app/lib/metamorfosis';
import { getDashboardData } from '@/app/lib/supabase/views';
import { saveGiftRecipient } from './actions';
import SignOutButton from './ui/SignOutButton';
import { ReferralTree } from './ui/ReferralTree';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const user = await getDashboardData(session.user.id);

  if (!user) redirect('/login');

  const referralLink = user.referralCode ? `/register?ref=${encodeURIComponent(user.referralCode)}` : null;

  const enrollments = [...user.enrollments].sort((left, right) => {
    return Number(left.edition.sequence) - Number(right.edition.sequence);
  });
  const phaseTwoPaidEnrollment = enrollments.find((enrollment) => {
    const phase = enrollment.phase;
    const isPhaseTwo = phase ? phase.sequence === 2 || phase.title.toLowerCase().includes('fase 2') : false;
    return isPhaseTwo && sumConfirmedPayments(enrollment.payments) > 0;
  });
  const editionSixGift = user.giftInvitations.find((invitation) => invitation.edition?.sequence === 6) ?? null;
  const canGiftEditionSix = Boolean(phaseTwoPaidEnrollment);

  return (
    <main className="min-h-screen text-white">
      <div className="mx-auto w-full max-w-5xl px-5 py-10">
        {canGiftEditionSix ? (
          <section className="mb-8 overflow-hidden rounded-[2rem] border border-amber-300/30 bg-gradient-to-br from-amber-200/20 via-orange-300/10 to-rose-300/20 shadow-[0_20px_80px_rgba(251,191,36,0.18)]">
            <div className="grid gap-0 lg:grid-cols-[0.95fr,1.05fr]">
              <div className="border-b border-white/10 lg:border-b-0 lg:border-r lg:border-white/10">
                <img
                  src="https://pub-a6844436cdf343eca77a9769bb10e73e.r2.dev/1%20cupo.png"
                  alt="Regalo de un cupo para Metamorfosis 6ta edicion"
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="p-6 sm:p-8">
                <p className="text-xs font-bold tracking-[0.3em] text-amber-100/90">REGALO DISPONIBLE</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
                  Puedes regalar 1 lugar para Metamorfosis 6ta edicion
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80">
                  Como ya tienes Fase 2 con una seña cargada, aquí puedes dejar los datos de la persona a la que
                  quieres invitar. Esto queda guardado para que el equipo lo vea desde admin.
                </p>

                <form action={saveGiftRecipient} className="mt-6 grid gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-xs font-semibold tracking-wide text-white/70">Nombre</span>
                      <input
                        name="recipientFirstName"
                        required
                        defaultValue={editionSixGift?.recipientFirstName ?? ''}
                        className="h-12 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white/90 outline-none transition focus:border-amber-300/60"
                        placeholder="Nombre"
                      />
                    </label>

                    <label className="grid gap-2">
                      <span className="text-xs font-semibold tracking-wide text-white/70">Apellido</span>
                      <input
                        name="recipientLastName"
                        required
                        defaultValue={editionSixGift?.recipientLastName ?? ''}
                        className="h-12 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white/90 outline-none transition focus:border-amber-300/60"
                        placeholder="Apellido"
                      />
                    </label>
                  </div>

                  <label className="grid gap-2">
                    <span className="text-xs font-semibold tracking-wide text-white/70">Celular</span>
                    <input
                      name="recipientPhone"
                      required
                      defaultValue={editionSixGift?.recipientPhone ?? ''}
                      className="h-12 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white/90 outline-none transition focus:border-amber-300/60"
                      placeholder="11 2345 6789"
                    />
                  </label>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-white/60">
                      {editionSixGift
                        ? `Ultima actualizacion: ${new Date(editionSixGift.updatedAt).toLocaleString()}`
                        : 'Todavia no cargaste a la persona invitada.'}
                    </p>
                    <button
                      type="submit"
                      className="inline-flex h-12 items-center justify-center rounded-2xl bg-amber-300 px-5 text-sm font-semibold text-black transition hover:bg-amber-200"
                    >
                      {editionSixGift ? 'Actualizar regalo' : 'Guardar regalo'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </section>
        ) : null}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Tu panel</h1>
            <p className="mt-1 text-sm text-white/70">
              Un espacio simple para ver tu estado, tus referencias y tus pagos.
            </p>
          </div>
          <div className="flex items-center gap-3">
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

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs font-bold tracking-wide text-emerald-200/90">TU ESTADO</p>
            <p className="mt-2 text-lg font-semibold">{statusLabel(user.status)}</p>
            <p className="mt-2 text-sm text-white/70">Se actualiza a medida que avanzas en el proceso.</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs font-bold tracking-wide text-emerald-200/90">PUNTOS</p>
            <p className="mt-2 text-lg font-semibold">{user.pointsBalance}</p>
            <p className="mt-2 text-sm text-white/70">
              Reconocimiento simbolico por aportar a la comunidad.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs font-bold tracking-wide text-emerald-200/90">TU INVITACION</p>
            {referralLink ? (
              <>
                <p className="mt-2 text-sm font-medium text-white/80">Link personal:</p>
                <code className="mt-2 block select-all rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/70">
                  {referralLink}
                </code>
                <p className="mt-3 text-xs text-white/50">Compartir es opcional y consciente.</p>
              </>
            ) : (
              <p className="mt-2 text-sm text-white/70">Todavia estamos generando tu link.</p>
            )}
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-[1.4fr,1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-7">
            <ReferralTree root={user} maxDepth={2} />
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-7">
            <h2 className="text-lg font-semibold">Tu red cercana</h2>
            <p className="mt-2 text-sm text-white/70">
              Aca ves quien te invito y cuantas personas llegaron por tu link.
            </p>

            <div className="mt-5 grid gap-3 text-sm">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs font-bold tracking-wide text-emerald-200/90">TE INVITO</p>
                <p className="mt-2 font-semibold text-white/90">
                  {user.referredBy?.name ?? user.referredBy?.email ?? 'Sin referencia cargada'}
                </p>
                {user.referredBy?.email ? (
                  <p className="mt-1 text-xs text-white/50">{user.referredBy.email}</p>
                ) : null}
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs font-bold tracking-wide text-emerald-200/90">REFERIDOS DIRECTOS</p>
                <p className="mt-2 text-2xl font-semibold text-white">{user.referrals.length}</p>
                <p className="mt-2 text-xs text-white/50">Solo cuenta el primer nivel de invitacion.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-7">
          <h2 className="text-lg font-semibold">Tus ediciones y pagos</h2>
          <p className="mt-2 text-sm text-white/70">
            Si el equipo ya te asigno a una edicion, aca vas a ver el seguimiento del pago.
          </p>

          {enrollments.length ? (
            <div className="mt-6 grid gap-4">
              {enrollments.map((enrollment) => {
                const confirmedPaid = sumConfirmedPayments(enrollment.payments);
                const remaining = Math.max(enrollment.amountDueCents - confirmedPaid, 0);

                return (
                  <div key={enrollment.id} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-xs font-bold tracking-wide text-emerald-200/90">
                          {enrollment.edition.title.toUpperCase()}
                        </p>
                        <p className="mt-2 text-lg font-semibold text-white/90">{enrollment.edition.title}</p>
                        {enrollment.phase ? (
                          <p className="mt-2 text-sm font-medium text-emerald-200/90">{enrollment.phase.title}</p>
                        ) : null}
                        <p className="mt-2 text-sm text-white/60">
                          Total pactado: {formatMoney(enrollment.amountDueCents, enrollment.currency)} - Pagado:{' '}
                          {formatMoney(confirmedPaid, enrollment.currency)} - Restante:{' '}
                          {formatMoney(remaining, enrollment.currency)}
                        </p>
                        {enrollment.notes ? (
                          <p className="mt-3 text-sm text-white/60">Notas del equipo: {enrollment.notes}</p>
                        ) : null}
                      </div>

                      <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                        {enrollment.status}
                      </div>
                    </div>

                    {enrollment.payments.length ? (
                      <div className="mt-5 grid gap-3">
                        {enrollment.payments.map((payment) => (
                          <div
                            key={payment.id}
                            className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <p className="text-sm font-semibold text-white/90">
                                {formatMoney(payment.amountCents, payment.currency)}
                              </p>
                              <p className="text-xs text-white/50">
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
                      <p className="mt-5 text-sm text-white/70">Todavia no hay pagos cargados para esta edicion.</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-6 text-sm text-white/70">
              Todavia no hay una edicion asignada a tu cuenta. El equipo la puede cargar desde admin.
            </p>
          )}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-7">
            <h2 className="text-lg font-semibold">Historial de estado</h2>
            <p className="mt-2 text-sm text-white/70">
              Un registro simple de avances cargado por el equipo.
            </p>

            {user.statusEvents.length ? (
              <div className="mt-6 grid gap-3">
                {user.statusEvents.map((event) => (
                  <div key={event.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-sm font-semibold text-white/90">
                      {statusLabel(event.fromStatus)} {'->'} {statusLabel(event.toStatus)}
                    </p>
                    <p className="mt-1 text-xs text-white/50">
                      {new Date(event.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-6 text-sm text-white/70">Todavia no hay cambios registrados.</p>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-7">
            <h2 className="text-lg font-semibold">Movimientos de puntos</h2>
            <p className="mt-2 text-sm text-white/70">
              Los puntos siguen siendo simbolicos y no representan dinero.
            </p>

            {user.pointsTransactions.length ? (
              <div className="mt-6 grid gap-3">
                {user.pointsTransactions.map((transaction) => (
                  <div key={transaction.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white/90">+{transaction.points} pts</p>
                      <p className="text-xs text-white/50">
                        {new Date(transaction.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-white/60">Motivo: {transaction.reason}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-6 text-sm text-white/70">Sin movimientos todavia.</p>
            )}
          </div>
        </div>

        <div className="mt-10 text-sm">
          <Link className="text-white/70 hover:text-white hover:underline" href="/">
            {'<-'} Volver a la landing
          </Link>
        </div>
      </div>
    </main>
  );
}
