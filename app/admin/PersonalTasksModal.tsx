'use client';

import { useEffect, useState } from 'react';

import { DeleteTaskInline } from './DeleteTaskInline';
import { FormSubmitButton } from './FormSubmitButton';
import {
  createWeeklyTask,
  updateWeeklyTaskAction,
} from './actions';

type WeeklyTask = {
  id: string;
  weekNumber: number;
  title: string;
  summary: string | null;
  body: string | null;
  resourceUrl: string | null;
  dueAt: string | null;
  isPublished: boolean;
  assignedUserId: string | null;
};

type UserBrief = {
  id: string;
  name: string | null;
  email: string | null;
  status: string;
  godAssignment?: { god: { name: string } | null } | null;
};

type Props = {
  user: UserBrief;
  userTasks: WeeklyTask[];
  badge?: string;
};

export function PersonalTasksModal({ user, userTasks, badge }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const sortedTasks = userTasks.slice().sort((a, b) => a.weekNumber - b.weekNumber);
  const nextWeek = sortedTasks.length
    ? Math.max(...sortedTasks.map((task) => task.weekNumber)) + 1
    : 1;

  const initial = (() => {
    const base = (user.name ?? '').trim();
    if (base) return base[0]?.toUpperCase() ?? '?';
    if (user.email) return user.email[0]?.toUpperCase() ?? '?';
    return '?';
  })();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full flex-col gap-3 rounded-2xl border border-amber-300/20 bg-gradient-to-br from-amber-300/8 via-slate-950/30 to-slate-950/50 p-4 text-left transition hover:border-amber-300/50 hover:bg-amber-300/10"
      >
        <div className="flex items-start gap-3">
          <div
            aria-hidden="true"
            className="grid h-11 w-11 flex-none place-items-center rounded-xl border border-amber-300/30 bg-gradient-to-br from-amber-300/25 to-slate-950 text-sm font-bold text-amber-100"
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white/90">
              {user.name ?? 'Sin nombre'}
            </p>
            <p className="truncate text-xs text-white/55">{user.email ?? '-'}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-amber-300/40 bg-amber-300/15 px-3 py-1 text-[10px] font-semibold text-amber-100">
            {userTasks.length} tarea(s)
          </span>
          {badge ? (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/70">
              {badge}
            </span>
          ) : null}
          {user.godAssignment?.god ? (
            <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-2 py-0.5 text-[10px] font-semibold text-fuchsia-100">
              {user.godAssignment.god.name}
            </span>
          ) : null}
        </div>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur"
        >
          <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-amber-300/30 bg-slate-950 shadow-2xl shadow-amber-500/10">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 bg-gradient-to-br from-amber-300/15 via-rose-300/5 to-transparent p-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-100/90">
                  TAREAS PERSONALES
                </p>
                <h2 className="mt-1 text-xl font-semibold text-white">
                  {user.name ?? 'Sin nombre'}
                </h2>
                <p className="text-sm text-white/55">{user.email ?? '-'}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/70">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    Estado: {user.status}
                  </span>
                  {badge ? (
                    <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-emerald-100">
                      {badge}
                    </span>
                  ) : null}
                  {user.godAssignment?.god ? (
                    <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-3 py-1 text-fuchsia-100">
                      Dios: {user.godAssignment.god.name}
                    </span>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80 transition hover:bg-white/10"
              >
                Cerrar
              </button>
            </div>

            <div className="overflow-y-auto p-5 sm:p-6">
              <p className="text-xs font-semibold text-amber-100/90">Historial</p>
              {sortedTasks.length === 0 ? (
                <p className="mt-2 text-xs text-white/55">Aun no tiene tareas cargadas.</p>
              ) : (
                <div className="mt-3 grid gap-2">
                  {sortedTasks.map((task) => (
                    <details
                      key={task.id}
                      className="rounded-xl border border-white/10 bg-slate-950/40 p-3 open:border-amber-300/30"
                    >
                      <summary className="cursor-pointer">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white/90">
                              Semana {task.weekNumber} - {task.title}
                            </p>
                            <p className="mt-1 text-[11px] text-white/55">
                              {task.isPublished ? 'Publicada' : 'Borrador'}
                              {task.dueAt
                                ? ` - Hasta ${new Date(task.dueAt).toLocaleDateString()}`
                                : ''}
                            </p>
                          </div>
                          {task.resourceUrl ? (
                            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">
                              PDF
                            </span>
                          ) : null}
                        </div>
                      </summary>

                      <form
                        action={updateWeeklyTaskAction}
                        className="mt-3 grid gap-2 md:grid-cols-2"
                      >
                        <input type="hidden" name="taskId" value={task.id} />
                        <input type="hidden" name="assignedUserId" value={user.id} />
                        <label className="grid gap-1 md:col-span-2">
                          <span className="text-[10px] text-white/55">Titulo</span>
                          <input
                            name="title"
                            defaultValue={task.title}
                            className="h-9 rounded-lg border border-white/10 bg-slate-950/70 px-3 text-xs text-white/90 outline-none"
                          />
                        </label>
                        <label className="grid gap-1">
                          <span className="text-[10px] text-white/55">Semana</span>
                          <input
                            name="weekNumber"
                            type="number"
                            min="1"
                            defaultValue={String(task.weekNumber)}
                            className="h-9 rounded-lg border border-white/10 bg-slate-950/70 px-3 text-xs text-white/90 outline-none"
                          />
                        </label>
                        <label className="grid gap-1">
                          <span className="text-[10px] text-white/55">Fecha limite</span>
                          <input
                            name="dueAt"
                            type="date"
                            defaultValue={
                              task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 10) : ''
                            }
                            className="h-9 rounded-lg border border-white/10 bg-slate-950/70 px-3 text-xs text-white/90 outline-none"
                          />
                        </label>
                        <label className="grid gap-1 md:col-span-2">
                          <span className="text-[10px] text-white/55">PDF / link recurso</span>
                          <input
                            name="resourceUrl"
                            defaultValue={task.resourceUrl ?? ''}
                            className="h-9 rounded-lg border border-white/10 bg-slate-950/70 px-3 text-xs text-white/90 outline-none"
                            placeholder="https://..."
                          />
                        </label>
                        <label className="grid gap-1 md:col-span-2">
                          <span className="text-[10px] text-white/55">Resumen</span>
                          <input
                            name="summary"
                            defaultValue={task.summary ?? ''}
                            className="h-9 rounded-lg border border-white/10 bg-slate-950/70 px-3 text-xs text-white/90 outline-none"
                          />
                        </label>
                        <label className="grid gap-1 md:col-span-2">
                          <span className="text-[10px] text-white/55">Cuerpo</span>
                          <textarea
                            name="body"
                            rows={2}
                            defaultValue={task.body ?? ''}
                            className="rounded-lg border border-white/10 bg-slate-950/70 p-2 text-xs text-white/90 outline-none"
                          />
                        </label>
                        <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] text-white/70 md:col-span-2">
                          <input
                            name="isPublished"
                            type="checkbox"
                            defaultChecked={task.isPublished}
                            className="accent-emerald-400"
                          />
                          Publicada
                        </label>
                        <div className="flex flex-wrap gap-2 md:col-span-2">
                          <FormSubmitButton
                            className="inline-flex h-9 items-center justify-center rounded-lg bg-emerald-500 px-3 text-xs font-semibold text-black transition hover:bg-emerald-400"
                            pendingLabel="Guardando..."
                          >
                            Guardar
                          </FormSubmitButton>
                        </div>
                      </form>

                      <div className="mt-2">
                        <DeleteTaskInline taskId={task.id} />
                      </div>
                    </details>
                  ))}
                </div>
              )}

              <form
                action={createWeeklyTask}
                className="mt-5 grid gap-2 rounded-2xl border border-amber-300/30 bg-amber-300/5 p-4"
              >
                <input type="hidden" name="scope" value="PERSONAL" />
                <input type="hidden" name="assignedUserId" value={user.id} />
                <input type="hidden" name="isPublished" value="on" />
                <p className="text-xs font-semibold text-amber-100/90">Agregar tarea semanal</p>
                <div className="grid gap-2 sm:grid-cols-[80px,1fr]">
                  <label className="grid gap-1">
                    <span className="text-[10px] text-white/55">Semana</span>
                    <input
                      name="weekNumber"
                      type="number"
                      min="1"
                      defaultValue={String(nextWeek)}
                      className="h-9 rounded-lg border border-white/10 bg-slate-950/70 px-3 text-xs text-white/90 outline-none"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[10px] text-white/55">
                      Fecha limite (opcional)
                    </span>
                    <input
                      name="dueAt"
                      type="date"
                      className="h-9 rounded-lg border border-white/10 bg-slate-950/70 px-3 text-xs text-white/90 outline-none"
                    />
                  </label>
                </div>
                <label className="grid gap-1">
                  <span className="text-[10px] text-white/55">Titulo</span>
                  <input
                    name="title"
                    required
                    className="h-9 rounded-lg border border-white/10 bg-slate-950/70 px-3 text-xs text-white/90 outline-none"
                    placeholder="Consigna de la semana"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] text-white/55">PDF / link recurso</span>
                  <input
                    name="resourceUrl"
                    className="h-9 rounded-lg border border-white/10 bg-slate-950/70 px-3 text-xs text-white/90 outline-none"
                    placeholder="https://..."
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] text-white/55">Resumen (opcional)</span>
                  <input
                    name="summary"
                    className="h-9 rounded-lg border border-white/10 bg-slate-950/70 px-3 text-xs text-white/90 outline-none"
                  />
                </label>
                <FormSubmitButton
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-amber-300 px-3 text-xs font-semibold text-black transition hover:bg-amber-200"
                  pendingLabel="Guardando..."
                >
                  Agregar tarea
                </FormSubmitButton>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
