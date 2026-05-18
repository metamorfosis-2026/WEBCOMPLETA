'use client';

import { useEffect, useState } from 'react';

type Props = {
  assignment: {
    customPdfUrl: string | null;
    notes: string | null;
    god: {
      name: string;
      epithet: string | null;
      description: string | null;
      pdfUrl: string | null;
      imageUrl: string | null;
    } | null;
  } | null;
};

export function GreekGodPanel({ assignment }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
      const isCtrl = event.ctrlKey || event.metaKey;
      if (isCtrl && ['s', 'p', 'u'].includes(event.key.toLowerCase())) {
        event.preventDefault();
      }
    };
    const onContext = (event: MouseEvent) => event.preventDefault();
    const onDragStart = (event: DragEvent) => event.preventDefault();
    window.addEventListener('keydown', onKey);
    document.addEventListener('contextmenu', onContext);
    document.addEventListener('dragstart', onDragStart);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('contextmenu', onContext);
      document.removeEventListener('dragstart', onDragStart);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!assignment || !assignment.god) {
    return (
      <section className="rounded-3xl border border-amber-300/20 bg-gradient-to-br from-amber-300/5 via-rose-300/5 to-slate-950/50 p-6">
        <p className="text-xs font-bold tracking-[0.3em] text-amber-200/80">MI DIOS GRIEGO</p>
        <h2 className="mt-2 text-lg font-semibold text-white">Aun no esta asignado</h2>
        <p className="mt-2 text-sm text-white/65">
          Al avanzar a la Fase 2 el equipo te asigna un dios griego con su material para descargar.
        </p>
      </section>
    );
  }

  const pdfUrl = assignment.customPdfUrl ?? assignment.god.pdfUrl;
  const hasPdf = Boolean(pdfUrl);

  return (
    <>
      <section className="overflow-hidden rounded-3xl border border-amber-300/30 bg-gradient-to-br from-amber-300/15 via-rose-300/10 to-slate-950 p-6 shadow-[0_18px_60px_rgba(245,158,11,0.18)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {assignment.god.imageUrl ? (
            <img
              src={assignment.god.imageUrl}
              alt=""
              className="h-24 w-24 flex-none rounded-2xl border border-white/15 object-cover"
            />
          ) : (
            <div
              aria-hidden="true"
              className="grid h-24 w-24 flex-none place-items-center rounded-2xl border border-amber-300/30 bg-gradient-to-br from-amber-300/30 to-slate-950 text-2xl font-bold text-amber-100"
            >
              {assignment.god.name[0]}
            </div>
          )}

          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-amber-100/90">MI DIOS GRIEGO</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{assignment.god.name}</h2>
            {assignment.god.epithet ? (
              <p className="text-sm text-amber-100/80">{assignment.god.epithet}</p>
            ) : null}
            {assignment.god.description ? (
              <p className="mt-3 text-sm leading-6 text-white/80">{assignment.god.description}</p>
            ) : null}
            {assignment.notes ? (
              <p className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-white/70">
                Nota del equipo: {assignment.notes}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={!hasPdf}
                onClick={() => setOpen(true)}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-amber-300 px-5 text-sm font-semibold text-black transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {hasPdf ? 'Leer material' : 'PDF en preparacion'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {open && pdfUrl ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[70] flex items-stretch justify-center bg-slate-950/90 backdrop-blur sm:items-center sm:p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            className="relative flex h-full w-full max-w-3xl flex-col overflow-hidden border-white/10 bg-slate-950 sm:h-[92vh] sm:rounded-3xl sm:border"
            onContextMenu={(event) => event.preventDefault()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-amber-300/10 to-transparent p-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-200/90">MI DIOS GRIEGO</p>
                <p className="text-base font-semibold text-white">{assignment.god.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80 transition hover:bg-white/10"
              >
                Cerrar
              </button>
            </div>
            <iframe
              src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&statusbar=0&messages=0&view=FitH`}
              title={`PDF ${assignment.god.name}`}
              className="flex-1 w-full bg-white"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
