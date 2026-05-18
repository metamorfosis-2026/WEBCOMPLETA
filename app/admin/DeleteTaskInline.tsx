'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';

import { deleteWeeklyTaskAction } from './actions';

function SubmitDelete() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-8 items-center justify-center rounded-lg bg-rose-400 px-3 text-[11px] font-bold text-rose-950 transition hover:bg-rose-300 disabled:opacity-60"
    >
      {pending ? 'Borrando...' : 'Si, eliminar'}
    </button>
  );
}

export function DeleteTaskInline({ taskId }: { taskId: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex h-8 items-center justify-center rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 text-[11px] font-semibold text-rose-100 transition hover:bg-rose-400/20"
      >
        Eliminar tarea
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-rose-400/40 bg-rose-400/10 p-2">
      <span className="text-[11px] text-rose-100">Esta accion no se puede deshacer.</span>
      <form action={deleteWeeklyTaskAction} className="inline-flex items-center gap-2">
        <input type="hidden" name="taskId" value={taskId} />
        <SubmitDelete />
      </form>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="inline-flex h-8 items-center justify-center rounded-lg border border-white/15 bg-white/5 px-3 text-[11px] font-semibold text-white/80 transition hover:bg-white/10"
      >
        Cancelar
      </button>
    </div>
  );
}
