'use client';

export function FloatingWhatsApp({
  label = 'Mensajes',
}: {
  label?: string;
}) {
  const instagramUrl = 'https://www.instagram.com/metamorfosis.vip/';

  return (
    <a
      href={instagramUrl}
      target="_blank"
      rel="noreferrer"
      // bottom-24: queda por encima de la barra fija de inscripcion
      className="fixed bottom-24 right-5 z-40 inline-flex items-center gap-2.5 rounded-full border border-ivory/15 bg-night/80 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-ivory/70 backdrop-blur-xl transition duration-300 hover:border-ivory/35 hover:text-ivory"
      aria-label="Contactar por Instagram"
    >
      <span className="inline-flex h-5 w-5 items-center justify-center">
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.266.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zM5.838 12a6.162 6.162 0 1 1 12.324 0 6.162 6.162 0 0 1-12.324 0zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm4.965-10.322a1.44 1.44 0 1 1 2.881.001 1.44 1.44 0 0 1-2.881-.001z"/>
        </svg>
      </span>
      <span className="hidden sm:inline">{label}</span>
    </a>
  );
}
