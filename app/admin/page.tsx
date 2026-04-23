import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import {
  enrollmentStatusLabel,
  formatMoney,
  isAdminRole,
  isSuperadminRole,
  paymentMethodLabel,
  paymentStatusLabel,
  roleLabel,
  statusLabel,
  sumConfirmedPayments,
} from '@/app/lib/metamorfosis';
import { getAdminData } from '@/app/lib/supabase/views';
import { ActionNotice } from './ActionNotice';
import { FinanceSelector } from './FinanceSelector';
import { FormSubmitButton } from './FormSubmitButton';
import {
  createAdminEdition,
  createAdminEditionPhase,
  deletePayment,
  linkUserReferrer,
  recordPayment,
  updateAdminEdition,
  updateAdminEditionPhase,
  updateUserStatus,
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

type AdminTab = 'overview' | 'finance' | 'community' | 'gifts' | 'settings';

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

function NodeCard({ node }: { node: TreeNode }) {
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

function renderTree(node: TreeNode, depth: number, maxDepth: number | null) {
  const atLimit = maxDepth !== null && depth >= maxDepth;

  return (
    <div key={node.id} className="tree-row">
      <NodeCard node={node} />
      {!atLimit && node.children.length ? (
        <div className="mt-3 pl-4">
          <div className="tree">{node.children.map((child) => renderTree(child, depth + 1, maxDepth))}</div>
        </div>
      ) : null}
    </div>
  );
}

function buildAdminHref({
  edition,
  phase,
  q,
  level,
  tab,
}: {
  edition?: string;
  phase?: string;
  q?: string;
  level?: string;
  tab?: string;
}) {
  const params = new URLSearchParams();
  if (edition) params.set('edition', edition);
  if (phase) params.set('phase', phase);
  if (q?.trim()) params.set('q', q.trim());
  if (level) params.set('level', level);
  if (tab) params.set('tab', tab);
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
  searchParams?: { q?: string; level?: string; edition?: string; phase?: string; tab?: string; notice?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!isAdminRole(session.user.role)) redirect('/dashboard');

  const q = (searchParams?.q ?? '').toString();
  const levelParam = (searchParams?.level ?? '2').toString();
  const maxDepth: number | null =
    levelParam === '1' ? 1 : levelParam === '2' ? 2 : levelParam === 'all' ? null : 2;
  const tabParam = (searchParams?.tab ?? 'overview').toString() as AdminTab;
  const activeTab: AdminTab =
    tabParam === 'finance' || tabParam === 'community' || tabParam === 'gifts' || tabParam === 'settings'
      ? tabParam
      : 'overview';
  const notice = (searchParams?.notice ?? '').toString().trim();

  const { users, editions, giftInvitations } = await getAdminData();

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

  const editionParticipants = selectedEdition?.enrollments ?? [];
  const phaseParticipants = selectedPhase
    ? editionParticipants.filter((enrollment) => enrollment.phase?.id === selectedPhase.id)
    : [];
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
    { id: 'gifts', label: 'CUPONES/REGALOS', help: 'Regalos de cupos para la 6ta edicion.' },
    { id: 'settings', label: 'Settings', help: 'Crear ediciones y fases.' },
  ];

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
            <FinanceSelector
              editions={editions.map((edition) => ({
                slug: edition.slug,
                title: edition.title,
                phases: edition.phases.map((phase) => ({
                  slug: phase.slug,
                  title: phase.title,
                })),
              }))}
              selectedEditionSlug={selectedEdition?.slug}
              selectedPhaseSlug={selectedPhase?.slug}
            />

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
              title="Detalle operativo"
              subtitle="Primero ves a todos los participantes de la fase con su progreso. Luego abres a quien quieras gestionar."
            >
              {phaseParticipants.length ? (
                <div className="grid gap-4">
                  {phaseParticipants.map((enrollment) => {
                    const paid = sumConfirmedPayments(enrollment.payments);
                    const pending = Math.max(enrollment.amountDueCents - paid, 0);

                    return (
                      <details
                        key={enrollment.id}
                        className="rounded-3xl border border-white/10 bg-black/20 p-5 open:border-emerald-400/30 open:bg-black/30"
                      >
                        <summary className="cursor-pointer list-none">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-white/90">
                                {enrollment.user.name ?? 'Sin nombre'}
                              </p>
                              <p className="mt-1 text-xs text-white/50">{enrollment.user.email ?? '-'}</p>
                              <p className="mt-2 text-xs text-white/60">
                                Rol: {roleLabel(enrollment.user.role)} - Estado global:{' '}
                                {statusLabel(enrollment.user.status)}
                              </p>
                              <p className="mt-3 text-sm text-white/60">
                                {enrollment.phase ? `${enrollment.phase.title} - ` : ''}
                                Total: {formatMoney(enrollment.amountDueCents, enrollment.currency)} - Pagado:{' '}
                                {formatMoney(paid, enrollment.currency)} - Pendiente:{' '}
                                {formatMoney(pending, enrollment.currency)}
                              </p>
                            </div>

                            <div className="flex flex-col items-start gap-3 lg:items-end">
                              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                                {enrollmentStatusLabel(enrollment.status)}
                              </div>
                              <span className="text-xs text-emerald-200/80">
                                Click para ver pagos y acciones
                              </span>
                            </div>
                          </div>

                          <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                            <PaymentProgress
                              paid={paid}
                              due={enrollment.amountDueCents}
                              currency={enrollment.currency}
                            />
                          </div>
                        </summary>

                        <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr,1fr]">
                          <form action={upsertEnrollment} className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                            <input type="hidden" name="userId" value={enrollment.userId} />
                            <input type="hidden" name="editionId" value={enrollment.editionId} />
                            <input type="hidden" name="phaseId" value={enrollment.phase?.id ?? ''} />
                            <input type="hidden" name="currency" value={enrollment.currency} />
                            <input type="hidden" name="returnTab" value="finance" />

                            <p className="text-sm font-semibold text-white/80">
                              Actualizar ficha de {enrollment.phase?.title ?? 'la fase'}
                            </p>

                            <div className="grid gap-3 md:grid-cols-2">
                              <label className="grid gap-1">
                                <span className="text-xs text-white/60">Monto total</span>
                                <input
                                  name="amountDue"
                                  defaultValue={String(enrollment.amountDueCents / 100)}
                                  className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                                />
                              </label>

                              <label className="grid gap-1">
                                <span className="text-xs text-white/60">Estado</span>
                                <select
                                  name="status"
                                  defaultValue={enrollment.status}
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
                            </div>

                            <label className="grid gap-1">
                              <span className="text-xs text-white/60">Notas</span>
                              <input
                                name="notes"
                                defaultValue={enrollment.notes ?? ''}
                                className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                              />
                            </label>

                            <FormSubmitButton
                              className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/90 transition hover:bg-white/10"
                              pendingLabel="Actualizando ficha..."
                            >
                              Actualizar ficha
                            </FormSubmitButton>
                          </form>

                          <form action={recordPayment} className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                            <input type="hidden" name="enrollmentId" value={enrollment.id} />
                            <input type="hidden" name="currency" value={enrollment.currency} />
                            <input type="hidden" name="returnTab" value="finance" />

                            <p className="text-sm font-semibold text-white/80">Registrar pago</p>

                            <div className="grid gap-3 md:grid-cols-2">
                              <label className="grid gap-1">
                                <span className="text-xs text-white/60">Monto</span>
                                <input
                                  name="amount"
                                  defaultValue="0"
                                  className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                                  placeholder="50000"
                                />
                              </label>

                              <label className="grid gap-1">
                                <span className="text-xs text-white/60">Fecha</span>
                                <input
                                  name="paidAt"
                                  type="date"
                                  defaultValue={new Date().toISOString().slice(0, 10)}
                                  className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                                />
                              </label>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                              <label className="grid gap-1">
                                <span className="text-xs text-white/60">Metodo</span>
                                <select
                                  name="method"
                                  defaultValue="TRANSFERENCIA"
                                  className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
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
                                  className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                                >
                                  <option value="CONFIRMADO">Confirmado</option>
                                  <option value="PENDIENTE">Pendiente</option>
                                  <option value="CANCELADO">Cancelado</option>
                                  <option value="DEVUELTO">Devuelto</option>
                                </select>
                              </label>
                            </div>

                            <label className="grid gap-1">
                              <span className="text-xs text-white/60">Referencia</span>
                              <input
                                name="reference"
                                className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                                placeholder="Comprobante, alias, observacion corta..."
                              />
                            </label>

                            <label className="grid gap-1">
                              <span className="text-xs text-white/60">Notas</span>
                              <input
                                name="notes"
                                className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                              />
                            </label>

                            <FormSubmitButton
                              className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
                              pendingLabel="Guardando pago..."
                            >
                              Cargar pago
                            </FormSubmitButton>
                          </form>
                        </div>

                        {enrollment.payments.length ? (
                          <div className="mt-5 grid gap-3">
                            {enrollment.payments.map((payment) => (
                              <div key={payment.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <div>
                                    <p className="text-sm font-semibold text-white/90">
                                      {formatMoney(payment.amountCents, payment.currency)}
                                    </p>
                                    <p className="mt-1 text-xs text-white/50">
                                      {new Date(payment.paidAt).toLocaleDateString()}
                                    </p>
                                  </div>
                                  <form action={deletePayment}>
                                    <input type="hidden" name="paymentId" value={payment.id} />
                                    <input type="hidden" name="editionSlug" value={selectedEdition?.slug ?? ''} />
                                    <input type="hidden" name="phaseSlug" value={selectedPhase?.slug ?? ''} />
                                    <input type="hidden" name="returnTab" value="finance" />
                                    <FormSubmitButton
                                      className="inline-flex h-9 items-center justify-center rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 text-xs font-semibold text-rose-100 transition hover:bg-rose-400/20"
                                      pendingLabel="Borrando..."
                                      confirmMessage="Seguro quieres borrar este registro de pago?"
                                    >
                                      Borrar pago
                                    </FormSubmitButton>
                                  </form>
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
                          <p className="mt-5 text-sm text-white/70">Todavia no hay pagos para este participante.</p>
                        )}
                      </details>
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
                    <div className="tree">{filteredRoots.map((root) => renderTree(root, 0, maxDepth))}</div>
                  </div>
                ) : (
                  <p className="mt-6 text-sm text-white/70">Sin usuarios cargados todavia.</p>
                )}
              </div>
            </SectionShell>

            <SectionShell
              title="Gestion por usuario"
              subtitle="Actualiza estados globales y corrige referencias manuales."
            >
              {q.trim() ? (
                <p className="mb-4 text-sm text-white/70">
                  Mostrando <span className="font-semibold text-white/90">{usersForManagement.length}</span> resultado(s).
                </p>
              ) : null}

              <div className="grid gap-4">
                {usersForManagement.map((user) => (
                  <div key={user.id} className="rounded-3xl border border-white/10 bg-black/20 p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white/90">{user.name ?? 'Sin nombre'}</p>
                        <p className="mt-1 text-xs text-white/50">{user.email ?? '-'}</p>
                        <p className="mt-2 text-xs text-white/60">
                          Rol: {roleLabel(user.role)} - Estado: {statusLabel(user.status)} - {user.pointsBalance} pts
                        </p>
                        {user.referralCode ? (
                          <p className="mt-1 text-xs text-white/60">
                            Codigo: <span className="font-semibold text-white/80">{user.referralCode}</span>
                          </p>
                        ) : null}
                        {user.enrollments.length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {user.enrollments.map((enrollment) => (
                              <span
                                key={enrollment.id}
                                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70"
                              >
                                {enrollment.edition.title}
                                {enrollment.phase ? ` - ${enrollment.phase.title}` : ''}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <form action={updateUserStatus} className="grid gap-3 sm:min-w-[360px]">
                        <input type="hidden" name="userId" value={user.id} />

                        <div className="grid gap-3 sm:grid-cols-[1fr,auto]">
                          <select
                            name="toStatus"
                            defaultValue={user.status}
                            className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none focus:border-emerald-400/50"
                          >
                            <option value="INTERESADO">Interesado</option>
                            <option value="FASE_1">Fase 1</option>
                            <option value="PROCESO_ACTIVO">Proceso activo</option>
                            <option value="EGRESADO">Egresado</option>
                          </select>

                          <button
                            className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
                            type="submit"
                          >
                            Guardar estado
                          </button>
                        </div>

                        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
                          <input name="awardReferrer" type="checkbox" className="accent-emerald-400" />
                          Otorgar puntos al referente si entra a Fase 1
                        </label>
                      </form>
                    </div>

                    <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                      <p className="text-sm font-semibold text-white/80">Referencia</p>

                      {isSuperadminRole(session.user.role) ? (
                        <form action={linkUserReferrer} className="mt-3 grid gap-3 md:grid-cols-[1fr,auto]">
                          <input type="hidden" name="userId" value={user.id} />

                          <select
                            name="referredById"
                            defaultValue={user.referredById ?? ''}
                            className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                          >
                            <option value="">Sin referente</option>
                            {users
                              .filter((candidate) => candidate.id !== user.id)
                              .map((candidate) => (
                                <option key={candidate.id} value={candidate.id}>
                                  {(candidate.name ?? 'Sin nombre') +
                                    (candidate.email ? ` - ${candidate.email}` : '')}
                                </option>
                              ))}
                          </select>

                          <button
                            type="submit"
                            className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/90 transition hover:bg-white/10"
                          >
                            Guardar referencia
                          </button>
                        </form>
                      ) : (
                        <p className="mt-3 text-sm text-white/60">
                          {user.referredBy
                            ? `Invitado/a por ${user.referredBy.name ?? user.referredBy.email ?? 'Sin dato'}`
                            : 'Sin referente cargado.'}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
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
                            className="grid gap-2 rounded-2xl border border-white/10 bg-slate-950/40 p-3 md:grid-cols-[1.2fr,140px,1fr,auto]"
                          >
                            <input type="hidden" name="phaseId" value={phase.id} />
                            <input type="hidden" name="sequence" value={String(phase.sequence)} />
                            <input
                              name="title"
                              defaultValue={phase.title}
                              className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                            />
                            <input
                              name="price"
                              defaultValue={formatMoneyInput(phase.priceCents)}
                              className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                              placeholder="150000"
                            />
                            <input
                              name="notes"
                              defaultValue={phase.notes ?? ''}
                              className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                            />
                            <button
                              type="submit"
                              className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/90 transition hover:bg-white/10"
                            >
                              Guardar
                            </button>
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
