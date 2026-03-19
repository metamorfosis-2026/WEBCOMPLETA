import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { prisma } from '@/app/lib/prisma';
import { updateUserStatus } from './actions';

type Node = {
  id: string;
  name: string | null;
  email: string | null;
  referralCode?: string | null;
  status: string;
  pointsBalance: number;
  children: Node[];
};

function initials(name: string | null, email: string | null) {
  const base = (name ?? '').trim();
  if (base) {
    const parts = base.split(/\s+/).slice(0, 2);
    const chars = parts.map((p) => p[0]).filter(Boolean);
    return chars.join('').toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return 'AD';
}

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

function matchesQuery(node: Pick<Node, 'name' | 'email' | 'referralCode'>, q: string) {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = `${node.name ?? ''} ${node.email ?? ''} ${node.referralCode ?? ''}`.toLowerCase();
  return hay.includes(needle);
}

function filterTree(node: Node, q: string): Node | null {
  if (!q.trim()) return node;
  const nextChildren = node.children
    .map((c) => filterTree(c, q))
    .filter(Boolean) as Node[];
  const keep = matchesQuery(node, q) || nextChildren.length > 0;
  if (!keep) return null;
  return { ...node, children: nextChildren };
}

function NodeCard({ node }: { node: Node }) {
  return (
    <div className="tree-node">
      <div className="tree-avatar" aria-hidden="true">
        {initials(node.name, node.email)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white/90">{node.name ?? 'Sin nombre'}</p>
            <p className="truncate text-xs text-white/50">{node.email ?? '—'}</p>
          </div>
          <div className="text-xs text-white/70">
            {statusLabel(node.status)} · <span className="font-semibold">{node.pointsBalance}</span> pts
          </div>
        </div>
        {node.referralCode ? (
          <p className="mt-2 text-[11px] text-white/50">
            Código: <span className="font-semibold text-white/70">{node.referralCode}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

function renderTree(node: Node, depth: number, maxDepth: number | null) {
  const atLimit = maxDepth !== null && depth >= maxDepth;
  return (
    <div key={node.id} className="tree-row">
      <NodeCard node={node} />
      {!atLimit && node.children.length ? (
        <div className="mt-3 pl-4">
          <div className="tree">{node.children.map((c) => renderTree(c, depth + 1, maxDepth))}</div>
        </div>
      ) : null}
    </div>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: { q?: string; level?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/dashboard');

  const q = (searchParams?.q ?? '').toString();
  const levelParam = (searchParams?.level ?? '2').toString();
  const maxDepth: number | null =
    levelParam === '1' ? 1 : levelParam === '2' ? 2 : levelParam === 'all' ? null : 2;

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      referralCode: true,
      status: true,
      pointsBalance: true,
      referredById: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const usersForManagement = q.trim()
    ? users.filter((u) => matchesQuery(u, q))
    : users;

  const byParent = new Map<string | null, Node[]>();
  for (const u of users) {
    const n: Node = {
      id: u.id,
      name: u.name,
      email: u.email,
      referralCode: u.referralCode,
      status: u.status,
      pointsBalance: u.pointsBalance,
      children: [],
    };
    const key = u.referredById ?? null;
    const arr = byParent.get(key) ?? [];
    arr.push(n);
    byParent.set(key, arr);
  }

  const attach = (node: Node) => {
    const kids = byParent.get(node.id) ?? [];
    node.children = kids;
    node.children.forEach(attach);
    return node;
  };

  const roots = (byParent.get(null) ?? []).map(attach);
  const filteredRoots = q.trim()
    ? roots
        .map((r) => filterTree(r, q))
        .filter(Boolean) as Node[]
    : roots;

  return (
    <main className="min-h-screen text-white">
      <div className="mx-auto w-full max-w-5xl px-5 py-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
            <p className="mt-1 text-sm text-white/70">
              Árbol de comunidad (referencias). Presentación cuidada, no MLM.
            </p>
          </div>
          <Link className="text-sm text-white/70 hover:text-white hover:underline" href="/dashboard">
            Volver al panel
          </Link>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-7">
          <h2 className="text-lg font-semibold">Árbol jerárquico</h2>
          <p className="mt-2 text-sm text-white/70">
            Muestra relaciones de invitación (quién invitó a quién). Los puntos son reconocimiento simbólico.
          </p>

          <form method="get" className="mt-5 grid gap-3 sm:grid-cols-[1fr,180px,auto] sm:items-end">
            <div>
              <label className="block text-xs font-semibold tracking-wide text-white/70">Búsqueda</label>
              <input
                name="q"
                defaultValue={q}
                placeholder="Nombre, email o código…"
                className="mt-2 h-10 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none focus:border-emerald-400/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold tracking-wide text-white/70">Nivel</label>
              <select
                name="level"
                defaultValue={levelParam}
                className="mt-2 h-10 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none focus:border-emerald-400/50"
              >
                <option value="1">Nivel 1</option>
                <option value="2">Nivel 2</option>
                <option value="all">Completo</option>
              </select>
            </div>

            <button
              className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
              type="submit"
            >
              Aplicar
            </button>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-white/60">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              Raíces: <span className="font-semibold text-white/80">{filteredRoots.length}</span>
            </span>
            {q.trim() ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                Filtro: <span className="font-semibold text-white/80">“{q.trim()}”</span>
              </span>
            ) : null}
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              Profundidad: <span className="font-semibold text-white/80">{maxDepth ?? '∞'}</span>
            </span>
          </div>

          {filteredRoots.length ? (
            <div className="mt-6">
              <div className="tree">{filteredRoots.map((r) => renderTree(r, 0, maxDepth))}</div>
            </div>
          ) : (
            <p className="mt-6 text-sm text-white/70">Sin usuarios todavía.</p>
          )}
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-7">
          <h2 className="text-lg font-semibold">Gestión de estado</h2>
          <p className="mt-2 text-sm text-white/70">
            Actualizá el estado de participación. Si marcás Fase 1, podés otorgar puntos al referente (si existe).
          </p>

          {q.trim() ? (
            <p className="mt-3 text-sm text-white/70">
              Mostrando <span className="font-semibold text-white/90">{usersForManagement.length}</span> resultado(s)
              de búsqueda.
            </p>
          ) : null}

          <div className="mt-6 grid gap-3">
            {usersForManagement.map((u) => (
              <div key={u.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white/90">{u.name ?? 'Sin nombre'}</p>
                    <p className="text-xs text-white/50">{u.email ?? '—'}</p>
                    {u.referralCode ? (
                      <p className="mt-1 text-xs text-white/60">
                        Código: <span className="font-semibold text-white/80">{u.referralCode}</span>
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-white/60">
                      Estado: <span className="font-semibold text-white/80">{statusLabel(u.status)}</span> ·{' '}
                      <span className="font-semibold text-white/80">{u.pointsBalance}</span> pts
                    </p>
                  </div>

                  <form action={updateUserStatus} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input type="hidden" name="userId" value={u.id} />
                    <select
                      name="toStatus"
                      defaultValue={u.status}
                      className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none focus:border-emerald-400/50"
                    >
                      <option value="INTERESADO">Interesado</option>
                      <option value="FASE_1">Fase 1</option>
                      <option value="PROCESO_ACTIVO">Proceso activo</option>
                      <option value="EGRESADO">Egresado</option>
                    </select>

                    <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
                      <input name="awardReferrer" type="checkbox" className="accent-emerald-400" />
                      Otorgar puntos al referente (si completa Fase 1)
                    </label>

                    <button
                      className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
                      type="submit"
                    >
                      Guardar
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
