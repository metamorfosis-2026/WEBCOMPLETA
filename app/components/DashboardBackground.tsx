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
        className="absolute inset-0 h-full w-full object-cover"
        src={BG_URL}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/80 to-slate-950/92" />
    </div>
  );
}
