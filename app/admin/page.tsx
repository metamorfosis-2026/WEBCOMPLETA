import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import {
  enrollmentStatusLabel,
  formatMoney,
  isAdminRole,
  isSuperadminRole,
  roleLabel,
  statusLabel,
  sumConfirmedPayments,
} from '@/app/lib/metamorfosis';
import { getAdminData } from '@/app/lib/supabase/views';
import { ActionNotice } from './ActionNotice';
import { FormSubmitButton } from './FormSubmitButton';
import { GodFormModal } from './GodFormModal';
import { PersonalTasksModal } from './PersonalTasksModal';
import { UserDetailModal } from './UserDetailModal';
import {
  assignGodToUser,
  createAdminEdition,
  createAdminEditionPhase,
  createNewsPost,
  createWeeklyTask,
  deleteNewsPostAction,
  deleteWeeklyTaskAction,
  linkUserReferrer,
  updateAdminEdition,
  updateAdminEditionPhase,
  updateNewsPostAction,
  updateUserStatus,
  updateWeeklyTaskAction,
  upsertEnrollment,
} from './actions';

type TreeNode = {
  id: string;
  name: string | null;
  email: string | null;
  referralCode?: string | null;
  status: string;
  pointsBalance: number;
  children: TreeNode[];
};

type AdminTab = 'overview' | 'finance' | 'community' | 'aula' | 'news' | 'gods' | 'gifts' | 'settings';

function initials(name: string | null, email: string | null) {
  const base = (name ?? '').trim();
  if (base) {
    const parts = base.split(/\s+/).slice(0, 2);
    const chars = parts.map((part) => part[0]).filter(Boolean);
    return chars.join('').toUpperCase();
  }

  if (email) return email.slice(0, 2).toUpperCase();
  return 'ME';
}

function matchesQuery(
  node: Pick<TreeNode, 'name' | 'email' | 'referralCode'>,
  query: string
) {
  if (!query) return true;

  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  const haystack = `${node.name ?? ''} ${node.email ?? ''} ${node.referralCode ?? ''}`.toLowerCase();
  return haystack.includes(needle);
}

function filterTree(node: TreeNode, query: string): TreeNode | null {
  if (!query.trim()) return node;

  const nextChildren = node.children
    .map((child) => filterTree(child, query))
    .filter(Boolean) as TreeNode[];

  const keep = matchesQuery(node, query) || nextChildren.length > 0;
  if (!keep) return null;

  return { ...node, children: nextChildren };
}

