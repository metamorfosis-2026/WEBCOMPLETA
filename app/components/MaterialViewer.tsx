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
          'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-celeste/35 bg-celeste/12 px-4 text-xs font-bold uppercase tracking-[0.12em] text-celeste transition duration-300 hover:bg-celeste/20'
        }
      >
        {triggerLabel}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[70] flex items-stretch justify-center bg-night/92 backdrop-blur-xl sm:items-center sm:p-4"
        >
          <div
            className="relative flex h-full w-full max-w-3xl flex-col overflow-hidden border-ivory/12 bg-night sm:h-[92vh] sm:rounded-3xl sm:border"
            onContextMenu={(event) => event.preventDefault()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-ivory/10 bg-gradient-to-r from-celeste/12 to-transparent p-4">
              <div className="min-w-0">
                {badge ? (
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-celeste/85">
                    {badge}
                  </p>
                ) : null}
                {title ? (
                  <p className="display-sm mt-1 truncate text-[1.05rem] text-ivory">{title}</p>
                ) : null}
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
