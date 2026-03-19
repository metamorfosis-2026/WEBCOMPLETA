import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { prisma } from '@/app/lib/prisma';
import SignOutButton from './ui/SignOutButton';
import { ReferralTree } from './ui/ReferralTree';

function statusLabel(status: string) {
  switch (status) {
    case 'FASE_1':
      return 'Fase 1';
    case 'PROCESO_ACTIVO':
      return 'Proceso activo';
    case 'EGRESADO':
      return 'Egresado/a';
    case 'INTERESADO':
    default:
      return 'Interesado/a';
  }
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      referrals: {
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          createdAt: true,
          referrals: {
            select: { id: true, name: true, email: true, status: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 25,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
      statusEvents: {
        orderBy: { createdAt: 'desc' },
        take: 8,
      },
      pointsTransactions: {
        orderBy: { createdAt: 'desc' },
        take: 8,
      },
    },
  });

  if (!user) redirect('/login');

  const referralLink = user.referralCode ? `/register?ref=${encodeURIComponent(user.referralCode)}` : null;

  return (
    <main className="min-h-screen text-white">
      <div className="mx-auto w-full max-w-5xl px-5 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Tu panel</h1>
            <p className="mt-1 text-sm text-white/70">
              Este espacio es para claridad y seguimiento. Sin presión.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {user.role === 'ADMIN' ? (
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
            <p className="mt-2 text-sm text-white/70">
              Se actualiza a medida que participás del proceso.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs font-bold tracking-wide text-emerald-200/90">PUNTOS</p>
            <p className="mt-2 text-lg font-semibold">{user.pointsBalance}</p>
            <p className="mt-2 text-sm text-white/70">
              Reconocimiento simbólico por aportar a la comunidad. No es dinero.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs font-bold tracking-wide text-emerald-200/90">TU INVITACIÓN</p>
            {referralLink ? (
              <>
                <p className="mt-2 text-sm font-medium text-white/80">
                  Link personal:
                </p>
                <code className="mt-2 block select-all rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/70">
                  {referralLink}
                </code>
                <p className="mt-3 text-xs text-white/50">
                  Compartir es opcional y consciente.
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-white/70">Generando tu link…</p>
            )}
          </div>
        </div>

        <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-7">
          <ReferralTree root={user} maxDepth={2} />
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-7">
            <h2 className="text-lg font-semibold">Historial (estado)</h2>
            <p className="mt-2 text-sm text-white/70">
              Un registro simple de avances. Se actualiza por el equipo.
            </p>

            {user.statusEvents.length ? (
              <div className="mt-6 grid gap-3">
                {user.statusEvents.map((e) => (
                  <div key={e.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-sm font-semibold text-white/90">
                      {statusLabel(e.fromStatus)} → {statusLabel(e.toStatus)}
                    </p>
                    <p className="mt-1 text-xs text-white/50">
                      {new Date(e.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-6 text-sm text-white/70">Todavía no hay cambios registrados.</p>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-7">
            <h2 className="text-lg font-semibold">Movimientos de puntos</h2>
            <p className="mt-2 text-sm text-white/70">
              Los puntos son reconocimiento simbólico y funcional. No son dinero.
            </p>

            {user.pointsTransactions.length ? (
              <div className="mt-6 grid gap-3">
                {user.pointsTransactions.map((t) => (
                  <div key={t.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white/90">+{t.points} pts</p>
                      <p className="text-xs text-white/50">{new Date(t.createdAt).toLocaleDateString()}</p>
                    </div>
                    <p className="mt-1 text-xs text-white/60">Motivo: {t.reason}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-6 text-sm text-white/70">Sin movimientos todavía.</p>
            )}
          </div>
        </div>

        <div className="mt-10 text-sm">
          <Link className="text-white/70 hover:text-white hover:underline" href="/">
            ← Volver a la landing
          </Link>
        </div>
      </div>
    </main>
  );
}
