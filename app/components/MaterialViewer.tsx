'use client';

import { useEffect, useState } from 'react';

type Props = {
  url: string;
  title?: string;
  badge?: string;
  triggerLabel?: string;
  triggerClassName?: string;
};

export function MaterialViewer({
  url,
  title,
  badge,
  triggerLabel = 'Abrir material',
  triggerClassName,
}: Props) {
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

  const lockedUrl = `${url}#toolbar=0&navpanes=0&scrollbar=0&statusbar=0&messages=0&view=FitH`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ??
          'inline-flex h-9 items-center justify-center rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-3 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-400/20'
        }
      >
        {triggerLabel}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[70] flex items-stretch justify-center bg-slate-950/90 backdrop-blur sm:items-center sm:p-4"
        >
          <div
            className="relative flex h-full w-full max-w-3xl flex-col overflow-hidden border-white/10 bg-slate-950 sm:h-[92vh] sm:rounded-3xl sm:border"
            onContextMenu={(event) => event.preventDefault()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-emerald-400/10 to-transparent p-4">
              <div className="min-w-0">
                {badge ? (
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-200/90">
                    {badge}
                  </p>
                ) : null}
                {title ? (
                  <p className="truncate text-base font-semibold text-white">{title}</p>
                ) : null}
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
              src={lockedUrl}
              title={title ?? 'Material'}
              className="w-full flex-1 bg-white"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
