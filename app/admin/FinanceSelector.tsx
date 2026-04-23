'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type EditionOption = {
  slug: string;
  title: string;
  phases: { slug: string; title: string }[];
};

export function FinanceSelector({
  editions,
  selectedEditionSlug,
  selectedPhaseSlug,
}: {
  editions: EditionOption[];
  selectedEditionSlug?: string;
  selectedPhaseSlug?: string;
}) {
  const router = useRouter();
  const [editionSlug, setEditionSlug] = useState(selectedEditionSlug ?? editions[0]?.slug ?? '');

  const phases = useMemo(
    () => editions.find((edition) => edition.slug === editionSlug)?.phases ?? [],
    [editionSlug, editions]
  );
  const [phaseSlug, setPhaseSlug] = useState(
    selectedPhaseSlug && phases.some((phase) => phase.slug === selectedPhaseSlug)
      ? selectedPhaseSlug
      : phases[0]?.slug ?? ''
  );

  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
      <h3 className="text-base font-semibold text-white/90">Gestion financiera guiada</h3>
      <p className="mt-2 text-sm text-white/65">
        Primero elige la edicion. Despues selecciona la fase para ver y gestionar sus participantes.
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-[1fr,1fr,auto] md:items-end">
        <label className="grid gap-1">
          <span className="text-xs text-white/60">Edicion</span>
          <select
            value={editionSlug}
            onChange={(event) => {
              const nextEditionSlug = event.target.value;
              const nextPhases = editions.find((edition) => edition.slug === nextEditionSlug)?.phases ?? [];
              setEditionSlug(nextEditionSlug);
              setPhaseSlug(nextPhases[0]?.slug ?? '');
            }}
            className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
          >
            {editions.map((edition) => (
              <option key={edition.slug} value={edition.slug}>
                {edition.title}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-white/60">Fase</span>
          <select
            value={phaseSlug}
            onChange={(event) => setPhaseSlug(event.target.value)}
            className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
            disabled={!phases.length}
          >
            {phases.length ? (
              phases.map((phase) => (
                <option key={phase.slug} value={phase.slug}>
                  {phase.title}
                </option>
              ))
            ) : (
              <option value="">Sin fases</option>
            )}
          </select>
        </label>

        <button
          type="button"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!editionSlug || !phaseSlug}
          onClick={() => {
            const params = new URLSearchParams({
              tab: 'finance',
              edition: editionSlug,
              phase: phaseSlug,
            });
            router.push(`/admin?${params.toString()}`);
          }}
        >
          Ver participantes
        </button>
      </div>
    </div>
  );
}
