type ReferralNode = {
  id: string;
  name: string | null;
  email: string | null;
  status: string;
  pointsBalance?: number;
  referrals?: ReferralNode[];
};

function initials(name: string | null, email: string | null) {
  const base = (name ?? '').trim();
  if (base) {
    const parts = base.split(/\s+/).slice(0, 2);
    const chars = parts.map((p) => p[0]).filter(Boolean);
    return chars.join('').toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return 'ME';
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

function NodeCard({ node, right }: { node: ReferralNode; right?: React.ReactNode }) {
  return (
    <div className="tree-node">
      <div className="tree-avatar" aria-hidden="true">
        {initials(node.name, node.email)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-ivory/90">{node.name ?? 'Sin nombre'}</p>
            <p className="truncate text-[12px] text-ivory/45">{node.email ?? '—'}</p>
          </div>
          <span className="chip flex-none">{statusLabel(node.status)}</span>
        </div>
        {right ? <div className="mt-2">{right}</div> : null}
      </div>
    </div>
  );
}

export function ReferralTree({
  root,
  maxDepth = 2,
}: {
  root: ReferralNode;
  maxDepth?: number;
}) {
  const level1 = root.referrals ?? [];

  return (
    <div className="grid gap-5">
      <div>
        <p className="eyebrow">Comunidad</p>
        <h2 className="display mt-3 text-[1.5rem] leading-tight sm:text-[1.75rem]">Tu árbol</h2>
        <p className="mt-2 max-w-prose text-[14px] leading-relaxed text-ivory/55">
          Visualización simple de invitaciones. Compartir es opcional y consciente.
        </p>
      </div>

      <NodeCard
        node={root}
        right={
          <p className="text-[12px] text-ivory/45">
            Este sos vos. Abajo se muestran tus referencias directas{maxDepth >= 2 ? ' y su siguiente nivel.' : '.'}
          </p>
        }
      />

      {level1.length ? (
        <div className="tree">
          {level1.map((child) => {
            const level2 = child.referrals ?? [];
            return (
              <div key={child.id} className="tree-row">
                <NodeCard node={child} />

                {maxDepth >= 2 && level2.length ? (
                  <div className="mt-3 pl-4">
                    <div className="tree">
                      {level2.slice(0, 8).map((g) => (
                        <div key={g.id} className="tree-row">
                          <NodeCard node={g} />
                        </div>
                      ))}
                    </div>
                    {level2.length > 8 ? (
                      <p className="mt-2 text-[12px] text-ivory/40">+{level2.length - 8} más…</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[14px] leading-relaxed text-ivory/50">
          Todavía no hay referencias directas. Está bien: esto no es una obligación.
        </p>
      )}
    </div>
  );
}
