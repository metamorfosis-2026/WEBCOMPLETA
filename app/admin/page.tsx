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
import { linkUserReferrer, recordPayment, updateUserStatus, upsertEnrollment } from './actions';

type TreeNode = {
  id: string;
  name: string | null;
  email: string | null;
  referralCode?: string | null;
  status: string;
  pointsBalance: number;
  children: TreeNode[];
};

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

function buildEditionHref(slug: string, q: string, levelParam: string) {
  const params = new URLSearchParams();
  if (slug) params.set('edition', slug);
  if (q.trim()) params.set('q', q.trim());
  if (levelParam) params.set('level', levelParam);
  return `/admin?${params.toString()}`;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: { q?: string; level?: string; edition?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!isAdminRole(session.user.role)) redirect('/dashboard');

  const q = (searchParams?.q ?? '').toString();
  const levelParam = (searchParams?.level ?? '2').toString();
  const maxDepth: number | null =
    levelParam === '1' ? 1 : levelParam === '2' ? 2 : levelParam === 'all' ? null : 2;

  const { users, editions } = await getAdminData();

  const selectedEdition =
    editions.find((edition) => edition.slug === searchParams?.edition) ??
    editions.find((edition) => edition.isCurrent) ??
    editions[0];

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
  const totalDue = editionParticipants.reduce((sum, enrollment) => sum + enrollment.amountDueCents, 0);
  const totalPaid = editionParticipants.reduce(
    (sum, enrollment) => sum + sumConfirmedPayments(enrollment.payments),
    0
  );
  const totalPending = Math.max(totalDue - totalPaid, 0);

  return (
    <main className="min-h-screen text-white">
      <div className="mx-auto w-full max-w-6xl px-5 py-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
            <p className="mt-1 text-sm text-white/70">
              Gestion de comunidad, ediciones y pagos desde una sola vista.
            </p>
          </div>
          <Link className="text-sm text-white/70 hover:text-white hover:underline" href="/dashboard">
            Volver al panel
          </Link>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Pagos por edicion</h2>
              <p className="mt-2 text-sm text-white/70">
                Administra participantes, monto acordado y pagos confirmados por cada edicion.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {editions.map((edition) => (
                <Link
                  key={edition.id}
                  href={buildEditionHref(edition.slug, q, levelParam)}
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
          </div>

          {selectedEdition ? (
            <>
              <div className="mt-6 grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs font-bold tracking-wide text-emerald-200/90">EDICION</p>
                  <p className="mt-2 text-lg font-semibold text-white">{selectedEdition.title}</p>
                  <p className="mt-2 text-xs text-white/50">{selectedEdition.notes ?? 'Sin notas aun.'}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs font-bold tracking-wide text-emerald-200/90">PARTICIPANTES</p>
                  <p className="mt-2 text-lg font-semibold text-white">{editionParticipants.length}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs font-bold tracking-wide text-emerald-200/90">PAGADO</p>
                  <p className="mt-2 text-lg font-semibold text-white">{formatMoney(totalPaid)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs font-bold tracking-wide text-emerald-200/90">PENDIENTE</p>
                  <p className="mt-2 text-lg font-semibold text-white">{formatMoney(totalPending)}</p>
                </div>
              </div>

              <div className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-5">
                <h3 className="text-base font-semibold">Asignar participante a esta edicion</h3>
                <p className="mt-2 text-sm text-white/60">
                  Carga el monto total y el estado inicial. Si la persona ya estaba asignada, se actualiza.
                </p>

                <form action={upsertEnrollment} className="mt-5 grid gap-3 lg:grid-cols-4">
                  <input type="hidden" name="editionId" value={selectedEdition.id} />

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
                    <span className="text-xs text-white/60">Monto total</span>
                    <input
                      name="amountDue"
                      defaultValue="0"
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

                  <label className="grid gap-1 lg:col-span-3">
                    <span className="text-xs text-white/60">Notas</span>
                    <input
                      name="notes"
                      className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
                      placeholder="Senia, observaciones, modalidad..."
                    />
                  </label>

                  <input type="hidden" name="currency" value="ARS" />

                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
                    >
                      Guardar participante
                    </button>
                  </div>
                </form>
              </div>

              <div className="mt-6 grid gap-4">
                {editionParticipants.length ? (
                  editionParticipants.map((enrollment) => {
                    const paid = sumConfirmedPayments(enrollment.payments);
                    const pending = Math.max(enrollment.amountDueCents - paid, 0);

                    return (
                      <div key={enrollment.id} className="rounded-3xl border border-white/10 bg-black/20 p-5">
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
                            {enrollment.user.referredBy ? (
                              <p className="mt-1 text-xs text-white/50">
                                Invitado/a por:{' '}
                                {enrollment.user.referredBy.name ??
                                  enrollment.user.referredBy.email ??
                                  'Sin dato'}
                              </p>
                            ) : null}
                            <p className="mt-3 text-sm text-white/60">
                              Total: {formatMoney(enrollment.amountDueCents, enrollment.currency)} - Pagado:{' '}
                              {formatMoney(paid, enrollment.currency)} - Pendiente:{' '}
                              {formatMoney(pending, enrollment.currency)}
                            </p>
                          </div>

                          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                            {enrollmentStatusLabel(enrollment.status)}
                          </div>
                        </div>

                        <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr,1fr]">
                          <form action={upsertEnrollment} className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                            <input type="hidden" name="userId" value={enrollment.userId} />
                            <input type="hidden" name="editionId" value={enrollment.editionId} />
                            <input type="hidden" name="currency" value={enrollment.currency} />

                            <p className="text-sm font-semibold text-white/80">Actualizar ficha de la edicion</p>

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

                            <button
                              type="submit"
                              className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/90 transition hover:bg-white/10"
                            >
                              Actualizar ficha
                            </button>
                          </form>

                          <form action={recordPayment} className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                            <input type="hidden" name="enrollmentId" value={enrollment.id} />
                            <input type="hidden" name="currency" value={enrollment.currency} />

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

                            <button
                              type="submit"
                              className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
                            >
                              Cargar pago
                            </button>
                          </form>
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
                          <p className="mt-5 text-sm text-white/70">Todavia no hay pagos para este participante.</p>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/70">
                    Esta edicion todavia no tiene participantes cargados.
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className="mt-6 text-sm text-white/70">Todavia no hay ediciones disponibles.</p>
          )}
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-7">
          <h2 className="text-lg font-semibold">Comunidad y busqueda</h2>
          <p className="mt-2 text-sm text-white/70">
            Arbol de invitaciones, filtro de usuarios y gestion de estado.
          </p>

          <form method="get" className="mt-5 grid gap-3 sm:grid-cols-[1fr,180px,auto] sm:items-end">
            {selectedEdition ? <input type="hidden" name="edition" value={selectedEdition.slug} /> : null}

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
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-7">
          <h2 className="text-lg font-semibold">Gestion por usuario</h2>
          <p className="mt-2 text-sm text-white/70">
            Actualiza estado global y, si eres superadmin, corrige manualmente quien invito a quien.
          </p>

          {q.trim() ? (
            <p className="mt-3 text-sm text-white/70">
              Mostrando <span className="font-semibold text-white/90">{usersForManagement.length}</span> resultado(s).
            </p>
          ) : null}

          <div className="mt-6 grid gap-4">
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
        </div>
      </div>
    </main>
  );
}
