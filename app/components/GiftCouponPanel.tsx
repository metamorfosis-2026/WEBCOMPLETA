import { saveGiftRecipient } from '@/app/dashboard/actions';

type GiftInvitation = {
  recipientFirstName: string;
  recipientLastName: string;
  recipientPhone: string;
  updatedAt: string;
} | null;

// text-[16px] en los inputs: por debajo de eso iOS hace zoom al enfocar.
const inputClass =
  'h-12 w-full rounded-xl border border-ivory/12 bg-night/50 px-4 text-[16px] text-ivory outline-none transition duration-300 placeholder:text-ivory/25 focus:border-sand/60 focus:bg-ivory/[0.06]';

const labelClass = 'text-[11px] font-bold uppercase tracking-[0.16em] text-ivory/45';

export function GiftCouponPanel({
  giftInvitation,
}: {
  giftInvitation: GiftInvitation;
}) {
  return (
    <section className="surface overflow-hidden border-sand/25 bg-gradient-to-br from-sand/12 via-ivory/[0.02] to-transparent">
      <div className="border-b border-ivory/10 bg-night/60">
        <img
          src="https://pub-a6844436cdf343eca77a9769bb10e73e.r2.dev/1%20cupo.png"
          alt="Regalo de un cupo para Metamorfosis 6ta edicion"
          className="block h-auto w-full object-contain"
        />
      </div>

      <div className="p-6 sm:p-8">
        <span className="chip chip-sand">Regalo disponible</span>
        <h2 className="display mt-4 text-[1.7rem] leading-tight sm:text-[2rem]">
          Podés regalar 1 lugar para Metamorfosis 6ta edición
        </h2>
        <p className="mt-3 max-w-prose text-[14px] leading-relaxed text-ivory/60">
          Como ya tenés Fase 2 con una seña cargada, acá podés dejar los datos de la persona a la que
          querés invitar. Queda guardado para que el equipo lo vea desde admin.
        </p>

        <form action={saveGiftRecipient} className="mt-7 grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className={labelClass}>Nombre</span>
              <input
                name="recipientFirstName"
                required
                defaultValue={giftInvitation?.recipientFirstName ?? ''}
                className={inputClass}
                placeholder="Nombre"
              />
            </label>

            <label className="grid gap-2">
              <span className={labelClass}>Apellido</span>
              <input
                name="recipientLastName"
                required
                defaultValue={giftInvitation?.recipientLastName ?? ''}
                className={inputClass}
                placeholder="Apellido"
              />
            </label>
          </div>

          <label className="grid gap-2">
            <span className={labelClass}>Celular</span>
            <input
              name="recipientPhone"
              required
              defaultValue={giftInvitation?.recipientPhone ?? ''}
              className={inputClass}
              placeholder="11 2345 6789"
            />
          </label>

          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12px] text-ivory/45">
              {giftInvitation
                ? `Última actualización: ${new Date(giftInvitation.updatedAt).toLocaleString()}`
                : 'Todavía no cargaste a la persona invitada.'}
            </p>
            <button
              type="submit"
              className="inline-flex h-12 flex-none items-center justify-center rounded-xl bg-sand px-6 text-xs font-extrabold uppercase tracking-[0.12em] text-night transition duration-300 hover:shadow-[0_16px_40px_-16px_rgba(228,200,156,1)]"
            >
              {giftInvitation ? 'Actualizar regalo' : 'Guardar regalo'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
