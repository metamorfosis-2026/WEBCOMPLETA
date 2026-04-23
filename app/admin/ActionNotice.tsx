'use client';

import { useEffect, useState } from 'react';

export function ActionNotice({ message }: { message: string }) {
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    if (!message) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('notice');
    window.history.replaceState({}, '', url.toString());
    const timer = window.setTimeout(() => setVisible(false), 4500);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (!visible || !message) return null;

  return (
    <div className="fixed right-5 top-5 z-50 w-full max-w-sm rounded-2xl border border-emerald-400/30 bg-slate-950/95 p-4 shadow-2xl shadow-emerald-500/10 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[0.25em] text-emerald-200/90">GUARDADO</p>
          <p className="mt-2 text-sm text-white/90">{message}</p>
        </div>
        <button
          type="button"
          className="rounded-full border border-white/10 px-2 py-1 text-xs text-white/60 transition hover:bg-white/10 hover:text-white"
          onClick={() => setVisible(false)}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