function NodeCardInner({ node }: { node: TreeNode }) {
  return (
    <div className="tree-node">
      <div className="tree-avatar" aria-hidden="true">
        {initials(node.name, node.email)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white/90">{node.name ?? 'Sin nombre'}</p>
            <p className="truncate text-xs text-white/50">{node.email ?? '-'}</p>
          </div>
          <div className="text-xs text-white/70">
            {statusLabel(node.status)} - <span className="font-semibold">{node.pointsBalance}</span> pts
          </div>
        </div>
        {node.referralCode ? (
          <p className="mt-2 text-[11px] text-white/50">
            Codigo: <span className="font-semibold text-white/70">{node.referralCode}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

function buildAdminHref({
  edition,
  phase,
  q,
  level,
  tab,
  enrollmentStatus,
}: {
  edition?: string;
  phase?: string;
  q?: string;
  level?: string;
  tab?: string;
  enrollmentStatus?: string;
}) {
  const params = new URLSearchParams();
  if (edition) params.set('edition', edition);
  if (phase) params.set('phase', phase);
  if (q?.trim()) params.set('q', q.trim());
  if (level) params.set('level', level);
  if (tab) params.set('tab', tab);
  if (enrollmentStatus) params.set('estado', enrollmentStatus);
  return `/admin?${params.toString()}`;
}

function SummaryCard({
  label,
  value,
  help,
}: {
  label: string;
  value: string | number;
  help?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-bold tracking-wide text-emerald-200/90">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
      {help ? <p className="mt-2 text-xs text-white/50">{help}</p> : null}
    </div>
  );
}

function formatMoneyInput(amountInCents: number | null | undefined) {
  return String(Number(amountInCents ?? 0) / 100);
}

function PaymentProgress({
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
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3 text-xs text-white/60">
        <span>{progress}% pago</span>
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
      <div className="text-xs text-white/50">
        {remaining > 0 ? `Debe ${formatMoney(remaining, currency)}` : 'Pago completo'}
      </div>
    </div>
  );
}

function SectionShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-7">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-white/70">{subtitle}</p>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: {
    q?: string;
    level?: string;
    edition?: string;
    phase?: string;
    tab?: string;
    notice?: string;
    estado?: string;
    godsEdition?: string;
  };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!isAdminRole(session.user.role)) redirect('/dashboard');

  const q = (searchParams?.q ?? '').toString();
  const levelParam = (searchParams?.level ?? '2').toString();
  const maxDepth: number | null =
    levelParam === '1' ? 1 : levelParam === '2' ? 2 : levelParam === 'all' ? null : 2;
  const tabParam = (searchParams?.tab ?? 'overview').toString() as AdminTab;
  const validTabs: AdminTab[] = ['overview', 'finance', 'community', 'aula', 'news', 'gods', 'gifts', 'settings'];
  const activeTab: AdminTab = validTabs.includes(tabParam) ? tabParam : 'overview';
  const notice = (searchParams?.notice ?? '').toString().trim();

  const { users, editions, giftInvitations, weeklyTasks, newsPosts, gods } = await getAdminData();

  const selectedEdition =
    editions.find((edition) => edition.slug === searchParams?.edition) ??
    editions.find((edition) => edition.isCurrent) ??
    editions[0];
  const selectedPhase =
    selectedEdition?.phases.find((phase) => phase.slug === searchParams?.phase) ??
    selectedEdition?.phases[0] ??
    null;

  const usersForManagement = q.trim() ? users.filter((user) => matchesQuery(user, q)) : users;

  const byParent = new Map<string | null, TreeNode[]>();
  for (const user of users) {
    const node: TreeNode = {
      id: user.id,
      name: user.name,
      email: user.email,
      referralCode: user.referralCode ?? null,
      status: user.status,
      pointsBalance: user.pointsBalance,
      children: [],
    };

    const key = user.referredById ?? null;
    const bucket = byParent.get(key) ?? [];
    bucket.push(node);
    byParent.set(key, bucket);
  }

  const attachChildren = (node: TreeNode) => {
    const children = byParent.get(node.id) ?? [];
    node.children = children;
    node.children.forEach(attachChildren);
    return node;
  };

  const roots = (byParent.get(null) ?? []).map(attachChildren);
  const filteredRoots = q.trim()
    ? roots
        .map((root) => filterTree(root, q))
        .filter(Boolean) as TreeNode[]
    : roots;

  const enrollmentStatusFilter = (searchParams?.estado ?? 'cursando').toString().toLowerCase();
  const editionParticipants = selectedEdition?.enrollments ?? [];
  const phaseParticipantsAll = selectedPhase
    ? editionParticipants.filter((enrollment) => enrollment.phase?.id === selectedPhase.id)
    : [];
  const phaseParticipants =
    enrollmentStatusFilter === 'finalizados'
      ? phaseParticipantsAll.filter((entry) => String(entry.status).toUpperCase() === 'FINALIZADO')
      : enrollmentStatusFilter === 'cursando'
      ? phaseParticipantsAll.filter(
          (entry) => String(entry.status).toUpperCase() !== 'FINALIZADO'
            && String(entry.status).toUpperCase() !== 'CANCELADO'
        )
      : phaseParticipantsAll;
  const finalizedInPhaseCount = phaseParticipantsAll.filter(
    (entry) => String(entry.status).toUpperCase() === 'FINALIZADO'
  ).length;
  const cursandoInPhaseCount = phaseParticipantsAll.filter(
    (entry) =>
      String(entry.status).toUpperCase() !== 'FINALIZADO' &&
      String(entry.status).toUpperCase() !== 'CANCELADO'
  ).length;
  const totalDue = phaseParticipants.reduce((sum, enrollment) => sum + enrollment.amountDueCents, 0);
  const totalPaid = phaseParticipants.reduce(
    (sum, enrollment) => sum + sumConfirmedPayments(enrollment.payments),
    0
  );
  const totalPending = Math.max(totalDue - totalPaid, 0);
  const paidParticipants = phaseParticipants.filter(
    (enrollment) => sumConfirmedPayments(enrollment.payments) >= enrollment.amountDueCents && enrollment.amountDueCents > 0
  );
  const pendingParticipants = phaseParticipants.filter(
    (enrollment) => sumConfirmedPayments(enrollment.payments) < enrollment.amountDueCents
  );
  const collectionRate = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0;
  const totalConfirmedPayments = phaseParticipants.reduce(
    (count, enrollment) => count + enrollment.payments.filter((payment) => payment.status === 'CONFIRMADO').length,
    0
  );
  const editionSix = editions.find((edition) => edition.sequence === 6) ?? null;
  const editionSixGiftInvitations = giftInvitations.filter((invitation) => invitation.edition?.sequence === 6);

  const tabs: { id: AdminTab; label: string; help: string }[] = [
    { id: 'overview', label: 'Resumen', help: 'Vista ejecutiva por edicion y fase.' },
    { id: 'finance', label: 'Finanzas', help: 'Operacion diaria de asignaciones y pagos.' },
    { id: 'community', label: 'Comunidad', help: 'Arbol, estados y referencias.' },
    { id: 'aula', label: 'Aula', help: 'Tareas semanales por fase y material de estudio.' },
    { id: 'news', label: 'Noticias', help: 'Banners visibles para todos los usuarios.' },
    { id: 'gods', label: 'Dioses', help: 'Catalogo de dioses griegos y asignaciones.' },
    { id: 'gifts', label: 'CUPONES/REGALOS', help: 'Regalos de cupos para la 6ta edicion.' },
    { id: 'settings', label: 'Settings', help: 'Crear ediciones y fases.' },
  ];

  const phaseSequenceMap = new Map<number, string>();
  for (const edition of editions) {
    for (const phase of edition.phases) {
      if (!phaseSequenceMap.has(phase.sequence)) {
        const cleanTitle = String(phase.title).replace(/\s*-?\s*edicion\s*\d+/i, '').trim();
        phaseSequenceMap.set(phase.sequence, cleanTitle || `Fase ${phase.sequence}`);
      }
    }
  }
  const phaseSequenceOptions = Array.from(phaseSequenceMap.entries())
    .map(([sequence, label]) => ({ sequence, label: `Fase ${sequence} (${label})` }))
    .sort((left, right) => left.sequence - right.sequence);

  const editionsForModal = editions.map((edition) => ({
    id: edition.id,
    slug: edition.slug,
    title: edition.title,
    sequence: edition.sequence,
    phases: edition.phases.map((phase) => ({
      id: phase.id,
      slug: phase.slug,
      title: phase.title,
      sequence: phase.sequence,
      priceCents: phase.priceCents ?? 0,
    })),
  }));

  const userById = new Map(users.map((user) => [user.id, user]));
  const userIsSuperadmin = isSuperadminRole(session.user.role);
  const usersForModal = users.map((entry) => ({
    id: entry.id,
    name: entry.name,
    email: entry.email,
  }));

  function renderClickableTree(node: TreeNode, depth: number, maxDepth: number | null) {
    const atLimit = maxDepth !== null && depth >= maxDepth;
    const fullUser = userById.get(node.id);

    return (
      <div key={node.id} className="tree-row">
        {fullUser ? (
          <UserDetailModal
            user={fullUser}
            editions={editionsForModal}
            selectedEditionSlug={selectedEdition?.slug ?? null}
            selectedPhaseSlug={selectedPhase?.slug ?? null}
            allUsers={usersForModal}
            isSuperadmin={userIsSuperadmin}
          >
            <NodeCardInner node={node} />
          </UserDetailModal>
        ) : (
          <NodeCardInner node={node} />
        )}
        {!atLimit && node.children.length ? (
          <div className="mt-3 pl-4">
            <div className="tree">
              {node.children.map((child) => renderClickableTree(child, depth + 1, maxDepth))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <main className="min-h-screen text-white">
      {notice ? <ActionNotice message={notice} /> : null}
      <div className="mx-auto w-full max-w-7xl px-5 py-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Control Interno</h1>
            <p className="mt-2 text-sm text-white/70">
              Panel financiero y operativo para seguir ediciones, fases, cobros y comunidad.
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-white/70">
              {selectedEdition?.title ?? 'Sin edicion'}
              {selectedPhase ? ` / ${selectedPhase.title}` : ''}
            </span>
            <Link className="text-white/70 hover:text-white hover:underline" href="/dashboard">
              Volver al panel
            </Link>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="grid gap-3 lg:grid-cols-[1.2fr,1fr] lg:items-end">
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <Link
                  key={tab.id}
                  href={buildAdminHref({
                    edition: selectedEdition?.slug,
                    phase: selectedPhase?.slug,
                    q,
                    level: levelParam,
                    tab: tab.id,
                  })}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    activeTab === tab.id
                      ? 'border-emerald-400/60 bg-emerald-400/15 text-white'
                      : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {tab.label}
                </Link>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-xs text-white/60">Edicion activa</span>
                <div className="flex flex-wrap gap-2">
                  {editions.map((edition) => (
                    <Link
                      key={edition.id}
                      href={buildAdminHref({
                        edition: edition.slug,
                        phase: edition.phases[0]?.slug,
                        q,
                        level: levelParam,
                        tab: activeTab,
                      })}
                      className={`rounded-full border px-4 py-2 text-sm transition ${
                        selectedEdition?.id === edition.id
                          ? 'border-emerald-400/60 bg-emerald-400/15 text-white'
                          : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      {edition.title}
                    </Link>
                  ))}
                </div>
              </label>

              <label className="grid gap-1">
                <span className="text-xs text-white/60">Fase activa</span>
                <div className="flex flex-wrap gap-2">
                  {selectedEdition?.phases.length ? (
                    selectedEdition.phases.map((phase) => (
                      <Link
                        key={phase.id}
                        href={buildAdminHref({
                          edition: selectedEdition.slug,
                          phase: phase.slug,
                          q,
                          level: levelParam,
                          tab: activeTab,
                        })}
                        className={`rounded-full border px-4 py-2 text-sm transition ${
                          selectedPhase?.id === phase.id
                            ? 'border-emerald-400/60 bg-emerald-400/15 text-white'
                            : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                        }`}
                      >
                        {phase.title}
                      </Link>
                    ))
                  ) : (
                    <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm text-amber-100">
                      Sin fases cargadas
                    </span>
                  )}
                </div>
              </label>
            </div>
          </div>
        </div>

        {activeTab === 'overview' ? (
          <div className="mt-8 grid gap-8">
            <SectionShell
              title="Resumen financiero"
              subtitle="Vista rapida del estado de cobros para la edicion y fase seleccionadas."
            >
              <div className="grid gap-3 md:grid-cols-5">
                <SummaryCard
                  label="Edicion"
                  value={selectedEdition?.title ?? 'Sin edicion'}
                  help={selectedEdition?.notes ?? 'Elige una edicion arriba.'}
                />
                <SummaryCard
                  label="Fase"
                  value={selectedPhase?.title ?? 'Sin fase'}
                  help={selectedPhase?.notes ?? 'Crea o selecciona una fase.'}
                />
                <SummaryCard label="Participantes" value={phaseParticipants.length} />
                <SummaryCard label="Cobrado" value={formatMoney(totalPaid)} />
                <SummaryCard label="Pendiente" value={formatMoney(totalPending)} />
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white/90">Indicadores de caja</p>
                      <p className="mt-1 text-xs text-white/50">Lectura rapida para seguimiento interno.</p>
                    </div>
                    <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                      {collectionRate}% cobrado
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs text-white/50">Total cobrado</p>
                      <p className="mt-2 text-lg font-semibold text-white">{formatMoney(totalPaid)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs text-white/50">Pagos confirmados</p>
                      <p className="mt-2 text-lg font-semibold text-white">{totalConfirmedPayments}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs text-white/50">Con deuda</p>
                      <p className="mt-2 text-lg font-semibold text-white">{pendingParticipants.length}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <p className="text-sm font-semibold text-white/90">Alertas utiles</p>
                  <div className="mt-4 grid gap-3 text-sm">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/80">
                      {selectedPhase
                        ? `${selectedPhase.title} tiene ${pendingParticipants.length} participante(s) con saldo pendiente.`
                        : 'Selecciona una fase para ver deuda concreta.'}
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/80">
                      {paidParticipants.length
                        ? `${paidParticipants.length} participante(s) ya cubrieron el total pactado.`
                        : 'Todavia no hay participantes completamente pagos en esta fase.'}
                    </div>
                  </div>
                </div>
              </div>
            </SectionShell>

            <div className="grid gap-8 xl:grid-cols-[1fr,1fr]">
              <SectionShell
                title="Quienes pagaron"
                subtitle="Participantes con el monto total cubierto en la fase seleccionada."
              >
                {paidParticipants.length ? (
                  <div className="grid gap-3">
                    {paidParticipants.map((enrollment) => (
                      <div key={enrollment.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white/90">
                              {enrollment.user.name ?? 'Sin nombre'}
                            </p>
                            <p className="mt-1 text-xs text-white/50">{enrollment.user.email ?? '-'}</p>
                          </div>
                          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                            Al dia
                          </span>
                        </div>
                        <div className="mt-3">
                          <PaymentProgress
                            paid={sumConfirmedPayments(enrollment.payments)}
                            due={enrollment.amountDueCents}
                            currency={enrollment.currency}
                          />
                        </div>
                        <p className="mt-3 text-sm text-white/70">
                          Total: {formatMoney(enrollment.amountDueCents, enrollment.currency)} - Cobrado:{' '}
                          {formatMoney(sumConfirmedPayments(enrollment.payments), enrollment.currency)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-white/70">Todavia no hay participantes completamente pagos.</p>
                )}
              </SectionShell>

              <SectionShell
                title="Quienes faltan"
                subtitle="Participantes con saldo pendiente para seguimiento financiero."
              >
                {pendingParticipants.length ? (
                  <div className="grid gap-3">
                    {pendingParticipants.map((enrollment) => {
                      const paid = sumConfirmedPayments(enrollment.payments);
                      const pending = Math.max(enrollment.amountDueCents - paid, 0);
                      return (
                        <div key={enrollment.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white/90">
                                {enrollment.user.name ?? 'Sin nombre'}
                              </p>
                              <p className="mt-1 text-xs text-white/50">{enrollment.user.email ?? '-'}</p>
                            </div>
                            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-100">
                              Debe {formatMoney(pending, enrollment.currency)}
                            </span>
                          </div>
                          <div className="mt-3">
                            <PaymentProgress
                              paid={paid}
                              due={enrollment.amountDueCents}
                              currency={enrollment.currency}
                            />
                          </div>
                          <p className="mt-3 text-sm text-white/70">
                            Total: {formatMoney(enrollment.amountDueCents, enrollment.currency)} - Cobrado:{' '}
                            {formatMoney(paid, enrollment.currency)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-white/70">No hay saldos pendientes en esta fase.</p>
                )}
              </SectionShell>
            </div>
          </div>
        ) : null}

        {activeTab === 'finance' ? (
          <div className="mt-8 grid gap-8">
            <SectionShell
              title="Asignacion por fase"
              subtitle="Carga participantes en una fase especifica y registra el monto acordado."
            >
              <form action={upsertEnrollment} className="grid gap-3 lg:grid-cols-5">
                <input type="hidden" name="editionId" value={selectedEdition?.id ?? ''} />
                <input type="hidden" name="phaseId" value={selectedPhase?.id ?? ''} />
                <input type="hidden" name="returnTab" value="finance" />

                <label className="grid gap-1 lg:col-span-2">
                  <span className="text-xs text-white/60">Participante</span>
                  <select
                    name="userId"
                    required
                    className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Seleccionar participante
                    </option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {(user.name ?? 'Sin nombre') + (user.email ? ` - ${user.email}` : '')}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs text-white/60">Fase activa</span>
                  <div className="flex h-11 items-center rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90">
                    {selectedPhase ? selectedPhase.title : 'Selecciona una fase arriba'}
                  </div>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs text-white/60">Monto total</span>
                  <input
                    name="amountDue"
                    defaultValue={formatMoneyInput(selectedPhase?.priceCents ?? 0)}
                    className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                    placeholder="150000"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs text-white/60">Estado</span>
                  <select
                    name="status"
                    defaultValue="PENDIENTE"
                    className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                  >
                    <option value="PENDIENTE">Pendiente</option>
                    <option value="RESERVADO">Reservado</option>
                    <option value="CONFIRMADO">Confirmado</option>
                    <option value="CURSANDO">Cursando</option>
                    <option value="FINALIZADO">Finalizado</option>
                    <option value="CANCELADO">Cancelado</option>
                  </select>
                </label>

                <label className="grid gap-1 lg:col-span-4">
                  <span className="text-xs text-white/60">Notas</span>
                  <input
                    name="notes"
                    className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                    placeholder="Senia, observaciones, modalidad..."
                  />
                </label>

                <input type="hidden" name="currency" value="ARS" />

                <div className="flex items-end">
                  <FormSubmitButton
                    className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
                    pendingLabel="Guardando ficha..."
                  >
                    Guardar ficha
                  </FormSubmitButton>
                </div>
              </form>
              {selectedPhase ? (
                <p className="mt-3 text-xs text-white/55">
                  Esta ficha se guarda en <span className="font-semibold text-white/80">{selectedPhase.title}</span>.
                  Precio sugerido:{' '}
                  <span className="font-semibold text-white/80">
                    {formatMoney(selectedPhase.priceCents ?? 0)}
                  </span>
                  .
                </p>
              ) : null}
            </SectionShell>

            <SectionShell
              title="Participantes de la fase"
              subtitle="Click en un participante para abrir su ficha completa: pagos, edicion, deuda, notas y acciones."
            >
              <div className="mb-4 flex flex-wrap gap-2">
                {([
                  { id: 'cursando', label: `Cursando (${cursandoInPhaseCount})` },
                  { id: 'finalizados', label: `Finalizados (${finalizedInPhaseCount})` },
                  { id: 'todos', label: `Todos (${phaseParticipantsAll.length})` },
                ] as const).map((option) => {
                  const isActive = enrollmentStatusFilter === option.id;
                  return (
                    <Link
                      key={option.id}
                      href={buildAdminHref({
                        edition: selectedEdition?.slug,
                        phase: selectedPhase?.slug,
                        q,
                        level: levelParam,
                        tab: 'finance',
                        enrollmentStatus: option.id,
                      })}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        isActive
                          ? 'border-emerald-400/60 bg-emerald-400/15 text-white'
                          : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      {option.label}
                    </Link>
                  );
                })}
              </div>

              {phaseParticipants.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {phaseParticipants.map((enrollment) => {
                    const paid = sumConfirmedPayments(enrollment.payments);
                    const pending = Math.max(enrollment.amountDueCents - paid, 0);
                    const progress =
                      enrollment.amountDueCents > 0
                        ? Math.min(Math.round((paid / enrollment.amountDueCents) * 100), 100)
                        : 0;
                    const fullUser = userById.get(enrollment.userId);
                    if (!fullUser) return null;
                    const statusUpper = String(enrollment.status).toUpperCase();
                    const isFinalized = statusUpper === 'FINALIZADO';

                    return (
                      <div
                        key={enrollment.id}
                        className={`flex flex-col justify-between gap-3 rounded-2xl border p-4 ${
                          isFinalized
                            ? 'border-emerald-300/30 bg-emerald-400/5'
                            : 'border-white/10 bg-black/25'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white/90">
                                {enrollment.user.name ?? 'Sin nombre'}
                              </p>
                              <p className="mt-1 text-xs text-white/55">{enrollment.user.email ?? '-'}</p>
                            </div>
                            <span
                              className={`rounded-full border px-2 py-1 text-[10px] font-semibold tracking-wide ${
                                progress >= 100
                                  ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100'
                                  : progress >= 60
                                  ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-100'
                                  : 'border-amber-300/40 bg-amber-300/10 text-amber-100'
                              }`}
                            >
                              {progress}%
                            </span>
                          </div>
                          <p className="mt-3 text-xs text-white/60">
                            Total {formatMoney(enrollment.amountDueCents, enrollment.currency)} - Debe{' '}
                            <span className="font-semibold text-white/80">
                              {formatMoney(pending, enrollment.currency)}
                            </span>
                          </p>
                          <p
                            className={`mt-1 text-[11px] uppercase tracking-wider ${
                              isFinalized ? 'font-semibold text-emerald-200' : 'text-white/40'
                            }`}
                          >
                            {enrollmentStatusLabel(enrollment.status)}
                          </p>
                          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
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
                        </div>
                        <UserDetailModal
                          user={fullUser}
                          editions={editionsForModal}
                          selectedEditionSlug={selectedEdition?.slug ?? null}
                          selectedPhaseSlug={selectedPhase?.slug ?? null}
                          buttonLabel="Abrir ficha"
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-white/70">
                  {selectedPhase
                    ? 'Esta fase todavia no tiene participantes cargados.'
                    : 'Crea una fase para empezar a cargar participantes.'}
                </p>
              )}
            </SectionShell>
          </div>
        ) : null}

        {activeTab === 'community' ? (
          <div className="mt-8 grid gap-8">
            <SectionShell
              title="Comunidad y busqueda"
              subtitle="Arbol de invitaciones, filtros y lectura de la red."
            >
              <form method="get" className="grid gap-3 sm:grid-cols-[1fr,180px,auto] sm:items-end">
                {selectedEdition ? <input type="hidden" name="edition" value={selectedEdition.slug} /> : null}
                {selectedPhase ? <input type="hidden" name="phase" value={selectedPhase.slug} /> : null}
                <input type="hidden" name="tab" value="community" />

                <label className="grid gap-1">
                  <span className="text-xs font-semibold tracking-wide text-white/70">Busqueda</span>
                  <input
                    name="q"
                    defaultValue={q}
                    placeholder="Nombre, email o codigo"
                    className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none focus:border-emerald-400/50"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-semibold tracking-wide text-white/70">Nivel</span>
                  <select
                    name="level"
                    defaultValue={levelParam}
                    className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none focus:border-emerald-400/50"
                  >
                    <option value="1">Nivel 1</option>
                    <option value="2">Nivel 2</option>
                    <option value="all">Completo</option>
                  </select>
                </label>

                <button
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
                  type="submit"
                >
                  Aplicar
                </button>
              </form>

              <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    Raices: <span className="font-semibold text-white/80">{filteredRoots.length}</span>
                  </span>
                  {q.trim() ? (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      Filtro: <span className="font-semibold text-white/80">{q.trim()}</span>
                    </span>
                  ) : null}
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    Profundidad: <span className="font-semibold text-white/80">{maxDepth ?? 'Completa'}</span>
                  </span>
                </div>

                {filteredRoots.length ? (
                  <div className="mt-6">
                    <div className="tree">
                      {filteredRoots.map((root) =>
                        renderClickableTree(root, 0, maxDepth)
                      )}
                    </div>
                    <p className="mt-4 text-xs text-white/45">
                      Click en cualquier participante para abrir su ficha: estado del proceso, referente, fichas por fase, pagos y logros.
                    </p>
                  </div>
                ) : (
                  <p className="mt-6 text-sm text-white/70">Sin usuarios cargados todavia.</p>
                )}
              </div>
            </SectionShell>
          </div>
        ) : null}

        {activeTab === 'aula' ? (
          <div className="mt-8 grid gap-8">
            <SectionShell
              title="Tarea general por fase"
              subtitle="La misma tarea para todos los participantes que cursen esa fase, en cualquier edicion. Tipica para Fase 1."
            >
              <form action={createWeeklyTask} className="grid gap-3 rounded-2xl border border-white/10 bg-black/25 p-5 md:grid-cols-2">
                <input type="hidden" name="scope" value="GENERAL" />
                <p className="text-sm font-semibold text-white/85 md:col-span-2">Nueva tarea general</p>

                <label className="grid gap-1">
                  <span className="text-xs text-white/60">Fase (numero)</span>
                  <select
                    name="phaseSequence"
                    required
                    className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Elegir fase
                    </option>
                    {phaseSequenceOptions.map((option) => (
                      <option key={option.sequence} value={option.sequence}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs text-white/60">Semana</span>
                  <input
                    name="weekNumber"
                    type="number"
                    min="1"
                    defaultValue="1"
                    className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                  />
                </label>

                <label className="grid gap-1 md:col-span-2">
                  <span className="text-xs text-white/60">Titulo</span>
                  <input
                    name="title"
                    required
                    className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                    placeholder="Lectura semana 1 - Introduccion"
                  />
                </label>

                <label className="grid gap-1 md:col-span-2">
                  <span className="text-xs text-white/60">Resumen corto</span>
                  <input
                    name="summary"
                    className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                    placeholder="Que tiene que hacer el participante esta semana"
                  />
                </label>

                <label className="grid gap-1 md:col-span-2">
                  <span className="text-xs text-white/60">Descripcion (opcional)</span>
                  <textarea
                    name="body"
                    rows={3}
                    className="rounded-xl border border-white/10 bg-slate-950/70 p-3 text-sm text-white/90 outline-none"
                  />
                </label>

                <label className="grid gap-1 md:col-span-2">
                  <span className="text-xs text-white/60">Link al recurso (PDF, video, articulo)</span>
                  <input
                    name="resourceUrl"
                    className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                    placeholder="https://..."
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs text-white/60">Fecha limite (opcional)</span>
                  <input
                    name="dueAt"
                    type="date"
                    className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                  />
                </label>

                <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
                  <input name="isPublished" type="checkbox" defaultChecked className="accent-emerald-400" />
                  Publicar inmediatamente
                </label>

                <div className="md:col-span-2">
                  <FormSubmitButton
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
                    pendingLabel="Guardando..."
                  >
                    Crear tarea general
                  </FormSubmitButton>
                </div>
              </form>
            </SectionShell>

            <SectionShell
              title="Tareas personales por participante"
              subtitle="Solo aparecen quienes estan en Fase 2 o 3 y los egresados. Click en una card para ver / cargar tareas semanales (8 consignas tipicas hasta egresar)."
            >
              {(() => {
                const isEligibleInEdition = (
                  userId: string,
                  editionId: string
                ): { eligible: boolean; phaseSeq: number | null; statusUpper: string } => {
                  const u = users.find((x) => x.id === userId);
                  if (!u) return { eligible: false, phaseSeq: null, statusUpper: '' };
                  for (const entry of u.enrollments) {
                    if (entry.editionId !== editionId) continue;
                    const seq = entry.phase?.sequence ?? 0;
                    if (seq < 2) continue;
                    const statusUpper = String(entry.status).toUpperCase();
                    if (statusUpper === 'CURSANDO' || statusUpper === 'FINALIZADO') {
                      return { eligible: true, phaseSeq: seq, statusUpper };
                    }
                  }
                  return { eligible: false, phaseSeq: null, statusUpper: '' };
                };

                const editionGroups = editions
                  .map((edition) => {
                    const eligible = users
                      .filter((u) => String(u.status).toUpperCase() !== 'EGRESADO')
                      .map((u) => ({ u, info: isEligibleInEdition(u.id, edition.id) }))
                      .filter((row) => row.info.eligible);
                    return { edition, members: eligible };
                  })
                  .filter((group) => group.members.length > 0);

                const egresados = users.filter(
                  (u) => String(u.status).toUpperCase() === 'EGRESADO'
                );

                const hasAny = editionGroups.length > 0 || egresados.length > 0;

                if (!hasAny) {
                  return (
                    <p className="text-sm text-white/55">
                      Todavia no hay participantes en Fase 2, Fase 3 o egresados. Cuando alguien avance a Fase 2 va a aparecer aca.
                    </p>
                  );
                }

                return (
                  <div className="grid gap-8">
                    {editionGroups.map(({ edition, members }) => (
                      <div key={edition.id}>
                        <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-200/90">
                          {edition.title}
                        </p>
                        <p className="mt-1 text-[11px] text-white/45">
                          {members.length} participante(s)
                        </p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {members.map(({ u, info }) => {
                            const userTasks = weeklyTasks.filter(
                              (task) => task.assignedUserId === u.id
                            );
                            const stageLabel = info.phaseSeq
                              ? info.statusUpper === 'FINALIZADO'
                                ? `Fase ${info.phaseSeq} completada`
                                : `Cursando Fase ${info.phaseSeq}`
                              : undefined;
                            return (
                              <PersonalTasksModal
                                key={u.id}
                                user={u}
                                userTasks={userTasks}
                                badge={stageLabel}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {egresados.length ? (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-200/90">
                          Egresados/as
                        </p>
                        <p className="mt-1 text-[11px] text-white/45">
                          {egresados.length} participante(s)
                        </p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {egresados.map((u) => {
                            const userTasks = weeklyTasks.filter(
                              (task) => task.assignedUserId === u.id
                            );
                            return (
                              <PersonalTasksModal
                                key={u.id}
                                user={u}
                                userTasks={userTasks}
                                badge="Egresado/a"
                              />
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })()}
              {false && (
                <div className="grid gap-3">
                {users.map((u) => {
                  const userTasks = weeklyTasks
                    .filter((task) => task.assignedUserId === u.id)
                    .sort((left, right) => left.weekNumber - right.weekNumber);
                  const nextWeek =
                    userTasks.length > 0
                      ? Math.max(...userTasks.map((task) => task.weekNumber)) + 1
                      : 1;

                  return (
                    <details
                      key={u.id}
                      className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4 open:border-amber-300/40"
                    >
                      <summary className="cursor-pointer">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white/90">
                              {u.name ?? 'Sin nombre'}
                            </p>
                            <p className="truncate text-xs text-white/55">{u.email ?? '-'}</p>
                            {u.godAssignment?.god ? (
                              <p className="mt-1 text-[11px] text-amber-100/80">
                                Dios: {u.godAssignment.god.name}
                              </p>
                            ) : null}
                          </div>
                          <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-100">
                            {userTasks.length} tarea(s)
                          </span>
                        </div>
                      </summary>

                      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr,1fr]">
                        <div className="grid gap-2">
                          <p className="text-xs font-semibold text-amber-100/90">Historial</p>
                          {userTasks.length ? (
                            userTasks.map((task) => (
                              <details
                                key={task.id}
                                className="rounded-xl border border-white/10 bg-slate-950/40 p-3 open:border-amber-300/30"
                              >
                                <summary className="cursor-pointer">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-semibold text-white/90">
                                        Semana {task.weekNumber} - {task.title}
                                      </p>
                                      <p className="mt-1 text-[11px] text-white/55">
                                        {task.isPublished ? 'Publicada' : 'Borrador'}
                                        {task.dueAt
                                          ? ` - Hasta ${new Date(task.dueAt).toLocaleDateString()}`
                                          : ''}
                                      </p>
                                    </div>
                                    {task.resourceUrl ? (
                                      <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">
                                        PDF
                                      </span>
                                    ) : null}
                                  </div>
                                </summary>

                                <form
                                  action={updateWeeklyTaskAction}
                                  className="mt-3 grid gap-2 md:grid-cols-2"
                                >
                                  <input type="hidden" name="taskId" value={task.id} />
                                  <input type="hidden" name="assignedUserId" value={u.id} />
                                  <label className="grid gap-1 md:col-span-2">
                                    <span className="text-[10px] text-white/55">Titulo</span>
                                    <input
                                      name="title"
                                      defaultValue={task.title}
                                      className="h-9 rounded-lg border border-white/10 bg-slate-950/70 px-3 text-xs text-white/90 outline-none"
                                    />
                                  </label>
                                  <label className="grid gap-1">
                                    <span className="text-[10px] text-white/55">Semana</span>
                                    <input
                                      name="weekNumber"
                                      type="number"
                                      min="1"
                                      defaultValue={String(task.weekNumber)}
                                      className="h-9 rounded-lg border border-white/10 bg-slate-950/70 px-3 text-xs text-white/90 outline-none"
                                    />
                                  </label>
                                  <label className="grid gap-1">
                                    <span className="text-[10px] text-white/55">Fecha limite</span>
                                    <input
                                      name="dueAt"
                                      type="date"
                                      defaultValue={
                                        task.dueAt
                                          ? new Date(task.dueAt).toISOString().slice(0, 10)
                                          : ''
                                      }
                                      className="h-9 rounded-lg border border-white/10 bg-slate-950/70 px-3 text-xs text-white/90 outline-none"
                                    />
                                  </label>
                                  <label className="grid gap-1 md:col-span-2">
                                    <span className="text-[10px] text-white/55">
                                      PDF / link recurso
                                    </span>
                                    <input
                                      name="resourceUrl"
                                      defaultValue={task.resourceUrl ?? ''}
                                      className="h-9 rounded-lg border border-white/10 bg-slate-950/70 px-3 text-xs text-white/90 outline-none"
                                      placeholder="https://..."
                                    />
                                  </label>
                                  <label className="grid gap-1 md:col-span-2">
                                    <span className="text-[10px] text-white/55">Resumen</span>
                                    <input
                                      name="summary"
                                      defaultValue={task.summary ?? ''}
                                      className="h-9 rounded-lg border border-white/10 bg-slate-950/70 px-3 text-xs text-white/90 outline-none"
                                    />
                                  </label>
                                  <label className="grid gap-1 md:col-span-2">
                                    <span className="text-[10px] text-white/55">Cuerpo</span>
                                    <textarea
                                      name="body"
                                      rows={2}
                                      defaultValue={task.body ?? ''}
                                      className="rounded-lg border border-white/10 bg-slate-950/70 p-2 text-xs text-white/90 outline-none"
                                    />
                                  </label>
                                  <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] text-white/70 md:col-span-2">
                                    <input
                                      name="isPublished"
                                      type="checkbox"
                                      defaultChecked={task.isPublished}
                                      className="accent-emerald-400"
                                    />
                                    Publicada
                                  </label>
                                  <div className="flex flex-wrap gap-2 md:col-span-2">
                                    <FormSubmitButton
                                      className="inline-flex h-9 items-center justify-center rounded-lg bg-emerald-500 px-3 text-xs font-semibold text-black transition hover:bg-emerald-400"
                                      pendingLabel="Guardando..."
                                    >
                                      Guardar
                                    </FormSubmitButton>
                                  </div>
                                </form>

                                <form action={deleteWeeklyTaskAction} className="mt-2">
                                  <input type="hidden" name="taskId" value={task.id} />
                                  <FormSubmitButton
                                    className="inline-flex h-8 items-center justify-center rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 text-[11px] font-semibold text-rose-100 transition hover:bg-rose-400/20"
                                    pendingLabel="Borrando..."
                                    confirmMessage="Eliminar esta tarea?"
                                  >
                                    Eliminar
                                  </FormSubmitButton>
                                </form>
                              </details>
                            ))
                          ) : (
                            <p className="text-xs text-white/55">Sin tareas todavia.</p>
                          )}
                        </div>

                        <form
                          action={createWeeklyTask}
                          className="grid gap-2 rounded-xl border border-amber-300/30 bg-slate-950/40 p-3"
                        >
                          <input type="hidden" name="scope" value="PERSONAL" />
                          <input type="hidden" name="assignedUserId" value={u.id} />
                          <input type="hidden" name="isPublished" value="on" />
                          <p className="text-xs font-semibold text-amber-100/90">
                            Agregar tarea semanal
                          </p>
                          <div className="grid gap-2 sm:grid-cols-[80px,1fr]">
                            <label className="grid gap-1">
                              <span className="text-[10px] text-white/55">Semana</span>
                              <input
                                name="weekNumber"
                                type="number"
                                min="1"
                                defaultValue={String(nextWeek)}
                                className="h-9 rounded-lg border border-white/10 bg-slate-950/70 px-3 text-xs text-white/90 outline-none"
                              />
                            </label>
                            <label className="grid gap-1">
                              <span className="text-[10px] text-white/55">Fecha limite (opcional)</span>
                              <input
                                name="dueAt"
                                type="date"
                                className="h-9 rounded-lg border border-white/10 bg-slate-950/70 px-3 text-xs text-white/90 outline-none"
                              />
                            </label>
                          </div>
                          <label className="grid gap-1">
                            <span className="text-[10px] text-white/55">Titulo</span>
                            <input
                              name="title"
                              required
                              className="h-9 rounded-lg border border-white/10 bg-slate-950/70 px-3 text-xs text-white/90 outline-none"
                              placeholder="Consigna de la semana"
                            />
                          </label>
                          <label className="grid gap-1">
                            <span className="text-[10px] text-white/55">PDF / link recurso</span>
                            <input
                              name="resourceUrl"
                              className="h-9 rounded-lg border border-white/10 bg-slate-950/70 px-3 text-xs text-white/90 outline-none"
                              placeholder="https://..."
                            />
                          </label>
                          <label className="grid gap-1">
                            <span className="text-[10px] text-white/55">Resumen (opcional)</span>
                            <input
                              name="summary"
                              className="h-9 rounded-lg border border-white/10 bg-slate-950/70 px-3 text-xs text-white/90 outline-none"
                            />
                          </label>
                          <FormSubmitButton
                            className="inline-flex h-9 items-center justify-center rounded-lg bg-amber-300 px-3 text-xs font-semibold text-black transition hover:bg-amber-200"
                            pendingLabel="Guardando..."
                          >
                            Agregar tarea
                          </FormSubmitButton>
                        </form>
                      </div>
                    </details>
                  );
                })}
              </div>
              )}
            </SectionShell>

            <SectionShell
              title="Tareas generales cargadas"
              subtitle="Solo tareas globales por fase. Las personales se gestionan en la seccion de cada participante."
            >
              <div className="grid gap-3">
                {(() => {
                  const generalTasks = weeklyTasks.filter((task) => !task.assignedUserId);
                  return generalTasks.length ? (
                  generalTasks.map((task) => {
                    const isPersonal = false;
                    const targetUser = null;
                    return (
                      <details
                        key={task.id}
                        className={`rounded-2xl border p-4 open:border-emerald-400/30 ${
                          isPersonal
                            ? 'border-amber-300/25 bg-amber-300/5'
                            : 'border-emerald-300/20 bg-emerald-400/5'
                        }`}
                      >
                        <summary className="cursor-pointer">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-white/90">
                                Semana {task.weekNumber} - {task.title}
                              </p>
                              <p className="mt-1 text-xs text-white/55">
                                {isPersonal
                                  ? `Personal: ${targetUser?.name ?? targetUser?.email ?? 'Usuario'}`
                                  : `General - Fase ${task.phaseSequence ?? '?'}`}
                                {task.isPublished ? ' - Publicada' : ' - Borrador'}
                              </p>
                            </div>
                            {task.dueAt ? (
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                                Hasta {new Date(task.dueAt).toLocaleDateString()}
                              </span>
                            ) : null}
                          </div>
                        </summary>
                        <form action={updateWeeklyTaskAction} className="mt-3 grid gap-3 md:grid-cols-2">
                          <input type="hidden" name="taskId" value={task.id} />
                          <label className="grid gap-1 md:col-span-2">
                            <span className="text-xs text-white/55">Titulo</span>
                            <input
                              name="title"
                              defaultValue={task.title}
                              className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                            />
                          </label>
                          <label className="grid gap-1">
                            <span className="text-xs text-white/55">Semana</span>
                            <input
                              name="weekNumber"
                              type="number"
                              min="1"
                              defaultValue={String(task.weekNumber)}
                              className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                            />
                          </label>
                          <label className="grid gap-1">
                            <span className="text-xs text-white/55">Fecha limite</span>
                            <input
                              name="dueAt"
                              type="date"
                              defaultValue={task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 10) : ''}
                              className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                            />
                          </label>
                          {isPersonal ? (
                            <label className="grid gap-1 md:col-span-2">
                              <span className="text-xs text-white/55">Participante</span>
                              <select
                                name="assignedUserId"
                                defaultValue={task.assignedUserId ?? ''}
                                className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                              >
                                {users.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {(u.name ?? 'Sin nombre') + (u.email ? ` - ${u.email}` : '')}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ) : (
                            <label className="grid gap-1 md:col-span-2">
                              <span className="text-xs text-white/55">Fase</span>
                              <select
                                name="phaseSequence"
                                defaultValue={String(task.phaseSequence ?? '')}
                                className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                              >
                                {phaseSequenceOptions.map((option) => (
                                  <option key={option.sequence} value={option.sequence}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                          <label className="grid gap-1 md:col-span-2">
                            <span className="text-xs text-white/55">Resumen</span>
                            <input
                              name="summary"
                              defaultValue={task.summary ?? ''}
                              className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                            />
                          </label>
                          <label className="grid gap-1 md:col-span-2">
                            <span className="text-xs text-white/55">Cuerpo</span>
                            <textarea
                              name="body"
                              rows={3}
                              defaultValue={task.body ?? ''}
                              className="rounded-xl border border-white/10 bg-slate-950/70 p-3 text-sm text-white/90 outline-none"
                            />
                          </label>
                          <label className="grid gap-1 md:col-span-2">
                            <span className="text-xs text-white/55">Link recurso</span>
                            <input
                              name="resourceUrl"
                              defaultValue={task.resourceUrl ?? ''}
                              className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                            />
                          </label>
                          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 md:col-span-2">
                            <input
                              name="isPublished"
                              type="checkbox"
                              defaultChecked={task.isPublished}
                              className="accent-emerald-400"
                            />
                            Publicada
                          </label>
                          <div className="flex flex-wrap gap-2 md:col-span-2">
                            <FormSubmitButton
                              className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
                              pendingLabel="Guardando..."
                            >
                              Guardar cambios
                            </FormSubmitButton>
                          </div>
                        </form>
                        <form action={deleteWeeklyTaskAction} className="mt-3">
                          <input type="hidden" name="taskId" value={task.id} />
                          <FormSubmitButton
                            className="inline-flex h-9 items-center justify-center rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 text-xs font-semibold text-rose-100 transition hover:bg-rose-400/20"
                            pendingLabel="Borrando..."
                            confirmMessage="Eliminar esta tarea?"
                          >
                            Eliminar tarea
                          </FormSubmitButton>
                        </form>
                      </details>
                    );
                  })
                ) : (
                  <p className="text-sm text-white/65">No hay tareas generales todavia.</p>
                );
                })()}
              </div>
            </SectionShell>
          </div>
        ) : null}

        {activeTab === 'news' ? (
          <div className="mt-8 grid gap-8">
            <SectionShell
              title="Banner de noticias"
              subtitle="Las noticias activas se muestran arriba del dashboard a todos los participantes. Sirve para avisos, recordatorios y novedades del taller."
            >
              <form action={createNewsPost} className="grid gap-3 rounded-2xl border border-white/10 bg-black/25 p-5 md:grid-cols-2">
                <p className="text-sm font-semibold text-white/85 md:col-span-2">Nueva noticia</p>

                <label className="grid gap-1 md:col-span-2">
                  <span className="text-xs text-white/60">Titulo</span>
                  <input
                    name="title"
                    required
                    className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                    placeholder="Cambio de horario - clase del jueves"
                  />
                </label>

                <label className="grid gap-1 md:col-span-2">
                  <span className="text-xs text-white/60">Cuerpo</span>
                  <textarea
                    name="body"
                    rows={3}
                    className="rounded-xl border border-white/10 bg-slate-950/70 p-3 text-sm text-white/90 outline-none"
                    placeholder="Explicacion breve para los participantes"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs text-white/60">Imagen (URL)</span>
                  <input
                    name="imageUrl"
                    className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                    placeholder="https://..."
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs text-white/60">Texto del boton (opcional)</span>
                  <input
                    name="ctaLabel"
                    className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                    placeholder="Leer mas"
                  />
                </label>

                <label className="grid gap-1 md:col-span-2">
                  <span className="text-xs text-white/60">Link del boton (opcional)</span>
                  <input
                    name="ctaUrl"
                    className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                    placeholder="https://..."
                  />
                </label>

                <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
                  <input name="isPublished" type="checkbox" defaultChecked className="accent-emerald-400" />
                  Publicada
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
                  <input name="isPinned" type="checkbox" className="accent-emerald-400" />
                  Fijada al tope
                </label>

                <div className="md:col-span-2">
                  <FormSubmitButton
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
                    pendingLabel="Publicando..."
                  >
                    Publicar noticia
                  </FormSubmitButton>
                </div>
              </form>

              <div className="mt-6 grid gap-3">
                {newsPosts.length ? (
                  newsPosts.map((post) => (
                    <details
                      key={post.id}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4 open:border-emerald-400/30"
                    >
                      <summary className="cursor-pointer">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-white/90">{post.title}</p>
                            <p className="mt-1 text-xs text-white/55">
                              {post.isPublished ? 'Publicada' : 'Borrador'}
                              {post.isPinned ? ' - Fijada' : ''}
                            </p>
                          </div>
                          <span className="text-xs text-white/55">
                            {new Date(post.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </summary>

                      <form action={updateNewsPostAction} className="mt-3 grid gap-3 md:grid-cols-2">
                        <input type="hidden" name="newsId" value={post.id} />
                        <label className="grid gap-1 md:col-span-2">
                          <span className="text-xs text-white/55">Titulo</span>
                          <input
                            name="title"
                            defaultValue={post.title}
                            className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                          />
                        </label>
                        <label className="grid gap-1 md:col-span-2">
                          <span className="text-xs text-white/55">Cuerpo</span>
                          <textarea
                            name="body"
                            rows={3}
                            defaultValue={post.body ?? ''}
                            className="rounded-xl border border-white/10 bg-slate-950/70 p-3 text-sm text-white/90 outline-none"
                          />
                        </label>
                        <label className="grid gap-1">
                          <span className="text-xs text-white/55">Imagen URL</span>
                          <input
                            name="imageUrl"
                            defaultValue={post.imageUrl ?? ''}
                            className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                          />
                        </label>
                        <label className="grid gap-1">
                          <span className="text-xs text-white/55">Boton texto</span>
                          <input
                            name="ctaLabel"
                            defaultValue={post.ctaLabel ?? ''}
                            className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                          />
                        </label>
                        <label className="grid gap-1 md:col-span-2">
                          <span className="text-xs text-white/55">Boton URL</span>
                          <input
                            name="ctaUrl"
                            defaultValue={post.ctaUrl ?? ''}
                            className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                          />
                        </label>
                        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
                          <input
                            name="isPublished"
                            type="checkbox"
                            defaultChecked={post.isPublished}
                            className="accent-emerald-400"
                          />
                          Publicada
                        </label>
                        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
                          <input
                            name="isPinned"
                            type="checkbox"
                            defaultChecked={post.isPinned}
                            className="accent-emerald-400"
                          />
                          Fijada
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
                      <form action={deleteNewsPostAction} className="mt-3">
                        <input type="hidden" name="newsId" value={post.id} />
                        <FormSubmitButton
                          className="inline-flex h-9 items-center justify-center rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 text-xs font-semibold text-rose-100 transition hover:bg-rose-400/20"
                          pendingLabel="Borrando..."
                          confirmMessage="Eliminar esta noticia?"
                        >
                          Eliminar noticia
                        </FormSubmitButton>
                      </form>
                    </details>
                  ))
                ) : (
                  <p className="text-sm text-white/65">Todavia no hay noticias. Crea la primera arriba.</p>
                )}
              </div>
            </SectionShell>
          </div>
        ) : null}

        {activeTab === 'gods' ? (
          <div className="mt-8 grid gap-8">
            <SectionShell
              title="Catalogo de dioses griegos"
              subtitle="Click en un dios para ver / editar / cargar su PDF. Cuando lo tengas listo, asignas a cada usuario en la seccion de abajo."
            >
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-white/55">
                  {gods.length} dios(es) cargado(s)
                </p>
                <GodFormModal mode="create" />
              </div>

              {gods.length ? (
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {gods.map((god) => (
                    <GodFormModal key={god.id} mode="edit" god={god} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-white/65">
                  Todavia no hay dioses cargados. Crea el primero con el boton de arriba.
                </p>
              )}
            </SectionShell>

            <SectionShell
              title="Asignaciones por usuario"
              subtitle="Los dioses se asignan despues de Fase 2. Eligi la edicion y veras solo a quienes la estan cursando o ya completaron, mas a los egresados."
            >
              {(() => {
                const godsEditionSlug =
                  (searchParams?.godsEdition ?? '').toString().trim() ||
                  selectedEdition?.slug ||
                  editions.find((e) => e.isCurrent)?.slug ||
                  editions[0]?.slug ||
                  '';
                const godsEditionData =
                  editions.find((edition) => edition.slug === godsEditionSlug) ?? null;

                const eligibleUsers = users.filter((u) => {
                  if (String(u.status).toUpperCase() === 'EGRESADO') return true;
                  if (!godsEditionData) return false;
                  return u.enrollments.some((entry) => {
                    if (entry.editionId !== godsEditionData.id) return false;
                    const sequence = entry.phase?.sequence ?? 0;
                    if (sequence < 2) return false;
                    const status = String(entry.status).toUpperCase();
                    return status === 'CURSANDO' || status === 'FINALIZADO';
                  });
                });

                return (
                  <>
                    <div className="mb-5 flex flex-wrap items-center gap-2">
                      <span className="text-xs uppercase tracking-wider text-white/55">
                        Edicion:
                      </span>
                      {editions.map((edition) => {
                        const isActive = godsEditionSlug === edition.slug;
                        const params = new URLSearchParams();
                        params.set('tab', 'gods');
                        params.set('godsEdition', edition.slug);
                        if (selectedEdition?.slug) params.set('edition', selectedEdition.slug);
                        if (selectedPhase?.slug) params.set('phase', selectedPhase.slug);
                        return (
                          <Link
                            key={edition.id}
                            href={`/admin?${params.toString()}`}
                            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                              isActive
                                ? 'border-amber-300/60 bg-amber-300/15 text-amber-100'
                                : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                            }`}
                          >
                            {edition.title}
                          </Link>
                        );
                      })}
                      <span className="ml-auto text-xs text-white/45">
                        {eligibleUsers.length} participante(s) elegibles
                      </span>
                    </div>

                    {eligibleUsers.length ? (
                      <div className="grid gap-3">
                        {eligibleUsers.map((u) => {
                          const assignment = u.godAssignment ?? null;
                          return (
                            <form
                              key={u.id}
                              action={assignGodToUser}
                              className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 md:grid-cols-[1.2fr,1fr,1fr,auto] md:items-end"
                            >
                              <input type="hidden" name="userId" value={u.id} />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-white/90">
                                  {u.name ?? 'Sin nombre'}
                                </p>
                                <p className="truncate text-xs text-white/55">{u.email ?? '-'}</p>
                                <p className="mt-1 text-[11px] text-white/45">
                                  Estado: {statusLabel(u.status)}
                                </p>
                                {assignment?.god ? (
                                  <p className="mt-1 text-xs text-amber-200/90">
                                    Asignado: {assignment.god.name}
                                  </p>
                                ) : null}
                              </div>
                              <label className="grid gap-1">
                                <span className="text-xs text-white/55">Dios</span>
                                <select
                                  name="godId"
                                  defaultValue={assignment?.godId ?? ''}
                                  className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                                >
                                  <option value="">Sin asignacion</option>
                                  {gods.map((god) => (
                                    <option key={god.id} value={god.id}>
                                      {god.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="grid gap-1">
                                <span className="text-xs text-white/55">
                                  PDF personalizado (opcional)
                                </span>
                                <input
                                  name="customPdfUrl"
                                  defaultValue={assignment?.customPdfUrl ?? ''}
                                  className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                                  placeholder="https://..."
                                />
                              </label>
                              <FormSubmitButton
                                className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
                                pendingLabel="Guardando..."
                              >
                                Guardar
                              </FormSubmitButton>
                            </form>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-white/55">
                        En {godsEditionData?.title ?? 'esta edicion'} todavia nadie esta cursando Fase 2 o adelante. Cuando alguien pase a Fase 2 va a aparecer aca automaticamente.
                      </p>
                    )}
                  </>
                );
              })()}
            </SectionShell>
          </div>
        ) : null}

        {activeTab === 'gifts' ? (
          <div className="mt-8 grid gap-8">
            <SectionShell
              title="CUPONES/REGALOS"
              subtitle="Seguimiento de quienes regalaron un lugar para Metamorfosis 6ta edicion."
            >
              <div className="grid gap-3 md:grid-cols-4">
                <SummaryCard
                  label="Edicion"
                  value={editionSix?.title ?? 'Edicion 6'}
                  help={editionSix?.notes ?? 'Regalos asociados a la 6ta edicion.'}
                />
                <SummaryCard
                  label="Regalos cargados"
                  value={editionSixGiftInvitations.length}
                  help="Cantidad total de cupos regalados informados."
                />
                <SummaryCard
                  label="Usuarios que regalaron"
                  value={editionSixGiftInvitations.filter((entry) => entry.giver).length}
                  help="Usuarios identificados dentro del sistema."
                />
                <SummaryCard
                  label="Destino"
                  value="6ta edicion"
                  help="Sector exclusivo para ese beneficio."
                />
              </div>

              <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-5">
                {editionSixGiftInvitations.length ? (
                  <div className="grid gap-4">
                    {editionSixGiftInvitations.map((gift) => (
                      <div key={gift.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
                        <div className="grid gap-4 lg:grid-cols-[1fr,1fr]">
                          <div>
                            <p className="text-xs font-bold tracking-wide text-emerald-200/90">QUIEN REGALA</p>
                            <p className="mt-2 text-lg font-semibold text-white/90">
                              {gift.giver?.name ?? 'Sin nombre'}
                            </p>
                            <p className="mt-1 text-sm text-white/55">{gift.giver?.email ?? 'Sin email'}</p>
                            {gift.giver ? (
                              <p className="mt-2 text-xs text-white/60">
                                Estado: {statusLabel(gift.giver.status)} - Rol: {roleLabel(gift.giver.role)}
                              </p>
                            ) : null}
                          </div>

                          <div>
                            <p className="text-xs font-bold tracking-wide text-amber-200/90">PERSONA INVITADA</p>
                            <p className="mt-2 text-lg font-semibold text-white/90">
                              {gift.recipientFirstName} {gift.recipientLastName}
                            </p>
                            <p className="mt-1 text-sm text-white/65">Celular: {gift.recipientPhone}</p>
                            <p className="mt-2 text-xs text-white/50">
                              Cargado: {new Date(gift.createdAt).toLocaleString()}
                            </p>
                            <p className="mt-1 text-xs text-white/50">
                              Ultima actualizacion: {new Date(gift.updatedAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-white/70">
                    Todavia no hay regalos cargados para Metamorfosis 6ta edicion.
                  </p>
                )}
              </div>
            </SectionShell>
          </div>
        ) : null}

        {activeTab === 'settings' ? (
          <div className="mt-8 grid gap-8">
            <SectionShell
              title="Configuracion de estructura"
              subtitle="Crea nuevas ediciones y las fases internas que usa el equipo para el control financiero."
            >
              <div className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
                <form action={createAdminEdition} className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-5">
                  <p className="text-sm font-semibold text-white/80">Nueva edicion</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="grid gap-1">
                      <span className="text-xs text-white/60">Titulo</span>
                      <input
                        name="title"
                        required
                        className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                        placeholder="Edicion 7"
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-xs text-white/60">Secuencia</span>
                      <input
                        name="sequence"
                        required
                        type="number"
                        className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                        placeholder="7"
                      />
                    </label>
                  </div>
                  <label className="grid gap-1">
                    <span className="text-xs text-white/60">Notas</span>
                    <input
                      name="notes"
                      className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                      placeholder="Descripcion corta"
                    />
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
                    <input name="isCurrent" type="checkbox" className="accent-emerald-400" />
                    Marcar como edicion actual
                  </label>
                  <button
                    type="submit"
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
                  >
                    Crear edicion
                  </button>
                </form>

                {selectedEdition ? (
                  <form action={createAdminEditionPhase} className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-5">
                    <input type="hidden" name="editionId" value={selectedEdition.id} />
                    <p className="text-sm font-semibold text-white/80">Nueva fase en {selectedEdition.title}</p>
                    <div className="grid gap-3 md:grid-cols-3">
                      <label className="grid gap-1">
                        <span className="text-xs text-white/60">Titulo</span>
                        <input
                          name="title"
                          required
                          className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                          placeholder="Fase 1"
                        />
                      </label>
                      <label className="grid gap-1">
                        <span className="text-xs text-white/60">Secuencia</span>
                        <input
                          name="sequence"
                          required
                          type="number"
                          className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                          placeholder="1"
                        />
                      </label>
                      <label className="grid gap-1">
                        <span className="text-xs text-white/60">Precio total</span>
                        <input
                          name="price"
                          defaultValue="0"
                          className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                          placeholder="150000"
                        />
                      </label>
                    </div>
                    <label className="grid gap-1">
                      <span className="text-xs text-white/60">Notas</span>
                      <input
                        name="notes"
                        className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                        placeholder="Notas de la fase"
                      />
                    </label>
                    <button
                      type="submit"
                      className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/90 transition hover:bg-white/10"
                    >
                      Crear fase
                    </button>
                  </form>
                ) : null}
              </div>
            </SectionShell>

            <SectionShell
              title="Mapa de ediciones"
              subtitle="Referencia rapida de toda la estructura cargada en el sistema."
            >
              <div className="grid gap-4">
                {editions.map((edition) => (
                  <div key={edition.id} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                    <form action={updateAdminEdition} className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                      <input type="hidden" name="editionId" value={edition.id} />
                      <input type="hidden" name="sequence" value={String(edition.sequence)} />
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white/90">Editar {edition.title}</p>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                          {edition.enrollments.length} ficha(s)
                        </span>
                      </div>
                      <label className="grid gap-1">
                        <span className="text-xs text-white/60">Titulo</span>
                        <input
                          name="title"
                          defaultValue={edition.title}
                          className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                        />
                      </label>
                      <label className="grid gap-1">
                        <span className="text-xs text-white/60">Notas</span>
                        <input
                          name="notes"
                          defaultValue={edition.notes ?? ''}
                          className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                        />
                      </label>
                      <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
                        <input name="isCurrent" type="checkbox" defaultChecked={edition.isCurrent} className="accent-emerald-400" />
                        Marcar como edicion actual
                      </label>
                      <button
                        type="submit"
                        className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/90 transition hover:bg-white/10"
                      >
                        Guardar edicion
                      </button>
                    </form>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {edition.phases.length ? (
                        edition.phases.map((phase) => (
                          <form
                            key={phase.id}
                            action={updateAdminEditionPhase}
                            className="grid gap-2 rounded-2xl border border-white/10 bg-slate-950/40 p-3 md:grid-cols-[1fr,80px,120px,1fr,auto]"
                          >
                            <input type="hidden" name="phaseId" value={phase.id} />
                            <label className="grid gap-1">
                              <span className="text-[10px] uppercase tracking-wider text-white/45">
                                Titulo
                              </span>
                              <input
                                name="title"
                                defaultValue={phase.title}
                                className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                              />
                            </label>
                            <label className="grid gap-1">
                              <span className="text-[10px] uppercase tracking-wider text-white/45">
                                Orden
                              </span>
                              <input
                                name="sequence"
                                type="number"
                                min="1"
                                defaultValue={String(phase.sequence)}
                                className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                              />
                            </label>
                            <label className="grid gap-1">
                              <span className="text-[10px] uppercase tracking-wider text-white/45">
                                Precio
                              </span>
                              <input
                                name="price"
                                defaultValue={formatMoneyInput(phase.priceCents)}
                                className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                                placeholder="150000"
                              />
                            </label>
                            <label className="grid gap-1">
                              <span className="text-[10px] uppercase tracking-wider text-white/45">
                                Notas
                              </span>
                              <input
                                name="notes"
                                defaultValue={phase.notes ?? ''}
                                className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                              />
                            </label>
                            <div className="flex items-end">
                              <button
                                type="submit"
                                className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/90 transition hover:bg-white/10"
                              >
                                Guardar
                              </button>
                            </div>
                          </form>
                        ))
                      ) : (
                        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs text-amber-100">
                          Sin fases
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </SectionShell>
          </div>
        ) : null}
      </div>
    </main>
  );
}
