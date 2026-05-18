'use client';

import { useEffect, useState } from 'react';

import { FormSubmitButton } from './FormSubmitButton';
import {
  createGreekGod,
  deleteGreekGodAction,
  updateGreekGodAction,
} from './actions';

type God = {
  id: string;
  slug: string;
  name: string;
  epithet: string | null;
  description: string | null;
  pdfUrl: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
};

type CreateProps = {
  mode: 'create';
};

type EditProps = {
  mode: 'edit';
  god: God;
};

type Props = CreateProps | EditProps;

function ModalShell({
  open,
  onClose,
  title,
  badge,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-amber-300/30 bg-slate-950 shadow-2xl shadow-amber-500/10">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 bg-gradient-to-br from-amber-300/15 via-rose-300/5 to-transparent p-5">
          <div>
            {badge ? (
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-100/90">
                {badge}
              </p>
            ) : null}
            <h2 className="mt-1 text-xl font-semibold text-white">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80 transition hover:bg-white/10"
          >
            Cerrar
          </button>
        </div>
        <div className="overflow-y-auto p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

function CreateGod() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center justify-center rounded-2xl border border-amber-300/40 bg-amber-300/10 px-5 text-sm font-semibold text-amber-100 transition hover:bg-amber-300/20"
      >
        + Crear dios
      </button>

      <ModalShell
        open={open}
        onClose={() => setOpen(false)}
        badge="Nuevo dios"
        title="Cargar un nuevo dios al catalogo"
      >
        <form action={createGreekGod} className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-xs text-white/60">Nombre</span>
            <input
              name="name"
              required
              className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
              placeholder="Apolo"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-white/60">Epiteto / arquetipo</span>
            <input
              name="epithet"
              className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
              placeholder="Luz, claridad"
            />
          </label>
          <label className="grid gap-1 md:col-span-2">
            <span className="text-xs text-white/60">Descripcion</span>
            <textarea
              name="description"
              rows={3}
              className="rounded-xl border border-white/10 bg-slate-950/70 p-3 text-sm text-white/90 outline-none"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-white/60">PDF maestro (URL)</span>
            <input
              name="pdfUrl"
              className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
              placeholder="https://..."
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-white/60">Imagen (URL)</span>
            <input
              name="imageUrl"
              className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-white/60">Orden</span>
            <input
              name="sortOrder"
              type="number"
              defaultValue="0"
              className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
            />
          </label>
          <div className="md:col-span-2 flex justify-end">
            <FormSubmitButton
              className="inline-flex h-11 items-center justify-center rounded-xl bg-amber-300 px-5 text-sm font-semibold text-black transition hover:bg-amber-200"
              pendingLabel="Guardando..."
            >
              Crear dios
            </FormSubmitButton>
          </div>
        </form>
      </ModalShell>
    </>
  );
}

function EditGod({ god }: { god: God }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex flex-col items-center gap-2 rounded-2xl border border-amber-300/20 bg-gradient-to-br from-amber-300/10 via-slate-950/30 to-slate-950/50 p-4 text-center transition hover:border-amber-300/50 hover:bg-amber-300/10"
      >
        {god.imageUrl ? (
          <img
            src={god.imageUrl}
            alt={god.name}
            className="h-20 w-20 rounded-2xl border border-white/15 object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="grid h-20 w-20 place-items-center rounded-2xl border border-amber-300/30 bg-gradient-to-br from-amber-300/25 to-slate-950 text-2xl font-bold text-amber-100"
          >
            {god.name[0]}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white/90">{god.name}</p>
          {god.epithet ? (
            <p className="mt-1 line-clamp-2 text-[11px] text-amber-100/70">
              {god.epithet}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1">
          {god.pdfUrl ? (
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-100">
              PDF
            </span>
          ) : (
            <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-100">
              Sin PDF
            </span>
          )}
          {!god.isActive ? (
            <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/60">
              Inactivo
            </span>
          ) : null}
        </div>
      </button>

      <ModalShell
        open={open}
        onClose={() => setOpen(false)}
        badge="Editar dios"
        title={god.name}
      >
        <form action={updateGreekGodAction} className="grid gap-3 md:grid-cols-2">
          <input type="hidden" name="godId" value={god.id} />
          <label className="grid gap-1">
            <span className="text-xs text-white/60">Nombre</span>
            <input
              name="name"
              defaultValue={god.name}
              className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-white/60">Epiteto / arquetipo</span>
            <input
              name="epithet"
              defaultValue={god.epithet ?? ''}
              className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
            />
          </label>
          <label className="grid gap-1 md:col-span-2">
            <span className="text-xs text-white/60">Descripcion</span>
            <textarea
              name="description"
              rows={4}
              defaultValue={god.description ?? ''}
              className="rounded-xl border border-white/10 bg-slate-950/70 p-3 text-sm text-white/90 outline-none"
            />
          </label>
          <label className="grid gap-1 md:col-span-2">
            <span className="text-xs text-white/60">PDF maestro (URL)</span>
            <input
              name="pdfUrl"
              defaultValue={god.pdfUrl ?? ''}
              className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
              placeholder="https://..."
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-white/60">Imagen (URL)</span>
            <input
              name="imageUrl"
              defaultValue={god.imageUrl ?? ''}
              className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-white/60">Orden</span>
            <input
              name="sortOrder"
              type="number"
              defaultValue={String(god.sortOrder)}
              className="h-11 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white/90 outline-none"
            />
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 md:col-span-2">
            <input
              name="isActive"
              type="checkbox"
              defaultChecked={god.isActive}
              className="accent-emerald-400"
            />
            Activo
          </label>

          {god.pdfUrl ? (
            <p className="md:col-span-2 text-xs text-white/55">
              PDF actual:{' '}
              <a
                href={god.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-200 underline-offset-2 hover:underline"
              >
                Abrir en otra pestania
              </a>
            </p>
          ) : null}

          <div className="md:col-span-2 mt-2 flex flex-wrap items-center justify-between gap-3">
            <FormSubmitButton
              className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
              pendingLabel="Guardando..."
            >
              Guardar cambios
            </FormSubmitButton>
          </div>
        </form>

        <form action={deleteGreekGodAction} className="mt-4 border-t border-white/10 pt-4">
          <input type="hidden" name="godId" value={god.id} />
          <FormSubmitButton
            className="inline-flex h-9 items-center justify-center rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 text-xs font-semibold text-rose-100 transition hover:bg-rose-400/20"
            pendingLabel="Borrando..."
            confirmMessage="Eliminar este dios del catalogo?"
          >
            Eliminar dios
          </FormSubmitButton>
        </form>
      </ModalShell>
    </>
  );
}

export function GodFormModal(props: Props) {
  if (props.mode === 'create') return <CreateGod />;
  return <EditGod god={props.god} />;
}
