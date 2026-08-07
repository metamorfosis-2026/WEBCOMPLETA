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
      <section className="surface p-6">
        <p className="eyebrow">Mi dios griego</p>
        <h2 className="display mt-3 text-[1.4rem] leading-tight text-ivory/80">Aún no está asignado</h2>
        <p className="mt-3 text-[14px] leading-relaxed text-ivory/50">
          Al avanzar a la Fase 2 el equipo te asigna un dios griego con su material para leer.
        </p>
      </section>
    );
  }

  const pdfUrl = assignment.customPdfUrl ?? assignment.god.pdfUrl;
  const hasPdf = Boolean(pdfUrl);

  return (
    <>
      <section className="surface overflow-hidden border-sand/25 bg-gradient-to-br from-sand/10 via-ivory/[0.02] to-transparent p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {assignment.god.imageUrl ? (
            <img
              src={assignment.god.imageUrl}
              alt=""
              className="h-24 w-24 flex-none rounded-2xl border border-sand/25 object-cover"
            />
          ) : (
            <div
              aria-hidden="true"
              className="display grid h-24 w-24 flex-none place-items-center rounded-2xl border border-sand/30 bg-gradient-to-br from-sand/25 to-night text-[2rem] text-sand"
            >
              {assignment.god.name[0]}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-sand/80">
              Mi dios griego
            </p>
            <h2 className="display mt-2 text-[1.8rem] leading-tight text-ivory">
              {assignment.god.name}
            </h2>
            {assignment.god.epithet ? (
              <p className="mt-1 text-[13px] italic text-sand/75">{assignment.god.epithet}</p>
            ) : null}
            {assignment.god.description ? (
              <p className="mt-3 text-[14px] leading-relaxed text-ivory/70">
                {assignment.god.description}
              </p>
            ) : null}
            {assignment.notes ? (
              <p className="mt-3 rounded-xl border border-ivory/10 bg-night/40 p-3 text-[12px] leading-relaxed text-ivory/60">
                Nota del equipo: {assignment.notes}
              </p>
            ) : null}

            <button
              type="button"
              disabled={!hasPdf}
              onClick={() => setOpen(true)}
              className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-sand px-5 text-xs font-extrabold uppercase tracking-[0.12em] text-night transition duration-300 hover:shadow-[0_14px_36px_-14px_rgba(228,200,156,1)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              {hasPdf ? 'Leer material' : 'PDF en preparación'}
            </button>
          </div>
        </div>
      </section>

      {open && pdfUrl ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[70] flex items-stretch justify-center bg-night/92 backdrop-blur-xl sm:items-center sm:p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            className="relative flex h-full w-full max-w-3xl flex-col overflow-hidden border-ivory/12 bg-night sm:h-[92vh] sm:rounded-3xl sm:border"
            onContextMenu={(event) => event.preventDefault()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-ivory/10 bg-gradient-to-r from-sand/12 to-transparent p-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-sand/85">
                  Mi dios griego
                </p>
                <p className="display-sm mt-1 truncate text-[1.05rem] text-ivory">
                  {assignment.god.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full border border-ivory/15 text-ivory/50 transition hover:border-ivory/35 hover:text-ivory"
                aria-label="Cerrar"
              >
                ✕
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
