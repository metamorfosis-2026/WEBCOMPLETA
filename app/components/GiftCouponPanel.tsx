import Link from 'next/link';

import { saveGiftRecipient } from '@/app/dashboard/actions';

type GiftInvitation = {
  recipientFirstName: string;
  recipientLastName: string;
  recipientPhone: string;
  updatedAt: string;
} | null;

export function GiftCouponPanel({
  giftInvitation,
  directUrl,
}: {
  giftInvitation: GiftInvitation;
  directUrl?: string;
}) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-amber-300/30 bg-gradient-to-br from-amber-200/20 via-orange-300/10 to-rose-300/20 shadow-[0_20px_80px_rgba(251,191,36,0.18)]">
      <div className="border-b border-white/10 bg-white">
        <img
          src="https://pub-a6844436cdf343eca77a9769bb10e73e.r2.dev/1%20cupo.png"
          alt="Regalo de un cupo para Metamorfosis 6ta edicion"
          className="block h-auto w-full object-contain"
        />
      </div>

      <div className="p-6 sm:p-8">
        <p className="text-xs font-bold tracking-[0.3em] text-amber-100/90">REGALO DISPONIBLE</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
          Puedes regalar 1 lugar para Metamorfosis 6ta edicion
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80">
          Como ya tienes Fase 2 con una seña cargada, aquí puedes dejar los datos de la persona a la que quieres
          invitar. Esto queda guardado para que el equipo lo vea desde admin.
        </p>

        {directUrl ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs font-semibold tracking-wide text-amber-100/80">LINK DIRECTO DEL CUPON</p>
            <code className="mt-2 block select-all break-all text-xs text-white/75">{directUrl}</code>
            <p className="mt-2 text-xs text-white/55">
              Este enlace pide login antes de mostrar el cupón.
            </p>
          </div>
        ) : null}

        <form action={saveGiftRecipient} className="mt-6 grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-xs font-semibold tracking-wide text-white/70">Nombre</span>
              <input
                name="recipientFirstName"
                required
                defaultValue={giftInvitation?.recipientFirstName ?? ''}
                className="h-12 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white/90 outline-none transition focus:border-amber-300/60"
                placeholder="Nombre"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-semibold tracking-wide text-white/70">Apellido</span>
              <input
                name="recipientLastName"
                required
                defaultValue={giftInvitation?.recipientLastName ?? ''}
                className="h-12 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white/90 outline-none transition focus:border-amber-300/60"
                placeholder="Apellido"
              />
            </label>
          </div>

          <label className="grid gap-2">
            <span className="text-xs font-semibold tracking-wide text-white/70">Celular</span>
            <input
              name="recipientPhone"
              required
              defaultValue={giftInvitation?.recipientPhone ?? ''}
              className="h-12 rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white/90 outline-none transition focus:border-amber-300/60"
              placeholder="11 2345 6789"
            />
          </label>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-white/60">
              {giftInvitation
                ? `Ultima actualizacion: ${new Date(giftInvitation.updatedAt).toLocaleString()}`
                : 'Todavia no cargaste a la persona invitada.'}
            </p>
            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-amber-300 px-5 text-sm font-semibold text-black transition hover:bg-amber-200"
            >
              {giftInvitation ? 'Actualizar regalo' : 'Guardar regalo'}
            </button>
          </div>
        </form>

        {!directUrl ? null : (
          <div className="mt-6 text-sm">
            <Link className="text-white/70 hover:text-white hover:underline" href="/dashboard">
              {'<-'} Volver al panel
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
