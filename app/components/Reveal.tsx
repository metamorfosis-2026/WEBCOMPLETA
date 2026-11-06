'use client';

import { useEffect, useRef, useState } from 'react';

/*
  Aparición suave al hacer scroll, sin esconder nada por defecto.

  El HTML que manda el servidor trae el contenido visible. Recién cuando el
  JavaScript ya corrió, los bloques que están más abajo de la pantalla se
  esconden y aparecen al llegar a ellos. Si el JS tarda o falla (celulares
  viejos, navegador interno de Instagram/TikTok) la página se lee igual.

  Antes esto usaba framer-motion con initial="hidden", que mandaba todo con
  opacity:0 desde el servidor: sin JS la página quedaba en negro.
*/

type Phase = 'static' | 'hidden' | 'visible';

const EASE = 'cubic-bezier(0.25, 0.1, 0.25, 1)';

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [phase, setPhase] = useState<Phase>('static');

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    // Lo que ya está en pantalla al cargar queda como está: esconderlo para
    // animarlo haría parpadear el contenido que la persona ya está viendo.
    if (el.getBoundingClientRect().top < window.innerHeight) return;

    setPhase('hidden');

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setPhase('visible');
          observer.disconnect();
        }
      },
      // Se dispara cuando el borde de arriba pasa el 85% de la pantalla,
      // sin importar qué tan alto sea el bloque.
      { rootMargin: '0px 0px -15% 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const style: React.CSSProperties | undefined =
    phase === 'hidden'
      ? { opacity: 0, transform: 'translateY(18px)' }
      : phase === 'visible'
        ? {
            opacity: 1,
            transform: 'none',
            transition: `opacity 0.6s ${EASE} ${delay}s, transform 0.6s ${EASE} ${delay}s`,
          }
        : undefined;

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}
