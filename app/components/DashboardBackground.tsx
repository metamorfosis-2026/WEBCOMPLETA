'use client';

const BG_URL =
  'https://pub-a6844436cdf343eca77a9769bb10e73e.r2.dev/abstract-futuristic-network-lines-vertical-backgro-2026-01-28-03-51-34-utc.mov';

export function DashboardBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover opacity-70"
        src={BG_URL}
      />
      {/* Doble capa: la vertical baja el brillo del video y la radial arma la
          viñeta para que el contenido del panel no compita con el fondo. */}
      <div className="absolute inset-0 bg-gradient-to-b from-night/75 via-night/85 to-night/95" />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 80% at 50% 0%, rgba(124,201,236,0.14) 0%, transparent 55%), radial-gradient(100% 100% at 50% 100%, rgba(4,7,14,0.85) 0%, transparent 60%)',
        }}
      />
    </div>
  );
}
